// Сбор геоданных для интерактивной карты.
//
// Источники:
//   1. Google Sheets (как и для обычных таблиц) — названия, адреса, категории.
//   2. src/data/geo-cache.json — заранее подготовленная база координат.
//
// Во время astro build никаких внешних геокодеров не вызывается: все
// координаты берутся из локального кэша. Обновление кэша — отдельный
// скрипт scripts/geocode-addresses.mjs.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadAllMeta, loadDataByFile } from './csv-data.js';
import { CATEGORIES, fileSlug } from './categories.js';
import {
  addressCacheKey,
  buildOrgIndex,
  matchOrganizationAddress,
  normalizeText,
} from './address-match.js';

const GEO_CACHE_FILE = join(process.cwd(), 'src', 'data', 'geo-cache.json');

let orgIndexPromise = null;
let geoPromise = null;

/** Читает локальную базу координат. Если файла ещё нет — карта будет пустой. */
function loadGeoCache() {
  try {
    const raw = JSON.parse(readFileSync(GEO_CACHE_FILE, 'utf8'));
    return raw.addresses || raw || {};
  } catch {
    return {};
  }
}

/** Достаёт координаты из кэша. Поддерживает {lat,lon} и [lon,lat]. */
function coordsFromCache(cache, address) {
  const entry = cache[addressCacheKey(address)];
  if (!entry) return null;
  if (Array.isArray(entry) && entry.length >= 2) {
    return { lat: Number(entry[1]), lon: Number(entry[0]) };
  }
  const lat = Number(entry.lat);
  const lon = Number(entry.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

/**
 * Явные координаты в исходных данных. Сейчас таких колонок нет, но механизм
 * заложен: если в таблицу добавят «Широта»/«Долгота» или «Координаты»,
 * они получат приоритет над кэшем.
 */
function explicitCoords(obj, headers) {
  const find = re => headers.find(h => re.test(h));
  const latKey = find(/^(lat|latitude|широта)$/i);
  const lonKey = find(/^(lon|lng|longitude|долгота)$/i);
  if (latKey && lonKey) {
    const lat = Number(String(obj[latKey]).replace(',', '.'));
    const lon = Number(String(obj[lonKey]).replace(',', '.'));
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }

  const pairKey = find(/координат|coordinates/i);
  if (pairKey) {
    const nums = String(obj[pairKey] || '')
      .replace(',', '.')
      .match(/-?\d+(?:\.\d+)?/g)
      ?.map(Number);
    if (nums?.length >= 2) {
      const [a, b] = nums;
      // В Тольятти широта ≈ 53, долгота ≈ 49. Определяем порядок по значению.
      if (a > 45 && b < 45) return { lat: a, lon: b };
      if (b > 45 && a < 45) return { lat: b, lon: a };
    }
  }
  return null;
}

function objectName(obj) {
  const candidates = [
    obj['Наименование'],
    obj['Наименование организации'],
    obj['Название'],
    obj['В ведении'],
    obj['Руководитель'],
    obj['ФИО'],
    obj['Должность'],
  ];

  for (const value of candidates) {
    const text = String(value ?? '').trim();
    if (text && text !== '—' && text !== '-') return text;
  }
  return 'Без названия';
}

/** Контактное поле для карточки: пустые значения и прочерки не выводим. */
function contactValue(value) {
  const text = String(value ?? '').trim();
  if (!text || text === '—' || text === '-' || /^нет$/i.test(text)) return '';
  return text;
}

/** Индекс организаций из телефонного справочника (для адресов образования). */
export async function loadOrganizationIndex(meta = null) {
  if (orgIndexPromise) return orgIndexPromise;

  orgIndexPromise = (async () => {
    const all = meta || (await loadAllMeta());
    const files = all
      .filter(m => /phonebook_organizations/i.test(m.filename))
      .sort((a, b) => {
        const byVersion = versionOf(b.filename) - versionOf(a.filename);
        if (byVersion !== 0) return byVersion;
        return String(b.date || '').localeCompare(String(a.date || ''));
      });
    if (!files.length) return buildOrgIndex([]);

    const { objects } = await loadDataByFile(files[0].filename);
    return buildOrgIndex(
      objects.map(obj => ({
        name: obj['Наименование'] || obj['Наименование организации'] || '',
        address: obj['Адрес'] || '',
      })),
    );
  })();

  return orgIndexPromise;
}

/**
 * Дополняет объекты образования адресами из телефонного справочника.
 * Мутирует objects (они уже загружены для текущей страницы) и возвращает
 * количество найденных адресов.
 */
export function enrichEducationObjects(objects, orgIndex) {
  let matched = 0;
  for (const obj of objects) {
    if (obj['Адрес']) continue;
    const name = obj['Наименование'] || obj['Наименование организации'] || '';
    const found = matchOrganizationAddress(name, orgIndex);
    if (found) {
      obj['Адрес'] = found.address;
      matched++;
    }
  }
  return matched;
}

function versionOf(filename) {
  const m = String(filename).match(/file[_-]?(\d+)$/i);
  return m ? Number(m[1]) : 0;
}

/** Убирает дубли листов: в таблице лежат несколько версий одного и того же набора. */
function dedupeMeta(meta) {
  const sorted = [...meta].sort((a, b) => {
    const byVersion = versionOf(b.filename) - versionOf(a.filename);
    if (byVersion !== 0) return byVersion;
    return String(b.date || '').localeCompare(String(a.date || ''));
  });

  const bySubcategory = new Map();
  for (const entry of sorted) {
    const key = `${entry.category}|${entry.subcategory}`;
    if (!bySubcategory.has(key)) bySubcategory.set(key, entry);
  }
  return [...bySubcategory.values()];
}

/**
 * Собирает GeoJSON для /data/geo.json.
 * @returns {Promise<{type:'FeatureCollection', features:Array, meta:Object}>}
 */
export async function buildGeoJSON() {
  if (geoPromise) return geoPromise;

  geoPromise = (async () => {
    const allMeta = await loadAllMeta();
    const meta = dedupeMeta(allMeta);
    const cache = loadGeoCache();

    const features = [];
    const seen = new Set();
    const filterCounts = new Map();
    const categoryCounts = new Map();
    let total = 0;
    let unmapped = 0;

    for (const entry of meta) {
      // Образование на карту не выводим: школы, садики и вузы уже есть
      // на базовой карте OpenStreetMap как POI. Таблицы образования
      // на сайте при этом остаются.
      if (entry.category === 'education') continue;

      const data = await loadDataByFile(entry.filename);
      const headers = [...data.headers];
      const objects = data.objects;
      const filterId = fileSlug(entry.filename);

      objects.forEach(obj => {
        const address = String(obj['Адрес'] || '').trim();
        if (!address) return;

        total++;
        const coords = explicitCoords(obj, headers) || coordsFromCache(cache, address);
        if (!coords) {
          unmapped++;
          return;
        }

        const name = objectName(obj);
        const dedupeKey = `${filterId}|${normalizeText(name)}|${normalizeText(address)}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        const email = contactValue(obj['Email']);
        const phone = contactValue(obj['Телефон']);
        const site = contactValue(obj['Сайт']);

        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [coords.lon, coords.lat],
          },
          properties: {
            name,
            address,
            category: entry.category,
            filterId,
            ...(email ? { email } : {}),
            ...(phone ? { phone } : {}),
            ...(site ? { site } : {}),
          },
        });

        filterCounts.set(filterId, (filterCounts.get(filterId) || 0) + 1);
        categoryCounts.set(entry.category, (categoryCounts.get(entry.category) || 0) + 1);
      });
    }

    const filters = [...filterCounts.entries()]
      .map(([id, count]) => {
        const entry = meta.find(m => fileSlug(m.filename) === id);
        return {
          id,
          label: entry?.subcategory || id,
          category: entry?.category || '',
          count,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'ru'));

    return {
      type: 'FeatureCollection',
      features,
      meta: {
        generatedAt: new Date().toISOString(),
        source: 'OpenStreetMap address index + local cache',
        total,
        mapped: features.length,
        unmapped,
        filters,
        categories: [...categoryCounts.entries()].map(([key, count]) => ({
          key,
          label: CATEGORIES[key]?.label || key,
          color: CATEGORIES[key]?.color || '#6c757d',
          count,
        })),
      },
    };
  })();

  return geoPromise;
}

/**
 * Количество объектов на карте по подкатегориям.
 * Нужно страницам категорий, чтобы показать кнопку только там,
 * где действительно есть координаты.
 */
export async function getMapCounts() {
  const geo = await buildGeoJSON();
  const counts = {};
  for (const filter of geo.meta.filters) counts[filter.id] = filter.count;
  return counts;
}

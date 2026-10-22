// Подготовка локальной базы координат для карты.
//
// Запуск:
//   node scripts/geocode-addresses.mjs             # из кэша OSM, без Nominatim
//   node scripts/geocode-addresses.mjs --refresh   # заново скачать адреса OSM
//   node scripts/geocode-addresses.mjs --nominatim # добить остатки через Nominatim
//
// Результат: src/data/geo-cache.json — база «нормализованный адрес → координаты».
// Во время astro build этот файл только читается, никаких сетевых запросов нет.

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectCategory, extractDate, fileSlug, CATEGORIES } from '../src/lib/categories.js';
import { unifyHeaders, unifyObject } from '../src/lib/column-map.js';
import {
  addressCacheKey,
  buildOsmIndex,
  buildOrgIndex,
  findOsmCoords,
  matchOrganizationAddress,
} from '../src/lib/address-match.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CACHE_DIR = join(ROOT, '.cache');
const OSM_CACHE = join(CACHE_DIR, 'osm-addresses.json');
const OUT_FILE = join(ROOT, 'src', 'data', 'geo-cache.json');
const ENV_FILE = join(ROOT, '.env');

const args = new Set(process.argv.slice(2));
const REFRESH = args.has('--refresh');
const USE_NOMINATIM = args.has('--nominatim');

const BBOX = { minLat: 53.40, minLng: 49.15, maxLat: 53.62, maxLng: 49.58 };
const VIEWBOX = '48.7,53.7,50.2,53.3';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function loadEnv() {
  if (!existsSync(ENV_FILE)) return;
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i > 0) process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
}

function sheetRange(name) {
  return encodeURIComponent(`${name}!A:Z`);
}

async function googleSheets(path) {
  const key = process.env.GOOGLE_API;
  const id = process.env.GOOGLE_SPREADSHEET_ID;
  if (!key || !id) throw new Error('Задайте GOOGLE_API и GOOGLE_SPREADSHEET_ID в .env');

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}${path}${path.includes('?') ? '&' : '?'}key=${key}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Google Sheets API: ${data.error?.message || res.statusText}`);
  }
  return data;
}

async function loadSheets() {
  const meta = await googleSheets('');
  const names = meta.sheets
    .map(s => s.properties.title)
    .filter(name => !name.startsWith('_'))
    .sort();

  const ranges = names.map(sheetRange).join('&ranges=');
  const batch = await googleSheets(`/values:batchGet?ranges=${ranges}`);

  const map = {};
  for (const vr of batch.valueRanges || []) {
    const name = vr.range.split('!')[0].replace(/'/g, '');
    const rows = vr.values || [];
    if (rows.length < 2) {
      map[name] = { headers: [], objects: [] };
      continue;
    }
    const headers = rows[0].map(h => String(h).trim());
    const objects = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] != null ? String(row[i]).trim() : '';
      });
      return obj;
    });
    map[name] = { headers, objects };
  }
  return { names, map };
}

function versionOf(filename) {
  const m = String(filename).match(/file[_-]?(\d+)$/i);
  return m ? Number(m[1]) : 0;
}

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

async function fetchOsmAddresses() {
  if (!REFRESH && existsSync(OSM_CACHE)) {
    console.log(`OSM-кэш: ${OSM_CACHE}`);
    return JSON.parse(readFileSync(OSM_CACHE, 'utf8'));
  }

  const query = `[out:json][timeout:180];
(
  node["addr:street"]["addr:housenumber"](${BBOX.minLat},${BBOX.minLng},${BBOX.maxLat},${BBOX.maxLng});
  way["addr:street"]["addr:housenumber"](${BBOX.minLat},${BBOX.minLng},${BBOX.maxLat},${BBOX.maxLng});
);
out center tags;`;

  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const url of OVERPASS_ENDPOINTS) {
      try {
        console.log(`Загрузка адресов OSM: ${url}`);
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'User-Agent': 'opentgl-geocoder/1.0 (open data portal Togliatti)',
            Accept: 'application/json',
          },
          body: new URLSearchParams({ data: query }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data.elements)) throw new Error('Пустой ответ Overpass');

        mkdirSync(CACHE_DIR, { recursive: true });
        writeFileSync(OSM_CACHE, JSON.stringify(data));
        console.log(`Адресных точек OSM: ${data.elements.length}`);
        return data;
      } catch (err) {
        lastError = err;
        console.warn(`  ${url}: ${err.message}`);
      }
    }
    await sleep(5000 * (attempt + 1));
  }
  throw new Error(`Не удалось скачать адреса OSM: ${lastError?.message}`);
}

async function nominatimSearch(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    `${address}, Тольятти`,
  )}&limit=1&bounded=1&viewbox=${VIEWBOX}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'opentgl-geocoder/1.0 (open data portal Togliatti)' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || !data.length) return null;
  return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
}

async function main() {
  loadEnv();
  const { names, map } = await loadSheets();

  const meta = names.map(filename => {
    const cat = detectCategory(filename);
    return {
      filename,
      date: extractDate(filename),
      category: cat.cat,
      subcategory: cat.sub,
      ...map[filename],
    };
  });

  const entries = dedupeMeta(meta);

  // Образование: адреса берём из телефонного справочника по названию учреждения.
  const orgFiles = entries
    .filter(e => /phonebook_organizations/i.test(e.filename))
    .sort((a, b) => versionOf(b.filename) - versionOf(a.filename));
  let orgIndex = null;
  if (orgFiles.length) {
    const orgObjects = orgFiles[0].objects.map(unifyObject);
    orgIndex = buildOrgIndex(
      orgObjects.map(obj => ({
        name: obj['Наименование'] || obj['Наименование организации'] || '',
        address: obj['Адрес'] || '',
      })),
    );
  }

  const addressesByCategory = new Map();
  let educationMatched = 0;

  for (const entry of entries) {
    const headers = unifyHeaders(entry.headers);
    const objects = entry.objects.map(unifyObject);

    if (entry.category === 'education' && orgIndex) {
      for (const obj of objects) {
        if (obj['Адрес']) continue;
        const found = matchOrganizationAddress(
          obj['Наименование'] || obj['Наименование организации'] || '',
          orgIndex,
        );
        if (found) {
          obj['Адрес'] = found.address;
          educationMatched++;
        }
      }
    }

    for (const obj of objects) {
      const address = String(obj['Адрес'] || '').trim();
      if (!address) continue;
      if (!addressesByCategory.has(entry.category)) addressesByCategory.set(entry.category, new Set());
      addressesByCategory.get(entry.category).add(address);
    }
  }

  const allAddresses = [...new Set([...addressesByCategory.values()].flatMap(set => [...set]))];
  console.log(`Уникальных адресов: ${allAddresses.length}`);
  if (educationMatched) {
    console.log(`Адресов образования из фондбука: ${educationMatched}`);
  }

  const osm = await fetchOsmAddresses();
  const index = buildOsmIndex(osm.elements || []);
  console.log(`Проиндексировано адресов OSM: ${index.exact.size} ключей`);

  const addresses = {};
  const unmatched = [];
  let matched = 0;

  for (let i = 0; i < allAddresses.length; i++) {
    const raw = allAddresses[i];
    let coords = findOsmCoords(index, raw);
    let source = 'osm';

    if (!coords && USE_NOMINATIM) {
      coords = await nominatimSearch(raw);
      source = 'nominatim';
      await sleep(1100);
    }

    if (coords) {
      addresses[addressCacheKey(raw)] = {
        lat: Number(coords.lat.toFixed(6)),
        lon: Number(coords.lon.toFixed(6)),
        source,
      };
      matched++;
    } else {
      unmatched.push(raw);
    }

    if ((i + 1) % 500 === 0 || i === allAddresses.length - 1) {
      console.log(`  ${i + 1}/${allAddresses.length}, найдено ${matched}`);
    }
  }

  const result = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: USE_NOMINATIM
      ? 'OpenStreetMap address points + Nominatim fallback'
      : 'OpenStreetMap address points',
    addresses,
  };

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, `${JSON.stringify(result, null, 0)}\n`);

  const sizeKb = (statSync(OUT_FILE).size / 1024).toFixed(0);
  console.log(`\nГотово: ${matched}/${allAddresses.length} адресов с координатами.`);
  console.log(`Файл: ${OUT_FILE} (${sizeKb} КБ)`);

  console.log('\nПо категориям:');
  for (const [category, set] of [...addressesByCategory.entries()].sort()) {
    const found = [...set].filter(a => addresses[addressCacheKey(a)]).length;
    console.log(
      `  ${CATEGORIES[category]?.label || category}: ${found}/${set.size}`,
    );
  }

  if (unmatched.length) {
    console.log(`\nБез координат: ${unmatched.length}`);
    for (const raw of unmatched.slice(0, 15)) console.log(`  — ${raw}`);
    if (unmatched.length > 15) console.log(`  … ещё ${unmatched.length - 15}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

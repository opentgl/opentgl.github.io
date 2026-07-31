import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listSheetFiles, loadAllSheets } from './google-sheets.js';

const ROUTE_COLORS = [
  '#0d6efd', '#198754', '#dc3545', '#fd7e14', '#6f42c1',
  '#0dcaf0', '#20c997', '#e83e8c', '#ffc107', '#6610f2',
  '#17a2b8', '#d63384', '#198754', '#fd7e14', '#0d6efd',
];

const ABBR = {
  'б-р': 'бульвар',
  'пр-т': 'проспект',
  'пер': 'переулок',
  'наб': 'набережная',
  'к/т': 'кинотеатр',
  'ул': 'улица',
  'пр': 'проспект',
  'ш': 'шоссе',
  'пл': 'площадь',
};

export function normalizeName(name) {
  return String(name || '')
    .replace(/\([^)]*?(обратн|прям|направлени)[^)]*?\)/gi, '')
    .replace(/ё/g, 'е')
    .replace(/-й\b/g, '')
    .replace(/\s*№\s*/g, '№')
    .replace(/["«»']/g, '')
    .toLowerCase()
    .split(/[\s,;]+/)
    .map(w => {
      const t = w.replace(/[.,:!?]+$/g, '');
      return (t in ABBR ? ABBR[t] : t);
    })
    .filter(Boolean)
    .join(' ');
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// Расстояние в метрах (гаверсинус).
function distM(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Радиусы поиска (м): сначала ищем остановку рядом с предыдущей,
// если не нашли — расширяем поле поиска.
export const SEARCH_RADII = [50, 100, 500, 1000, Infinity];

// Все кандидаты для остановки: точные по сырому/нормализованному имени
// плюс частичные (все слова имени входят в имя точки), чтобы pickPoint
// выбирал ближайшую к предыдущей точку даже при неточном названии
// (например «Детский мир» -> «Магазин Детский мир»).
export function candidatesFor(index, name) {
  const { coords, points } = index;
  const raw = coords[name] || [];
  const norm = coords[normalizeName(name)] || [];
  const exact = dedup(raw, norm);

  const q = normalizeName(name);
  const qWords = q.split(' ');
  if (!qWords.length) return exact;

  const exactKeys = new Set(exact.map(k => k.lat.toFixed(6) + ',' + k.lon.toFixed(6)));
  const allowContained = qWords.length >= 2 || exact.length > 0;
  const fuzzy = [];
  for (const p of points) {
    if (exactKeys.has(p.lat.toFixed(6) + ',' + p.lon.toFixed(6))) continue;
    const nWords = p.norm.split(' ');
    const contained = allowContained && qWords.every(w => nWords.includes(w));
    const matched = nWords.filter(w => qWords.includes(w));
    const contains = nWords.length >= 2 && matched.length >= 2 && matched.length >= nWords.length - 1;
    if (contained || contains) fuzzy.push(p);
  }
  return exact.concat(fuzzy);
}

function dedup(...arrays) {
  const seen = new Set();
  const out = [];
  for (const arr of arrays) {
    for (const p of arr) {
      const k = p.lat.toFixed(6) + ',' + p.lon.toFixed(6);
      if (!seen.has(k)) { seen.add(k); out.push(p); }
    }
  }
  return out;
}

// Среди дубликатов (несколько ОСМ-точек с одним именем) выбирает ту,
// что по координатам ближе к предыдущей остановке маршрута.
// Поиск ведётся по расширяющимся радиусам SEARCH_RADII: если точка
// нашлась в маленьком радиусе — берём её, иначе расширяем поле поиска.
export function pickPoint(candidates, prev) {
  if (!candidates || candidates.length === 0) return null;
  if (!prev) return candidates[0];
  for (const radius of SEARCH_RADII) {
    let best = null;
    let bestDist = Infinity;
    for (const c of candidates) {
      const d = distM(prev, c);
      if (d <= radius && d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    if (best) return best;
  }
  return candidates[0];
}

export function loadStopCoords() {
  const coords = {};
  const points = [];
  const pointKeys = new Set();

  const addPoint = (point, norm) => {
    const k = point.lat.toFixed(6) + ',' + point.lon.toFixed(6);
    if (!pointKeys.has(k)) {
      pointKeys.add(k);
      points.push({ lat: point.lat, lon: point.lon, norm });
    }
  };

  const push = (key, point) => {
    if (!key) return;
    (coords[key] || (coords[key] = [])).push(point);
  };

  const osm = readJson(join(process.cwd(), 'src', 'data', 'stops.json'));
  if (osm && Array.isArray(osm.features)) {
    for (const f of osm.features) {
      const p = f.properties || {};
      const g = f.geometry || {};
      if (!p.name || g.type !== 'Point' || !Array.isArray(g.coordinates)) continue;
      const point = { lat: g.coordinates[1], lon: g.coordinates[0] };
      push(p.name, point);
      push(normalizeName(p.name), point);
      addPoint(point, normalizeName(p.name));
    }
  }

  const extra = readJson(join(process.cwd(), 'src', 'data', 'stops-extra.json'));
  if (extra && typeof extra === 'object') {
    for (const [name, v] of Object.entries(extra)) {
      if (!v || v.lat == null) continue;
      const point = { lat: v.lat, lon: v.lon };
      push(name, point);
      push(normalizeName(name), point);
      addPoint(point, normalizeName(name));
    }
  }

  return { coords, points };
}

export async function loadRoutes() {
  const files = await listSheetFiles();
  const transportFiles = files.filter(f => /marshrut|marshryti|route/i.test(f));
  const data = await loadAllSheets(transportFiles);
  const routes = [];

  for (const filename of transportFiles) {
    const { headers, objects } = data[filename] || { headers: [], objects: [] };
    const numIdx = headers.findIndex(h => /регистрационн.*номер\s*маршрута/i.test(h));
    const labelIdx = headers.findIndex(h => /порядков.*номер\s*маршрута/i.test(h));
    const nameIdx = headers.findIndex(h => /наименован.*маршрут/i.test(h));
    const stopIdx = headers.findIndex(h => /промежуточных ОП/.test(h));

    objects.forEach((obj, i) => {
      const stops = (stopIdx >= 0 ? obj[headers[stopIdx]] : '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const transport = /trolley/i.test(filename) ? 'Троллейбус'
        : /kommerch|comm/i.test(filename) ? 'Маршрутное такси'
        : 'Автобус';
      routes.push({
        id: String(i),
        num: (labelIdx >= 0 ? obj[headers[labelIdx]] : '') || (numIdx >= 0 ? obj[headers[numIdx]] : ''),
        name: (nameIdx >= 0 ? obj[headers[nameIdx]] : '') || 'Без названия',
        transport,
        stops,
      });
    });
  }

  routes.forEach((r, i) => {
    r.color = ROUTE_COLORS[i % ROUTE_COLORS.length];
  });
  return routes;
}
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OSM = join(ROOT, 'src', 'data', 'stops.json');
const EXTRA = join(ROOT, 'src', 'data', 'stops-extra.json');

for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) {
  if (line && !line.startsWith('#')) {
    const i = line.indexOf('=');
    if (i > 0) process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
}

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const VIEWBOX = '48.7,53.7,50.2,53.3';
const sleep = ms => new Promise(r => setTimeout(r, ms));

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

function normalizeName(name) {
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

async function sheetsGet(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`Sheets API: ${data.error.message}`);
  return data;
}

async function collectStops() {
  const id = process.env.GOOGLE_SPREADSHEET_ID;
  const key = process.env.GOOGLE_API;
  const meta = await sheetsGet(`${BASE}/${id}?key=${key}`);
  const names = meta.sheets.map(s => s.properties.title).filter(n => !n.startsWith('_'));
  const transportFiles = names.filter(n => /marshrut|marshryti|route/i.test(n));
  const stops = new Set();
  for (const f of transportFiles) {
    const d = await sheetsGet(`${BASE}/${id}/values/${encodeURIComponent(`${f}!A:Z`)}?key=${key}`);
    const rows = d.values || [];
    const headers = rows[0] || [];
    const stopIdx = headers.findIndex(h => /промежуточных ОП/.test(h));
    if (stopIdx < 0) continue;
    for (const row of rows.slice(1)) {
      for (const s of (row[stopIdx] || '').split(',')) {
        const t = s.trim();
        if (t) stops.add(t);
      }
    }
  }
  return [...stops];
}

function loadOsmNames() {
  const names = new Set();
  try {
    const raw = JSON.parse(readFileSync(OSM, 'utf8'));
    if (Array.isArray(raw.features)) {
      for (const f of raw.features) {
        const p = f.properties || {};
        if (p.name) {
          names.add(p.name);
          const key = normalizeName(p.name);
          if (key) names.add(key);
        }
      }
    }
  } catch {}
  return names;
}

async function geocode(stop) {
  const variants = [`${stop} Тольятти`, `${normalizeName(stop)} Тольятти`, stop];
  for (const q of variants) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&bounded=1&viewbox=${VIEWBOX}`;
    let res;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(url, { headers: { 'User-Agent': 'opentgl-geocode/1.0' } });
      if (res.status === 429) {
        await sleep(3000 * (attempt + 1));
        continue;
      }
      break;
    }
    const data = await res.json();
    if (Array.isArray(data) && data.length) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    await sleep(1100);
  }
  return null;
}

mkdirSync(dirname(EXTRA), { recursive: true });
let cache = {};
try { cache = JSON.parse(readFileSync(EXTRA, 'utf8')); } catch {}

const osmNames = loadOsmNames();
const stops = await collectStops();
const pending = stops.filter(s => {
  if (osmNames.has(s) || osmNames.has(normalizeName(s))) return false;
  if (cache[s] && (cache[s].lat != null || cache[s].missing)) return false;
  return true;
});

let ok = 0;
let fail = 0;
for (let i = 0; i < pending.length; i++) {
  const stop = pending[i];
  const result = await geocode(stop);
  if (result) {
    cache[stop] = { lat: result.lat, lon: result.lon };
    ok++;
  } else {
    cache[stop] = { missing: true };
    fail++;
  }
  writeFileSync(EXTRA, JSON.stringify(cache, null, 2));
  console.log(`[${i + 1}/${pending.length}] ${stop} -> ${result ? `${result.lat},${result.lon}` : 'NOT FOUND'}`);
  await sleep(1100);
}

const found = Object.values(cache).filter(v => v && v.lat).length;
console.log(`\nDone. New found: ${ok}, new missing: ${fail}. OSM covers ${osmNames.size} names, extra cached: ${Object.keys(cache).length}, extra with coords: ${found}`);

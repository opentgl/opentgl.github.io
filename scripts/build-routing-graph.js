// Сборка графа дорог города (Тольятти) из OpenStreetMap в компактный JSON.
//
// Запуск:  node scripts/build-routing-graph.js
// Выход:   public/data/graph-tolyatti.json
//
// Формат графа:
// {
//   "bounds": [minLat, minLng, maxLat, maxLng],
//   "n":       количество вершин,
//   "lat":     [lat0, lat1, ...],                     // широты (длина n)
//   "lng":     [lng0, lng1, ...],                     // долготы (длина n)
//   "start":   [0, k1, k2, ..., N],                   // срезы в единицах пар (длина n+1)
//   "adj":     [to, w, to, w, ...]                    // соседи + веса (метры)
// }
// Для вершины i её соседи: пары adj[2*start[i] .. 2*start[i+1]).
// Вес ребра — длина дуги в метрах (гаверсинус). Обычные дороги двунаправленны,
// дороги с oneway добавляются только в разрешённом направлении.

import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_FILE = join(__dirname, '..', 'public', 'data', 'graph-tolyatti.json');

const BBOX = { minLat: 53.40, minLng: 49.15, maxLat: 53.62, maxLng: 49.58 };

// Типы дорог, по которым разрешён проезд/проход.
const ROUTABLE = new Set([
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
  'unclassified', 'residential', 'service', 'living_street',
  'pedestrian', 'track', 'road', 'footway', 'path', 'cycleway', 'bridleway',
  'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link',
]);

function haversine(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLng = (bLng - aLng) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function fetchOsm() {
  const query = `[out:json][timeout:180];
way["highway"](${BBOX.minLat},${BBOX.minLng},${BBOX.maxLat},${BBOX.maxLng});
out body;
>;
out skel qt;`;
  // Зеркала Overpass API — основной сервер часто перегружен (HTTP 504).
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.osm.ch/api/interpreter',
    'https://overpass.openstreetmap.fr/api/interpreter',
  ];
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'User-Agent': 'opentgl-graph-builder/1.0 (open-data portal Togliatti)',
            'Accept': 'application/json',
          },
          body: new URLSearchParams({ data: query }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`);
        return res.json();
      } catch (err) {
        lastErr = err;
        console.warn(`Overpass ${url}: ${err.message}`);
      }
    }
    const pause = 5000 * (attempt + 1);
    console.warn(`Все зеркала недоступны, повтор через ${pause / 1000} с...`);
    await new Promise(r => setTimeout(r, pause));
  }
  throw new Error(`Overpass API: все зеркала недоступны — ${lastErr.message}`);
}

function isOnewayForward(tags) {
  const j = tags.junction;
  if (j === 'roundabout') return true;
  return tags.oneway === 'yes' || tags.oneway === 'true' || tags.oneway === '1';
}

function isOnewayReverse(tags) {
  return tags.oneway === '-1' || tags.oneway === 'reverse';
}

export async function buildGraph() {
  console.log('Скачивание данных OSM (Overpass)...');
  const data = await fetchOsm();

  const osmNodes = new Map();
  const ways = [];
  for (const el of data.elements) {
    if (el.type === 'node') {
      osmNodes.set(el.id, [el.lat, el.lon]);
    } else if (el.type === 'way') {
      const tags = el.tags || {};
      const hw = tags.highway;
      if (!ROUTABLE.has(hw)) continue;
      if (tags.area === 'yes') continue;
      if (!Array.isArray(el.nodes) || el.nodes.length < 2) continue;
      ways.push({ refs: el.nodes, tags });
    }
  }
  console.log(`Узлов OSM: ${osmNodes.size}, дорог: ${ways.length}`);

  // Локальные индексы вершин.
  const idMap = new Map();
  const lat = [];
  const lng = [];
  const localId = (osmid) => {
    let id = idMap.get(osmid);
    if (id === undefined) {
      const p = osmNodes.get(osmid);
      if (!p) return -1;
      id = lat.length;
      idMap.set(osmid, id);
      lat.push(p[0]);
      lng.push(p[1]);
    }
    return id;
  };

  const edgeList = []; // [a, b, w]

  for (const way of ways) {
    const fwd = isOnewayForward(way.tags);
    const rev = isOnewayReverse(way.tags);
    const ids = way.refs.map(localId);
    for (let i = 0; i < ids.length - 1; i++) {
      const a = ids[i], b = ids[i + 1];
      if (a < 0 || b < 0 || a === b) continue;
      const w = haversine(lat[a], lng[a], lat[b], lng[b]);
      if (fwd && !rev) edgeList.push([a, b, w]);
      else if (rev && !fwd) edgeList.push([b, a, w]);
      else edgeList.push([a, b, w]);
    }
  }

  const n = lat.length;
  // degree[a] — число направленных дуг (пар to,w) из вершины a.
  const degree = new Array(n).fill(0);
  for (const [a, b] of edgeList) { degree[a]++; degree[b]++; }

  // start в единицах ПАР (to, w): для вершины i срез [start[i] .. start[i+1]).
  const start = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) start[i + 1] = start[i] + degree[i];

  const totalPairs = start[n];
  const adj = new Array(totalPairs * 2);
  const cursor = start.slice(0, n);
  for (const [a, b, w] of edgeList) {
    adj[cursor[a] * 2] = b; adj[cursor[a] * 2 + 1] = w; cursor[a]++;
    adj[cursor[b] * 2] = a; adj[cursor[b] * 2 + 1] = w; cursor[b]++;
  }

  const graph = {
    bounds: [BBOX.minLat, BBOX.minLng, BBOX.maxLat, BBOX.maxLng],
    n,
    lat,
    lng,
    start,
    adj,
  };

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(graph));
  const sizeMb = (statSync(OUT_FILE).size / 1024 / 1024).toFixed(1);
  console.log(`Готово: ${n} вершин, ${edgeList.length} уникальных рёбер, ${adj.length / 2} направленных дуг.`);
  console.log(`Файл: ${OUT_FILE} (${sizeMb} МБ)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildGraph().catch(err => { console.error(err); process.exit(1); });
}

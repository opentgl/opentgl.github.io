// Клиентское представление графа дорог + пространственный индекс для
// быстрого поиска ближайшей вершины к клику.

import { haversineM } from './math.js';

// Готовит типизированные массивы для A* из JSON-графа.
export function prepareGraph(json) {
  const n = json.n;
  const adjTo = new Int32Array(json.adj.length / 2);
  const adjW = new Float64Array(json.adj.length / 2);
  const adj = json.adj;
  for (let i = 0, j = 0; i < adj.length; i += 2, j++) {
    adjTo[j] = adj[i];
    adjW[j] = adj[i + 1];
  }
  return {
    n,
    lat: new Float64Array(json.lat),
    lng: new Float64Array(json.lng),
    start: new Uint32Array(json.start),
    adjTo,
    adjW,
  };
}

// Пространственный индекс: сетка фиксированного размера (в градусах).
// Поиск ближайшей вершины идёт по расширяющимся кольцам клеток — O(1)
// в среднем даже для городов со 100+ тыс. вершин.
export function buildGrid(lat, lng, cellDeg) {
  const cell = cellDeg || 0.002; // ~200 м
  const buckets = new Map();
  const n = lat.length;
  for (let i = 0; i < n; i++) {
    const key = cellKey(lat[i], lng[i], cell);
    let arr = buckets.get(key);
    if (!arr) { arr = []; buckets.set(key, arr); }
    arr.push(i);
  }
  return { cell, buckets };
}

export function cellKey(lat, lng, cell) {
  return Math.floor((lat + 90) / cell) + ':' + Math.floor((lng + 180) / cell);
}

// Находит ближайшую вершину к (lat, lng).
// Возвращает { id, dist } — индекс вершины и расстояние в метрах.
// maxDistM — предельный радиус поиска (по умолчанию ~3 км).
export function findNearest(index, latArr, lngArr, lat, lng, maxDistM) {
  const { cell, buckets } = index;
  const maxM = maxDistM || 3000;
  const degPerRing = maxM / 111320;
  const ringMax = Math.ceil(degPerRing / cell);
  const cx = Math.floor((lat + 90) / cell);
  const cy = Math.floor((lng + 180) / cell);

  let best = -1, bestD = Infinity;
  for (let r = 0; r <= ringMax; r++) {
    const ringBest = best;
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const bucket = buckets.get((cx + dx) + ':' + (cy + dy));
        if (!bucket) continue;
        for (let k = 0; k < bucket.length; k++) {
          const id = bucket[k];
          const d = haversineM(lat, lng, latArr[id], lngArr[id]);
          if (d < bestD) { bestD = d; best = id; }
        }
      }
    }
    if (best !== -1) return { id: best, dist: bestD };
  }
  return { id: -1, dist: Infinity };
}

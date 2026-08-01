// Web Worker маршрутизации: загружает граф, ищет ближайшие вершины
// к кликам и строит маршрут A* — полностью локально, без внешних API.

import { prepareGraph, buildGrid, findNearest } from './graph.js';
import { astar, makeHeuristic } from './astar.js';
import { haversineM } from './math.js';

let state = null; // { graph, grid }

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    try {
      const graph = prepareGraph(msg.graph);
      state = {
        graph,
        grid: buildGrid(graph.lat, graph.lng, 0.002),
      };
      self.postMessage({ type: 'ready', n: graph.n });
    } catch (err) {
      self.postMessage({ type: 'error', message: 'Ошибка инициализации графа: ' + err.message });
    }
    return;
  }

  if (msg.type === 'route') {
    if (!state) {
      self.postMessage({ type: 'error', message: 'Граф дорог ещё не загружен.' });
      return;
    }
    const result = computeRoute(state, msg.from, msg.to);
    self.postMessage(result);
    return;
  }
};

function computeRoute(state, from, to) {
  const { graph, grid } = state;
  const fromLat = from[0], fromLng = from[1];
  const toLat = to[0], toLng = to[1];

  // 1. Ближайшие вершины к старту и финишу.
  const s = findNearest(grid, graph.lat, graph.lng, fromLat, fromLng);
  const t = findNearest(grid, graph.lat, graph.lng, toLat, toLng);

  if (s.id < 0 || t.id < 0) {
    return { type: 'error', message: 'Точка находится вне дорожной сети города.' };
  }

  // Точки, отстоящие от дороги больше порога, считаем изолированными.
  const MAX_SNAP_M = 400;
  if (s.dist > MAX_SNAP_M) {
    return { type: 'error', message: `Точка отправления слишком далеко от дороги (${Math.round(s.dist)} м).` };
  }
  if (t.dist > MAX_SNAP_M) {
    return { type: 'error', message: `Точка назначения слишком далеко от дороги (${Math.round(t.dist)} м).` };
  }

  // 2. Старт и финиш в одной вершине — прямой отрезок.
  if (s.id === t.id) {
    return {
      type: 'result',
      coords: [[fromLat, fromLng], [toLat, toLng]],
      distance: haversineM(fromLat, fromLng, toLat, toLng),
      snap: { from: s.dist, to: t.dist },
    };
  }

  // 3. A* с допустимой эвристикой.
  const heuristic = makeHeuristic(graph.lat, graph.lng, t.id);
  const path = astar(graph, s.id, t.id, heuristic);

  if (!path) {
    return {
      type: 'error',
      message: 'Маршрут не найден: точки находятся в разных частях дорожной сети.',
    };
  }

  // 4. Геометрия маршрута: [lat, lng] для Leaflet Polyline.
  const coords = new Array(path.length);
  let distance = 0;
  let prevLat = graph.lat[path[0]], prevLng = graph.lng[path[0]];
  for (let i = 0; i < path.length; i++) {
    const id = path[i];
    const la = graph.lat[id], ln = graph.lng[id];
    if (i > 0) distance += haversineM(prevLat, prevLng, la, ln);
    coords[i] = [la, ln];
    prevLat = la; prevLng = ln;
  }

  return { type: 'result', coords, distance, snap: { from: s.dist, to: t.dist } };
}

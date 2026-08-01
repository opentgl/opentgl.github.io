// A* поиск кратчайшего пути на компактном графе.
//
// Граф представлен типизированными массивами:
//   n         — число вершин
//   start[i]  — срез начала списка соседей вершины i (длина n+1)
//   adjTo[i]  — индекс соседней вершины
//   adjW[i]   — вес ребра (метры)
//
// Эвристика — эквидистанционное (равнопромежуточное) приближение гаверсинуса,
// вычисляется один раз с предрасчитанным cos(средней широты) — без тригонометрии
// на каждом шаге. Надёжно для расстояний до сотен километров.

class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(f, v) {
    const a = this.a;
    a.push([f, v]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0, n = a.length;
      while (true) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < n && a[l][0] < a[m][0]) m = l;
        if (r < n && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

// heuristic(u, goal) — функция оценки оставшегося расстояния в метрах.
// Возвращает массив индексов вершин пути или null, если путь не найден.
export function astar(graph, startId, goalId, heuristic) {
  const n = graph.n;
  if (startId === goalId) return [startId];

  const gScore = new Float64Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const open = new MinHeap();

  gScore[startId] = 0;
  open.push(heuristic(startId, goalId), startId);

  const adjTo = graph.adjTo;
  const adjW = graph.adjW;
  const start = graph.start;

  while (open.size) {
    const [, u] = open.pop();
    if (closed[u]) continue;
    if (u === goalId) break;
    closed[u] = 1;

    const su = start[u], eu = start[u + 1];
    const gu = gScore[u];
    for (let i = su; i < eu; i++) {
      const v = adjTo[i];
      if (closed[v]) continue;
      const tent = gu + adjW[i];
      if (tent < gScore[v]) {
        came[v] = u;
        gScore[v] = tent;
        open.push(tent + heuristic(v, goalId), v);
      }
    }
  }

  if (came[goalId] === -1) return null;

  const path = [];
  let cur = goalId;
  while (cur !== -1) {
    path.push(cur);
    if (cur === startId) break;
    cur = came[cur];
  }
  path.reverse();
  return path;
}

// Строит эвристику (оценку расстояния до цели в метрах) для A*.
export function makeHeuristic(lat, lng, goalId) {
  const R = 6371000;
  const gLat = lat[goalId];
  const gLng = lng[goalId];
  const cosMid = Math.cos(((gLat + gLat) / 2) * Math.PI / 180);
  const kLat = Math.PI / 180 * R;
  const kLng = Math.PI / 180 * R * cosMid;
  return (u) => {
    const dLat = (gLat - lat[u]) * kLat;
    const dLng = (gLng - lng[u]) * kLng;
    return Math.sqrt(dLat * dLat + dLng * dLng);
  };
}

export { MinHeap };

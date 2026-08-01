// Клиентский доступ к графу дорог и Web Worker маршрутизации.
// Один worker на страницу; граф загружается лениво при первом запросе.

let worker = null;
let readyPromise = null;

// Запрос к worker: одно сообщение -> один ответ. Ответы приходят строго
// по порядку, поэтому для последовательных запросов хватает одного слушателя.
function request(w, msg) {
  return new Promise((resolve, reject) => {
    const handler = (e) => {
      const m = e.data;
      if (m.type === 'error') {
        w.removeEventListener('message', handler);
        reject(new Error(m.message));
        return;
      }
      if (m.type === 'ready' || m.type === 'result') {
        w.removeEventListener('message', handler);
        resolve(m);
      }
    };
    w.addEventListener('message', handler);
    w.postMessage(msg);
  });
}

// Гарантирует загруженный и инициализированный worker. Возвращает Promise<Worker>.
export function ensureGraph(graphUrl) {
  if (!readyPromise) {
    readyPromise = (async () => {
      if (!worker) {
        worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      }
      const graph = await fetch(graphUrl).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });
      await request(worker, { type: 'init', graph });
      return worker;
    })().catch((err) => {
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

// Маршрут между двумя точками. Возвращает массив [lat, lng] или null.
export async function routeBetween(w, fromLat, fromLng, toLat, toLng) {
  const res = await request(w, { type: 'route', from: [fromLat, fromLng], to: [toLat, toLng] });
  return (res && res.coords) || null;
}

// Маршрут по цепочке остановок: последовательно склеивает отрезки A* по дорогам.
// points — массив { lat, lon }. Возвращает массив [lat, lng] или null, если ни один
// отрезок не прошёл по дорогам. Отдельные неудачные отрезки рисуются прямыми линиями.
export async function routeAlongStops(w, points) {
  if (points.length < 2) return points.map((p) => [p.lat, p.lon]);
  const coords = [];
  let anyRoad = false;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    let seg = await routeBetween(w, a.lat, a.lon, b.lat, b.lon);
    if (!seg || !seg.length) {
      seg = [[a.lat, a.lon], [b.lat, b.lon]];
    } else {
      anyRoad = true;
    }
    if (i > 0 && seg.length) seg.shift();
    coords.push(...seg);
  }
  return anyRoad ? coords : null;
}

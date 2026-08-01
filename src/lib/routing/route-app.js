// Обёртка для страницы маршрутов (/route/): подключает клиентский роутинг
// по дорогам через Web Worker и привязывает его к window, чтобы сработать
// и с inline-скриптом страницы.

import { ensureGraph, routeAlongStops } from './route-client.js';

const GRAPH_URL = `${import.meta.env.BASE_URL}data/graph-tolyatti.json`;

let workerPromise = null;

// Строит маршрут по остановкам (массив { lat, lon }) вдоль дорог.
// Возвращает Promise<[lat, lng][] | null>. Граф грузится один раз — лениво.
export function routeOnRoads(points) {
  if (!workerPromise) {
    workerPromise = ensureGraph(GRAPH_URL)
      .then((w) => {
        if (window.__routingRefresh) window.__routingRefresh();
        return w;
      })
      .catch((err) => {
        if (window.__routingError) window.__routingError(err.message);
        workerPromise = null;
        return null;
      });
  }
  return workerPromise.then((w) => (w ? routeAlongStops(w, points) : null));
}

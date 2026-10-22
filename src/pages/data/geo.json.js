// Статический endpoint /data/geo.json.
//
// Astro вызывает GET во время сборки и кладёт результат в dist/data/geo.json.
// Карта загружает этот файл на клиенте; никаких запросов к геокодерам
// в рантайме и во время сборки нет.

import { buildGeoJSON } from '../../lib/geo.js';

export async function GET() {
  const geo = await buildGeoJSON();

  return new Response(JSON.stringify(geo), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

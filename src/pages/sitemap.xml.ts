import { getCategories, loadAllMeta } from '../lib/csv-data.js';

const site = 'https://zhidkovers.github.io';
const base = '/opentgl';

const pages = [
  { loc: `${base}/`, priority: '1.0' },
  { loc: `${base}/about/`, priority: '0.8' },
];

const meta = loadAllMeta();
const categories = getCategories(meta);
for (const cat of categories) {
  pages.push({ loc: `${base}/category/${cat.key}/`, priority: '0.9' });
}

export async function GET() {
  const urls = pages
    .map(
      (p) => `  <url>
    <loc>${site}${p.loc}</loc>
    <priority>${p.priority}</priority>
  </url>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' },
  });
}

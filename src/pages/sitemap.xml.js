import { loadAllMeta, getCategories } from '../lib/csv-data';

export async function GET() {
  const meta = await loadAllMeta();
  const categories = getCategories(meta);
  const base = 'https://opentgl.github.io';

  const urls = [
    { loc: '/', priority: '1.0', changefreq: 'weekly' },
    { loc: '/about/', priority: '0.8', changefreq: 'monthly' },
    ...categories.map(c => ({
      loc: `/category/${c.key}/`,
      priority: '0.6',
      changefreq: 'weekly'
    }))
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${base}${u.loc}</loc>
    <priority>${u.priority}</priority>
    <changefreq>${u.changefreq}</changefreq>
  </url>`).join('\n')}
</urlset>`;

  return new Response(sitemap, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' }
  });
}

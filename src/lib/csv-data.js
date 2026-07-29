import { listSheetFiles, loadAllSheets } from './google-sheets.js';
import { detectCategory, extractDate, CATEGORIES } from './categories.js';
import { unifyHeaders, unifyObject } from './column-map.js';

let cache = null;

async function ensureCache() {
  if (cache) return cache;
  const files = await listSheetFiles();
  const raw = await loadAllSheets(files);
  const meta = files.map(filename => {
    const data = raw[filename] || { headers: [], objects: [] };
    const cat = detectCategory(filename);
    return {
      filename,
      date: extractDate(filename),
      category: cat.cat,
      categoryLabel: CATEGORIES[cat.cat]?.label || 'Прочее',
      subcategory: cat.sub,
      rowCount: data.objects.length,
      headers: unifyHeaders(data.headers),
      _raw: data,
    };
  });
  cache = meta;
  return cache;
}

export async function loadAllMeta() {
  const all = await ensureCache();
  return all.map(({ _raw, ...m }) => m);
}

export async function loadDataByFile(filename) {
  const all = await ensureCache();
  const entry = all.find(e => e.filename === filename);
  const data = entry ? entry._raw : { headers: [], objects: [] };
  return {
    headers: unifyHeaders(data.headers),
    objects: data.objects.map(unifyObject),
  };
}

export function getCategories(meta) {
  const groups = {};
  for (const m of meta) {
    if (!groups[m.category]) groups[m.category] = [];
    groups[m.category].push(m);
  }

  return Object.entries(groups)
    .filter(([key]) => CATEGORIES[key])
    .map(([key, files]) => {
      const catInfo = CATEGORIES[key];
      const subcats = [...new Set(files.map(m => m.subcategory))].map(name => ({
        name,
        files: files.filter(m => m.subcategory === name),
      }));
      return {
        key,
        label: catInfo.label,
        icon: catInfo.icon,
        color: catInfo.color,
        subcategories: subcats,
        fileCount: files.length,
        rowCount: files.reduce((sum, m) => sum + m.rowCount, 0),
      };
    });
}

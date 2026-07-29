import { listCSVFiles, loadCSV } from './parse-csv.js';
import { listSheetFiles, loadSheet } from './google-sheets.js';
import { detectCategory, extractDate, CATEGORIES } from './categories.js';
import { unifyHeaders, unifyObject } from './column-map.js';

const useSheets = !!import.meta.env.GOOGLE_SPREADSHEET_ID;

async function listFiles() {
  return useSheets ? await listSheetFiles() : listCSVFiles();
}

async function loadFile(filename) {
  return useSheets ? await loadSheet(filename) : loadCSV(filename);
}

export async function loadAllMeta() {
  const files = await listFiles();
  return await Promise.all(files.map(async filename => {
    const data = await loadFile(filename);
    const cat = detectCategory(filename);
    return {
      filename,
      date: extractDate(filename),
      category: cat.cat,
      categoryLabel: CATEGORIES[cat.cat]?.label || 'Прочее',
      subcategory: cat.sub,
      rowCount: data.objects.length,
      headers: unifyHeaders(data.headers),
    };
  }));
}

export async function loadDataByFile(filename) {
  const data = await loadFile(filename);
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


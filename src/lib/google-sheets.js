const API_KEY = process.env.GOOGLE_API;
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    if (res.ok) return res;
    if (res.status === 429 && i < retries - 1) {
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      continue;
    }
    const data = await res.json();
    throw new Error(`Google Sheets API: ${data.error?.message || res.statusText}`);
  }
}

export async function listSheetFiles() {
  const url = `${BASE}/${SPREADSHEET_ID}?key=${API_KEY}`;
  const res = await fetchWithRetry(url);
  const data = await res.json();
  return data.sheets
    .map(s => s.properties.title)
    .filter(name => !name.startsWith('_'))
    .sort();
}

export async function loadSheet(sheetName) {
  const range = encodeURIComponent(`${sheetName}!A:Z`);
  const url = `${BASE}/${SPREADSHEET_ID}/values/${range}?key=${API_KEY}`;
  const res = await fetchWithRetry(url);
  const data = await res.json();
  const rows = data.values || [];
  if (rows.length < 2) return { headers: [], objects: [] };
  const headers = rows[0].map(h => String(h).trim());
  const objects = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (row[i] != null ? String(row[i]).trim() : ''); });
    return obj;
  });
  return { headers, objects };
}

export async function loadAllSheets(sheetNames) {
  const ranges = sheetNames.map(n => encodeURIComponent(`${n}!A:Z`)).join('&ranges=');
  const url = `${BASE}/${SPREADSHEET_ID}/values:batchGet?key=${API_KEY}&ranges=${ranges}`;
  const res = await fetchWithRetry(url);
  const data = await res.json();
  const map = {};
  for (const vr of data.valueRanges || []) {
    const range = vr.range.split('!')[0].replace(/'/g, '');
    const rows = vr.values || [];
    if (rows.length < 2) { map[range] = { headers: [], objects: [] }; continue; }
    const headers = rows[0].map(h => String(h).trim());
    const objects = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (row[i] != null ? String(row[i]).trim() : ''); });
      return obj;
    });
    map[range] = { headers, objects };
  }
  return map;
}

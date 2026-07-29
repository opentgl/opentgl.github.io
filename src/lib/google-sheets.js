const API_KEY = import.meta.env.GOOGLE_API;
const SPREADSHEET_ID = import.meta.env.GOOGLE_SPREADSHEET_ID;

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export async function listSheetFiles() {
  const url = `${BASE}/${SPREADSHEET_ID}?key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`Google Sheets API: ${data.error.message}`);
  return data.sheets
    .map(s => s.properties.title)
    .filter(name => !name.startsWith('_'))
    .sort();
}

export async function loadSheet(sheetName) {
  const range = encodeURIComponent(`${sheetName}!A:Z`);
  const url = `${BASE}/${SPREADSHEET_ID}/values/${range}?key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`Google Sheets API: ${data.error.message}`);
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

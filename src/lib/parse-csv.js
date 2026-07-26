import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = join(process.cwd(), 'example.csv');

export function readCSV(filePath) {
  const buf = readFileSync(filePath);
  let text;
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    text = buf.slice(3).toString('utf8');
  } else {
    text = buf.toString('utf8');
    if (text.includes('\uFFFD')) {
      try { text = new TextDecoder('windows-1251').decode(buf); } catch {}
    }
  }
  return text;
}

export function detectDelimiter(text) {
  const firstLine = text.split('\n')[0];
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons >= commas ? ';' : ',';
}

export function parseCSV(text) {
  const delim = detectDelimiter(text);
  const rows = [];
  let current = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delim || ch === ',') {
        if (ch === ',' && delim === ';') { field += ch; continue; }
        current.push(field); field = '';
      }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && next === '\n') i++;
        current.push(field); field = '';
        if (current.some(f => f.trim())) rows.push(current);
        current = [];
      } else field += ch;
    }
  }
  if (field || current.length) { current.push(field); if (current.some(f => f.trim())) rows.push(current); }
  return rows;
}

export function csvToObjects(rows) {
  if (rows.length < 2) return { headers: [], objects: [] };
  const headers = rows[0].map(h => h.trim());
  const objects = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (row[i] || '').trim(); });
    return obj;
  });
  return { headers, objects };
}

export function loadCSV(filename) {
  const text = readCSV(join(DATA_DIR, filename));
  const rows = parseCSV(text);
  return csvToObjects(rows);
}

export function listCSVFiles() {
  return readdirSync(DATA_DIR).filter(f => f.endsWith('.csv')).sort();
}

// parse_stops.js — извлекает уникальные названия остановок из Google Sheets
// Запуск: node parse_stops.js

const fs = require('fs');
const path = require('path');

// ---- .env ----
const env = {};
const envRaw = fs.readFileSync('.env', 'utf8');
for (const line of envRaw.split('\n')) {
  const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2];
}

function toExportUrl(url) {
  const m = url.match(/\/spreadsheets\/d\/([^/]+)/);
  if (!m) return url;
  const key = m[1];
  const gidMatch = url.match(/[#&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  return `https://docs.google.com/spreadsheets/d/${key}/export?format=csv&gid=${gid}`;
}

const SHEET_URL = toExportUrl(env.GOOGLE_SHEET_TILES);
if (!env.GOOGLE_SHEET_TILES) {
  console.error('GOOGLE_SHEET_TILES not found in .env');
  process.exit(1);
}

// ---- CSV parser (same as in index.html) ----
function parseCSV(text) {
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
      else if (ch === ',') { current.push(field); field = ''; }
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

// ---- Route parsing (same logic as index.html) ----
function parseStartEnd(raw) {
  let n = raw.trim();
  if (n.startsWith('*')) n = n.slice(1).trim();
  const qm = n.match(/"([^"]+)"/);
  if (qm) n = qm[1];
  const seps = [' – ', ' - ', '–', ' -', '- ', '-'];
  for (const sep of seps) {
    const parts = n.split(sep).map(s => s.trim()).filter(s => s);
    if (parts.length >= 2) {
      return { start: parts[0], end: parts[parts.length - 1] };
    }
  }
  return { start: n, end: '' };
}

function parseIntermediateStops(text) {
  const cleaned = text.replace(/\([^)]*\)/g, '');
  return cleaned.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

function sectionMatch(a, b, kw) {
  return a.includes(kw) || b.includes(kw) || a.startsWith(kw) || b.startsWith(kw);
}

// ---- Main ----
async function main() {
  console.log('Downloading CSV...');
  const resp = await fetch(SHEET_URL);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const text = await resp.text();

  console.log('Parsing CSV...');
  const csvRows = parseCSV(text);
  const dataRows = csvRows.slice(13);

  const allStops = new Set();

  let currentSection = 'main';
  let inBusGroup = false;

  for (const row of dataRows) {
    const colA = (row[0] || '').trim();
    const colB = (row[1] || '').trim();
    const colC = (row[2] || '').trim();
    const colD = (row[3] || '').trim();
    const colI = (row[8] || '').trim();

    if (sectionMatch(colA, colB, 'Маршруты работают в дни массовых посещений кладбищ')) { currentSection = 'cemetery'; continue; }
    if (sectionMatch(colA, colB, 'Сезонные маршруты')) { currentSection = 'seasonal'; continue; }
    if (sectionMatch(colA, colB, 'Муниципальные маршруты городского наземного электрического транспорта')) { currentSection = 'trolley'; continue; }
    if (currentSection === 'trolley') continue;

    if (!colC || colC === 'Наименование маршрута') continue;
    if (/^\d+$/.test(colA) && /^\d+$/.test(colB) && /^\d+$/.test(colC)) continue;
    if (colA === 'Регистрационный номер маршрута') continue;

    if (colA && /^\d+$/.test(colA)) {
      inBusGroup = colI.includes('Автобус');
      if (!inBusGroup) continue;
    } else if (!inBusGroup) {
      continue;
    }

    const se = parseStartEnd(colC);
    const intermediates = parseIntermediateStops(colD);
    const stops = [se.start, ...intermediates, se.end].filter(s => s.length > 0);
    for (const s of stops) allStops.add(s);
  }

  console.log(`Found ${allStops.size} unique stops`);

  // Write CSV
  const sorted = [...allStops].sort((a, b) => a.localeCompare(b, 'ru'));
  const csvContent = sorted.map(s => `"${s.replace(/"/g, '""')}"`).join('\n');
  const outPath = path.join(__dirname, 'stops.csv');
  fs.writeFileSync(outPath, '\uFEFF' + csvContent, 'utf8');
  console.log(`Saved to ${outPath}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

// Сборка расписаний маршрутов из Google Sheets в JSON.
//
// Запуск:  GOOGLE_API=... GOOGLE_SCHEDULE_ID=... node scripts/build-schedules.js
// Выход:
//   public/data/schedules/index.json          — массив номеров маршрутов, для которых есть расписание
//   public/data/schedules/<номер>.json        — расписание конкретного маршрута
//
// Листы таблицы названы номерами маршрутов («2», «5в», «15в», «93к (Оптовый рынок)» и т.п.).
// Структура листа (колонки с данных начинаются с 1-й, 0-я пустая):
//   row 1: «Маршрут № 2»
//   row 2: «ОП ... - ОП ...»
//   row 3: «Время отправления с начальных пунктов»
//   row 5: «с 01.03.2025 г.»
//   row 6: заголовки дней («Будни», «Выходные», «Суббота», ...)
//   row 8: названия остановок (начальный/конечный пункт на каждый день)
//   row 9+: время отправления; группа дня занимает 2 колонки (начальный и конечный пункт),
//           между группами — пустая колонка-разделитель.

import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'data', 'schedules');
const OUT_INDEX = join(OUT_DIR, 'index.json');

const API_KEY = process.env.GOOGLE_API;
const SPREADSHEET_ID = process.env.GOOGLE_SCHEDULE_ID;
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

if (!API_KEY || !SPREADSHEET_ID) {
  console.error('Set GOOGLE_API and GOOGLE_SCHEDULE_ID env vars.');
  process.exit(1);
}

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

const sleep = ms => new Promise(r => setTimeout(r, ms));

// «№ 15в », «93к (Оптовый рынок) » -> «15в», «93к»
function normalizeNum(raw) {
  return String(raw || '')
    .replace(/\s*\(.*\)\s*$/g, '')
    .replace(/[№#\s]/g, '')
    .trim();
}

function parseSchedule(rows) {
  let title = '', name = '', date = '';
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const v = String(row[c]).trim();
      if (!v) continue;
      if (!title && /Маршрут/i.test(v)) title = v;
      if (!name && /^ОП\b/i.test(v) && /[–—-]/.test(v)) name = v;
      if (!date) {
        const m = v.match(/с\s+(\d{2}\.\d{2}\.\d{4})/i);
        if (m) date = m[1];
      }
    }
  }

  let firstTime = -1;
  for (let r = 0; r < rows.length; r++) {
    if ((rows[r] || []).some(v => /^\d{1,2}:\d{2}/.test(String(v).trim()))) { firstTime = r; break; }
  }
  if (firstTime < 0) return null;

  // Ближайшие непустые строки над первой строкой времени:
  // первая — названия остановок, вторая — заголовки дней.
  const above = [];
  for (let r = firstTime - 1; r >= 0; r--) {
    if ((rows[r] || []).some(v => String(v).trim())) above.push(r);
  }
  if (above.length < 2) return null;
  const stopRow = (rows[above[0]] || []).map(v => String(v).trim());
  const dayRow = (rows[above[1]] || []).map(v => String(v).trim());

  let startCols = [];
  for (let c = 0; c < dayRow.length; c++) if (dayRow[c]) startCols.push(c);
  if (!startCols.length) {
    for (let c = 0; c < stopRow.length; c++) if (stopRow[c]) { startCols.push(c); c++; }
  }

  const groups = startCols.map(sc => ({
    label: dayRow[sc] || 'Расписание',
    startStop: stopRow[sc] || '',
    endStop: stopRow[sc + 1] || '',
    rows: [],
  }));

  for (let r = firstTime; r < rows.length; r++) {
    const row = (rows[r] || []).map(v => String(v).trim());
    if (!row.some(v => /^\d{1,2}:\d{2}/.test(v))) continue;
    groups.forEach((g, gi) => {
      const sc = startCols[gi];
      g.rows.push({ start: row[sc] || '', end: row[sc + 1] || '' });
    });
  }

  // Убираем пустые строки (пусто и в начале, и в конце) — чаще всего это
  // хвост листа после последнего рейса. Пропуски в середине остаются.
  groups.forEach(g => {
    g.rows = g.rows.filter(r => r.start !== '' || r.end !== '');
  });

  const gl = groups
    .filter(g => g.rows.length > 0)
    .map(g => {
      const columns = [];
      if (g.startStop || g.rows.some(r => r.start)) {
        columns.push({ stop: g.startStop || 'Отправление', times: g.rows.map(r => r.start) });
      }
      if (g.endStop || g.rows.some(r => r.end)) {
        columns.push({ stop: g.endStop || 'Отправление', times: g.rows.map(r => r.end) });
      }
      return { label: g.label, columns };
    });
  if (!gl.length) return null;
  return { title, name, date, groups: gl };
}

console.log('Fetching spreadsheet metadata...');
const meta = await fetchWithRetry(`${BASE}/${SPREADSHEET_ID}?key=${API_KEY}`);
const data = await meta.json();
const titles = data.sheets.map(s => s.properties.title);
console.log(`Sheets: ${titles.length}`);

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const index = [];
for (const t of titles) {
  const num = normalizeNum(t);
  const range = encodeURIComponent(`${t}!A:Z`);
  const res = await fetchWithRetry(`${BASE}/${SPREADSHEET_ID}/values/${range}?key=${API_KEY}`);
  const body = await res.json();
  const parsed = parseSchedule(body.values || []);
  if (!parsed) {
    console.log(`skip: ${JSON.stringify(t)} (нет данных)`);
    await sleep(120);
    continue;
  }
  if (index.includes(num)) {
    console.log(`skip: ${JSON.stringify(t)} (дубликат номера ${num})`);
    await sleep(120);
    continue;
  }
  index.push(num);
  writeFileSync(join(OUT_DIR, `${num}.json`), JSON.stringify(parsed));
  console.log(`ok:   ${JSON.stringify(t)} -> ${num}.json (${parsed.groups.length} групп)`);
  await sleep(120);
}

index.sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));
writeFileSync(OUT_INDEX, JSON.stringify(index));
console.log(`index.json: ${index.length} маршрутов`);

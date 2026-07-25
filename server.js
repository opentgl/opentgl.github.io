const fs = require('fs');
const http = require('http');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, 'example.csv');
const PORT = process.env.PORT || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.csv': 'text/csv; charset=utf-8',
};

const CATEGORIES = {
  transport: { label: 'Транспорт', icon: 'bus', color: '#0d6efd' },
  culture: { label: 'Культура', icon: 'landmark', color: '#6f42c1' },
  education: { label: 'Образование', icon: 'graduation-cap', color: '#198754' },
  sport: { label: 'Спорт', icon: 'dumbbell', color: '#fd7e14' },
  healthcare: { label: 'Здравоохранение', icon: 'heart-pulse', color: '#dc3545' },
  social: { label: 'Социальная поддержка', icon: 'hand-heart', color: '#e83e8c' },
  landmarks: { label: 'Достопримечательности', icon: 'map-pin', color: '#20c997' },
  directory: { label: 'Справочная', icon: 'phone', color: '#6610f2' },
  realty: { label: 'Недвижимость', icon: 'building', color: '#17a2b8' },
  infrastructure: { label: 'Инфраструктура', icon: 'zap', color: '#ffc107' },
};

const FILE_CATEGORY = [
  { pattern: 'marshryti_avtobusov', cat: 'transport', sub: 'Автобусные маршруты' },
  { pattern: 'marshryti_trolleybusov', cat: 'transport', sub: 'Троллейбусные маршруты' },
  { pattern: 'marshryti_kommerch', cat: 'transport', sub: 'Коммерческие маршруты' },
  { pattern: 'kulturnoe_nasledie_a_', cat: 'culture', sub: 'Особо ценные объекты' },
  { pattern: 'kulturnoe_nasledie', cat: 'culture', sub: 'Объекты культурного наследия' },
  { pattern: 'biblioteki', cat: 'culture', sub: 'Библиотеки' },
  { pattern: 'muzei', cat: 'culture', sub: 'Музеи' },
  { pattern: 'teatri', cat: 'culture', sub: 'Театры' },
  { pattern: 'dosug', cat: 'culture', sub: 'Досуг' },
  { pattern: 'obsheobrazovatelnie', cat: 'education', sub: 'Школы' },
  { pattern: 'dopolnitelnogo_obrazovaniya', cat: 'education', sub: 'Дополнительное образование' },
  { pattern: 'doshcolnogo_obrazovaniya', cat: 'education', sub: 'Дошкольное образование' },
  { pattern: 'basseyny', cat: 'sport', sub: 'Бассейны' },
  { pattern: 'sportivnye-shkoly', cat: 'sport', sub: 'Спортивные школы' },
  { pattern: 'fizkul', cat: 'sport', sub: 'Физкультурные организации' },
  { pattern: 'zdravoohraneniya', cat: 'healthcare', sub: 'Учреждения здравоохранения' },
  { pattern: 'soc-podderzhka', cat: 'social', sub: 'Социальная поддержка' },
  { pattern: 'znakovye-i-socialno-znachimye-mesta', cat: 'landmarks', sub: 'Знаковые места' },
  { pattern: 'phonebook_employees', cat: 'directory', sub: 'Сотрудники' },
  { pattern: 'phonebook_organizations', cat: 'directory', sub: 'Организации' },
  { pattern: 'taksofony', cat: 'infrastructure', sub: 'Таксофоны' },
  { pattern: 'zemelnye-uchastki', cat: 'realty', sub: 'Земельные участки' },
  { pattern: 'nezhilye-zdaniya', cat: 'realty', sub: 'Нежилые помещения' },
  { pattern: 'nezavershennogo-stroitelstva', cat: 'realty', sub: 'Объекты строительства' },
  { pattern: 'inzhenernoy-infrastruktura', cat: 'infrastructure', sub: 'Инженерная инфраструктура' },
];

function detectCategory(filename) {
  const f = filename.toLowerCase();
  for (const entry of FILE_CATEGORY) {
    if (f.includes(entry.pattern)) return entry;
  }
  return { cat: 'infrastructure', sub: filename.replace(/_file_\d+\.csv$/, '').replace(/^\d{4}[_-]\d{2}[_-]\d{2}[_-]?/, '').replace(/_/g, ' ') };
}

function extractDate(filename) {
  const m = filename.match(/(\d{4})[_-](\d{2})[_-](\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

function readCSV(filePath) {
  const raw = fs.readFileSync(filePath);
  try {
    const utf8 = iconvDecode(raw);
    return utf8.charCodeAt(0) === 0xFEFF ? utf8.slice(1) : utf8;
  } catch {
    return raw.toString('utf8');
  }
}

function iconvDecode(buf) {
  try {
    return execSync('iconv -f cp1251 -t utf8', { input: buf, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  } catch {
    return buf.toString('utf8');
  }
}

function detectDelimiter(text) {
  const firstLine = text.split('\n')[0];
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons >= commas ? ';' : ',';
}

function parseCSV(text) {
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
        if (ch === ',' && delim === ';' && !inQuotes) { field += ch; continue; }
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

function csvToObjects(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (row[i] || '').trim(); });
    return obj;
  });
}

function scanCSVFiles() {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.csv'));
  return files.map(f => {
    const fullPath = path.join(DATA_DIR, f);
    const stat = fs.statSync(fullPath);
    const date = extractDate(f);
    const cat = detectCategory(f);
    return {
      filename: f,
      date,
      category: cat.cat,
      categoryLabel: CATEGORIES[cat.cat]?.label || 'Прочее',
      subcategory: cat.sub,
      size: stat.size,
      mtime: stat.mtime,
    };
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (pathname === '/api/csvs') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(scanCSVFiles()));
    return;
  }

  const csvMatch = pathname.match(/^\/api\/csv\/(.+)/);
  if (csvMatch) {
    const filename = decodeURIComponent(csvMatch[1]);
    const filePath = path.join(DATA_DIR, filename);
    if (!filePath.startsWith(DATA_DIR) || !fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    try {
      const text = readCSV(filePath);
      const rows = parseCSV(text);
      const objects = csvToObjects(rows);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ headers: rows[0] || [], rows: rows, objects }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  const rootFiles = ['favicon.svg', 'geo.json', '.env.example'];
  let filePath;
  if (pathname === '/') {
    filePath = path.join(__dirname, 'public', 'index.html');
  } else {
    const base = path.basename(pathname);
    if (rootFiles.includes(base)) {
      filePath = path.join(__dirname, base);
    } else {
      filePath = path.join(__dirname, 'public', pathname.replace(/^\//, ''));
    }
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath);
  const data = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  res.end(data);
});

server.listen(PORT, () => {
  console.log(`OpenTGL Server: http://localhost:${PORT}`);
});
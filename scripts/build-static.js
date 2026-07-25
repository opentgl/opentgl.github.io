const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'example.csv');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_OUT = path.join(PUBLIC_DIR, 'data');
const CSV_OUT = path.join(DATA_OUT, 'csv');

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
  return {
    cat: 'infrastructure',
    sub: filename.replace(/_file_\d+\.csv$/, '').replace(/^\d{4}[_-]\d{2}[_-]\d{2}[_-]?/, '').replace(/_/g, ' ')
  };
}

function extractDate(filename) {
  const m = filename.match(/(\d{4})[_-](\d{2})[_-](\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function readCSV(filePath) {
  const buf = fs.readFileSync(filePath);
  let text;
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    text = buf.slice(3).toString('utf8');
  } else {
    text = buf.toString('utf8');
    if (text.includes('\uFFFD')) {
      try {
        text = new TextDecoder('windows-1251').decode(buf);
      } catch {
      }
    }
  }
  return text;
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
  if (rows.length < 2) return { headers: [], rows: [], objects: [] };
  const headers = rows[0].map(h => h.trim());
  const objects = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (row[i] || '').trim(); });
    return obj;
  });
  return { headers, rows: rows, objects };
}

function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      if (f === '.gitkeep') continue;
      fs.rmSync(path.join(dir, f), { recursive: true, force: true });
    }
  }
}

function build() {
  console.log('Building static data from CSVs...');

  fs.mkdirSync(CSV_OUT, { recursive: true });

  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.csv'));
  console.log(`Found ${files.length} CSV files`);

  const csvMeta = [];

  for (const filename of files) {
    const filePath = path.join(DATA_DIR, filename);
    const stat = fs.statSync(filePath);
    const date = extractDate(filename);
    const cat = detectCategory(filename);

    const meta = {
      filename,
      date,
      category: cat.cat,
      categoryLabel: CATEGORIES[cat.cat]?.label || 'Прочее',
      subcategory: cat.sub,
      size: stat.size,
      mtime: stat.mtime,
    };
    csvMeta.push(meta);

    const text = readCSV(filePath);
    const rows = parseCSV(text);
    const parsed = csvToObjects(rows);

    const jsonFilename = filename.replace(/\.csv$/i, '') + '.json';
    const safeName = jsonFilename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    fs.writeFileSync(path.join(CSV_OUT, safeName), JSON.stringify(parsed), 'utf8');
    console.log(`  ${filename} → data/csv/${safeName} (${parsed.objects.length} rows)`);
  }

  fs.writeFileSync(path.join(DATA_OUT, 'csvs-meta.json'), JSON.stringify(csvMeta), 'utf8');
  console.log(`Wrote data/csvs-meta.json (${csvMeta.length} entries)`);

  const faviconSrc = path.join(ROOT, 'favicon.svg');
  const faviconDst = path.join(PUBLIC_DIR, 'favicon.svg');
  if (fs.existsSync(faviconSrc) && !fs.existsSync(faviconDst)) {
    fs.copyFileSync(faviconSrc, faviconDst);
    console.log('Copied favicon.svg to public/');
  }

  console.log('Build complete.');
}

build();

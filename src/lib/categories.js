export const CATEGORIES = {
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

export const FILE_CATEGORY = [
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

export function detectCategory(filename) {
  const f = filename.toLowerCase();
  for (const entry of FILE_CATEGORY) {
    if (f.includes(entry.pattern)) return entry;
  }
  return {
    cat: 'infrastructure',
    sub: filename
      .replace(/_file_\d+\.csv$/, '')
      .replace(/^\d{4}[_-]\d{2}[_-]\d{2}[_-]?/, '')
      .replace(/_/g, ' ')
      .trim(),
  };
}

export function extractDate(filename) {
  const m = filename.match(/(\d{4})[_-](\d{2})[_-](\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

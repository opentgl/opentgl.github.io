// Нормализация адресов и названий учреждений для геокодирования.
//
// Модуль намеренно не зависит от Astro/Vite: его используют и во время
// статической сборки (src/lib/geo.js), и в отдельном скрипте
// scripts/geocode-addresses.mjs. Поэтому здесь только чистые функции.

const STREET_TYPE_ALIASES = new Map([
  ['ул', 'улица'],
  ['улица', 'улица'],
  ['б-р', 'бульвар'],
  ['б-л', 'бульвар'],
  ['б-ром', 'бульвар'],
  ['бульвар', 'бульвар'],
  ['пр-т', 'проспект'],
  ['пр-кт', 'проспект'],
  ['пр', 'проспект'],
  ['проспект', 'проспект'],
  ['пл', 'площадь'],
  ['площадь', 'площадь'],
  ['ш', 'шоссе'],
  ['шоссе', 'шоссе'],
  ['пер', 'переулок'],
  ['переулок', 'переулок'],
  ['наб', 'набережная'],
  ['набережная', 'набережная'],
  ['проезд', 'проезд'],
  ['пр-д', 'проезд'],
  ['туп', 'тупик'],
  ['тупик', 'тупик'],
  ['мкр', 'микрорайон'],
  ['микрорайон', 'микрорайон'],
]);

const STREET_TYPE_RE = new RegExp(
  `(^|[\\s,])(${[...STREET_TYPE_ALIASES.keys()]
    .sort((a, b) => b.length - a.length)
    .join('|')})(?:\\.\\s*|\\s+)`,
  'g',
);

const STREET_TYPE_WORDS = new Set(STREET_TYPE_ALIASES.values());

const REGION_WORDS_RE =
  /(самарская\s+(?:область|обл\.?)|г\.?\s*о\.?\s*тольятти|г\.?\s*тольятти|тольятти|россия|рф)/g;

const DISTRICT_WORDS_RE =
  /(автозаводский|центральный|комсомольский|ставропольский)\s+район/g;

const OUT_OF_CITY_RE = /(жигулевск|жигули|солнечная\s+поляна|бахилово|мусорка|с\.\s+|село\s+)/;

const ORG_FORMS_RE =
  /(муниципальное|бюджетное|автономное|казенное|общеобразовательное|учреждение|учреждения|городского|округа|тольятти|россии|рф|мбу|мбдоу|мбдо|маоу|мадоу|мау|мбоу|мкоу|ано|оу|до)/g;

const ORG_TYPES = [
  'детский сад',
  'школа-интернат',
  'школа интернат',
  'школа',
  'лицей',
  'гимназия',
  'центр',
  'дворец',
  'дом',
  'станция',
  'студия',
  'клуб',
  'академия',
  'училище',
  'колледж',
  'интернат',
];

/** Приводит строку к единому виду: нижний регистр, ё → е, без лишних пробелов. */
export function normalizeText(value) {
  return String(value ?? '')
    .replace(/ё/g, 'е')
    .replace(/Ё/g, 'Е')
    .replace(/[«»"'“”„]/g, ' ')
    .replace(/[‐‑–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Нормализует номер дома: «д. 27А», «здание 8а», «25 с5» → «27а», «8а», «25с5». */
export function normalizeHouse(value) {
  return normalizeText(value)
    .replace(/(?:^|\s)(?:дом|д|здание|зд|строение|стр|корпус|корп|к)\.?\s*/g, '')
    .replace(/^№\s*/, '')
    .replace(/\s+/g, '')
    .replace(/[.,;]+$/g, '');
}

function baseHouse(house) {
  const h = String(house || '');
  const m = h.match(/^(\d+)([а-яa-z])?/);
  if (!m) return '';
  // «25с5», «12к1» — это корпус/строение. Базовый дом для таких адресов — «25»/«12».
  if (/^\d/.test(h.slice(m[0].length))) return m[1];
  return m[0];
}

/**
 * Разбирает свободный адрес на улицу и дом.
 * Возвращает null, если адрес не похож на обычный городской адрес
 * (описание территории, кадастровый номер и т.п.).
 */
export function parseAddress(raw) {
  let s = normalizeText(raw);

  // В некоторых ячейках сначала идёт юридический адрес, а затем фактический.
  // Для карты нужен именно фактический.
  const actual = s.match(/местоположение\s*:?\s*(.+)$/);
  if (actual) s = actual[1];
  else s = s.replace(/юридический\s+адрес\s*:?\s*/, '');

  // Отсекаем заведомо чужие города/районы, чтобы не поставить точку в Тольятти.
  if (!/тольятти/.test(s) && OUT_OF_CITY_RE.test(s)) return null;
  if (/жигулевск|солнечная\s+поляна|бахилово|мусорка/.test(s)) return null;

  s = s.replace(/\b\d{6}\b/g, ' ');
  s = s.replace(REGION_WORDS_RE, ' ');
  s = s.replace(DISTRICT_WORDS_RE, ' ');
  s = s.replace(/пос\.?\s+(федоровка|поволжский)/g, ' ');

  // Берём первый адрес из перечисления и отбрасываем кабинеты/этажи/литералы.
  s = s.split(/[;()]/)[0];
  s = s.split(/(?:^|[\s,])(?:каб|офис|этаж|эт|помещение|пом|квартира|кв)\.?\s*\d/)[0];
  s = s.replace(/кадастров\w*.*$/g, ' ');
  s = s.replace(/(?:литера|лит\.?)\s*[а-яa-z0-9-]+/g, ' ');

  // «ул.Лесная» → «ул Лесная», «б-р.Ленина» → «б-р Ленина».
  s = s.replace(STREET_TYPE_RE, '$1$2 ');
  // Убираем случайные повторы типа: «ул. ул. Революционная».
  s = s.replace(/(^|[\s,])((?:ул|б-р|пр-т|пр|пл|ш|пер|наб|проезд|туп|мкр))\s+(?=\2\s)/g, '$1');

  s = s.replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').trim();
  if (!s) return null;

  const parts = s.split(', ').filter(Boolean);
  let street = null;
  let house = null;

  for (let i = 0; i < parts.length; i++) {
    const words = parts[i].replace(/[.,]+$/g, '').split(' ').filter(Boolean);
    if (!words.length) continue;

    const first = words[0].replace(/[.,]+$/g, '');
    const last = words[words.length - 1].replace(/[.,]+$/g, '');

    const typeFirst = STREET_TYPE_ALIASES.get(first);
    const typeLast = STREET_TYPE_ALIASES.get(last);

    if (typeFirst && words.length > 1) {
      const rest = words.slice(1).join(' ');
      const m = rest.match(/^(.*?)\s+(\d+[а-яa-z]?(?:[/-]\d+[а-яa-z]?)?)$/);
      street = { type: typeFirst, name: m ? m[1] : rest };
      house = m ? m[2] : extractHouse(parts[i + 1]);
      break;
    }

    if (typeLast && words.length > 1) {
      street = { type: typeLast, name: words.slice(0, -1).join(' ') };
      house = extractHouse(parts[i + 1]);
      if (!house) {
        const m = street.name.match(/^(.*?)\s+(\d+[а-яa-z]?)$/);
        if (m) {
          street.name = m[1];
          house = m[2];
        }
      }
      break;
    }

    // Адрес без типа улицы: «Белорусская 33», «Солнечная, 5».
    if (words.length >= 2) {
      const m = parts[i].match(/^(.*?)\s+(\d+[а-яa-z]?(?:[/-]\d+[а-яa-z]?)?)$/);
      if (m) {
        street = { type: '', name: m[1] };
        house = m[2];
        break;
      }
    }
    if (words.length >= 1 && extractHouse(parts[i + 1])) {
      street = { type: '', name: parts[i] };
      house = extractHouse(parts[i + 1]);
      break;
    }
  }

  if (!street || !street.name || !house) return null;

  const name = normalizeStreetName(street.name);
  if (!name) return null;

  return {
    type: street.type,
    name,
    house: normalizeHouse(house),
    baseHouse: baseHouse(normalizeHouse(house)),
  };
}

function extractHouse(value) {
  if (!value) return null;
  const s = normalizeText(value)
    .replace(/(?:^|\s)(?:дом|д|здание|зд|строение|стр|корпус|корп|к)\.?\s*/g, ' ')
    .trim();
  const m = s.match(/^(?:№\s*)?(\d+[а-яa-z]?(?:[/-]\d+[а-яa-z]?)?)/);
  return m ? m[1] : null;
}

/** Канонизирует название улицы: убирает инициалы, лишние слова и пунктуацию. */
export function normalizeStreetName(value) {
  let s = normalizeText(value)
    .replace(/(?:^|\s)(?:имени|им)(?=\s|$)/g, ' ')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // «2-я Набережная» и «2-ая Набережная» → «2 набережная»,
  // чтобы совпадать с вариантами OSM.
  s = s.replace(/^(\d+)\s*[- ]?\s*(?:я|ая|й|ий|ой)(?=\s|$)/, '$1');

  // «ул ул Революционная» → «революционная».
  s = s.replace(/^(?:ул|улица|б-р|бульвар|пр-т|пр-кт|пр|проспект|пл|площадь|ш|шоссе|пер|переулок|наб|набережная|проезд|туп|тупик)\s+/, '');

  // Сокращения, которые часто встречаются в выгрузках.
  s = s
    .replace(/^м\s+жукова$/, 'маршала жукова')
    .replace(/^к\s+маркса$/, 'карла маркса')
    .replace(/^ст\s+разина$/, 'степана разина')
    .replace(/^л\s+толстого$/, 'льва толстого')
    .replace(/^л\s+чайкиной$/, 'лизы чайкиной')
    .replace(/^м\s+горького$/, 'максима горького');

  return s.replace(/\s+/g, ' ').trim();
}

function canonicalStreet(osmStreet) {
  const s = normalizeText(osmStreet);
  const words = s.split(' ').filter(Boolean);
  if (words.length < 2) return { type: '', name: s };

  const first = words[0].replace(/[.,]+$/g, '');
  const last = words[words.length - 1].replace(/[.,]+$/g, '');

  if (STREET_TYPE_ALIASES.has(first)) {
    return {
      type: STREET_TYPE_ALIASES.get(first),
      name: normalizeStreetName(words.slice(1).join(' ')),
    };
  }
  if (STREET_TYPE_ALIASES.has(last)) {
    return {
      type: STREET_TYPE_ALIASES.get(last),
      name: normalizeStreetName(words.slice(0, -1).join(' ')),
    };
  }
  return { type: '', name: normalizeStreetName(s) };
}

function lastWord(name) {
  const words = String(name || '').split(' ').filter(Boolean);
  return words.length ? words[words.length - 1] : '';
}

/**
 * Строит индекс адресных точек OSM.
 * @param {Array<{lat?:number, lon?:number, center?:{lat:number,lon:number}, tags?:Record<string,string>}>} elements
 */
export function buildOsmIndex(elements) {
  const exact = new Map();
  const byName = new Map();
  const bySurname = new Map();

  for (const el of elements || []) {
    const tags = el.tags || {};
    const street = tags['addr:street'];
    const rawHouse = tags['addr:housenumber'];
    if (!street || !rawHouse) continue;

    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const { type, name } = canonicalStreet(street);
    if (!name) continue;

    const house = normalizeHouse(rawHouse);
    if (!house) continue;
    const base = baseHouse(house);
    const point = { lat, lon };

    add(exact, `${type}|${name}|${house}`, point);
    add(exact, `${type}|${name}|${base}`, point);
    add(byName, `${name}|${house}`, point);
    add(byName, `${name}|${base}`, point);

    const surname = lastWord(name);
    if (surname) {
      add(bySurname, `${surname}|${house}`, point);
      add(bySurname, `${surname}|${base}`, point);
    }
  }

  return { exact, byName, bySurname, points: elements?.length || 0 };
}

function add(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  const list = map.get(key);
  if (!list.some(p => p.lat === value.lat && p.lon === value.lon)) list.push(value);
}

/**
 * Ищет координаты адреса в индексе OSM.
 * @returns {{lat:number, lon:number}|null}
 */
export function findOsmCoords(index, rawAddress) {
  const addr = parseAddress(rawAddress);
  if (!addr) return null;
  if (!index) return null;

  const houses = [addr.house, addr.baseHouse].filter(Boolean);
  const streetKeys = [addr.name, lastWord(addr.name)].filter(Boolean);

  for (const house of houses) {
    const exact = index.exact.get(`${addr.type}|${addr.name}|${house}`);
    if (exact?.length) return exact[0];
    const byName = index.byName.get(`${addr.name}|${house}`);
    if (byName?.length) return byName[0];
  }

  // Запасной вариант: фамилия в названии улицы. Помогает для
  // «ул. М. Жукова» → «улица Маршала Жукова», «ул. Л. Чайкиной» и т.п.
  for (const streetKey of streetKeys) {
    for (const house of houses) {
      const bySurname = index.bySurname.get(`${streetKey}|${house}`);
      if (bySurname?.length) return bySurname[0];
    }
  }

  return null;
}

/** Ключ кэша: нормализованная строка адреса, по которой скрипт сохранил координаты. */
export function addressCacheKey(rawAddress) {
  return normalizeText(rawAddress).replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Сопоставление учреждений образования с телефонным справочником
// ---------------------------------------------------------------------------

/**
 * Уточняет вид учреждения. Нужен, чтобы «Школа № 1» не склеивалась
 * с «Детской художественной школой № 1» или «Спортивной школой № 1».
 */
function detectOrganizationKind(source) {
  if (/детский\s+сад/.test(source)) return 'kindergarten';
  if (/школа[\s-]*интернат/.test(source)) return 'school_boarding';
  if (/школа\s+искусств|художественн/.test(source)) return 'school_art';
  if (/музыкальн/.test(source)) return 'school_music';
  if (/спортивн/.test(source)) return 'school_sport';
  if (/лицей/.test(source)) return 'lyceum';
  if (/гимназия/.test(source)) return 'gymnasium';
  if (/общеобразовательн|средн(?:яя|ее)\s+школа/.test(source)) return 'school_general';
  if (/школа/.test(source)) return 'school_general';
  if (/детский\s+дом/.test(source)) return 'orphanage';
  if (/дом\s+детского\s+творчества|дом\s+творчества/.test(source)) return 'children_creative';
  if (/дворец/.test(source)) return 'palace';
  if (/центр/.test(source)) return 'center';
  if (/академия/.test(source)) return 'academy';
  if (/училище|колледж/.test(source)) return 'college';
  if (/студия/.test(source)) return 'studio';
  if (/клуб/.test(source)) return 'club';
  if (/станция/.test(source)) return 'station';
  return '';
}

function nameFeatures(name) {
  const rawSource = String(name ?? '');
  const quoted = [...rawSource.matchAll(/[«"]([^»"]+)[»"]/g)]
    .map(m => normalizeText(m[1]))
    .filter(Boolean);

  const source = normalizeText(rawSource);
  const kind = detectOrganizationKind(source);
  let s = source.replace(/[«"][^»"]*[»"]/g, ' ');
  s = s.replace(ORG_FORMS_RE, ' ');
  s = s.replace(/[.,;:()]/g, ' ').replace(/\s+/g, ' ').trim();

  let type = '';
  for (const t of ORG_TYPES) {
    if (s.includes(t)) {
      type = t.replace('-', ' ');
      s = s.replace(t, ' ');
      break;
    }
  }

  const numberMatch = s.match(/(?:№|номер)?\s*(\d+)/);
  const number = numberMatch ? numberMatch[1] : '';
  s = s.replace(/(?:№|номер)?\s*\d+/g, ' ');

  const stop = new Set([
    'детский', 'сад', 'школа', 'интернат', 'лицей', 'гимназия', 'центр',
    'дворец', 'дом', 'станция', 'студия', 'клуб', 'академия', 'училище',
    'колледж', 'имени', 'героя', 'советского', 'союза', 'по', 'и',
  ]);

  const tokens = s
    .split(' ')
    .map(t => t.trim())
    .filter(t => t.length >= 3 && !stop.has(t));

  return {
    norm: source,
    kind,
    type,
    number,
    quoted,
    tokens,
  };
}

/**
 * Строит индекс организаций из телефонного справочника.
 * @param {Array<{name:string,address:string}>} organizations
 */
export function buildOrgIndex(organizations) {
  const byKindNumber = new Map();
  const byTypeNumber = new Map();
  const byQuoted = new Map();
  const byTokens = new Map();
  const seen = new Set();

  for (const org of organizations || []) {
    const name = org.name || '';
    const address = (org.address || '').trim();
    if (!name || !address) continue;

    const dedupeKey = `${normalizeText(name)}|${normalizeText(address)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const f = nameFeatures(name);
    const value = { name, address, features: f };

    if (f.kind && f.number) addOrg(byKindNumber, `${f.kind}|${f.number}`, value);
    if (f.type && f.number) addOrg(byTypeNumber, `${f.type}|${f.number}`, value);
    for (const q of f.quoted) addOrg(byQuoted, q, value);
    for (const token of f.tokens) addOrg(byTokens, token, value);
  }

  return { byKindNumber, byTypeNumber, byQuoted, byTokens };
}

function addOrg(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  const list = map.get(key);
  if (!list.some(x => x.address === value.address && x.name === value.name)) {
    list.push(value);
  }
}

function uniqueAddress(list) {
  if (!list?.length) return null;
  const addresses = [...new Set(list.map(x => x.address))];
  return addresses.length === 1 ? list[0] : null;
}

/**
 * Ищет адрес учреждения по названию.
 * Сначала пробуем тип + номер, затем кавычное название, затем редкие слова.
 * Возвращает null, если совпадение неоднозначно.
 */
export function matchOrganizationAddress(name, index) {
  if (!index) return null;
  const f = nameFeatures(name);

  // Для школ/садиков сначала используем уточнённый вид. Общий fallback
  // по типу здесь опасен: «Школа № 1» иначе может совпасть с художественной
  // или спортивной школой № 1.
  if (f.kind && f.number) {
    const found = uniqueAddress(index.byKindNumber.get(`${f.kind}|${f.number}`));
    if (found) return found;
  } else if (f.type && f.number) {
    const found = uniqueAddress(index.byTypeNumber.get(`${f.type}|${f.number}`));
    if (found) return found;
  }

  for (const q of f.quoted) {
    const found = uniqueAddress(index.byQuoted.get(q));
    if (found) return found;
  }

  // Последний шанс — редкие слова названия. Даже одного слова достаточно,
  // если оно встречается ровно у одной организации («Эдельвейс», «Гранит»,
  // «Королёва»). Для распространённых слов кандидатов будет несколько.
  if (f.tokens.length >= 1) {
    let candidates = null;
    for (const token of f.tokens) {
      const list = index.byTokens.get(token) || [];
      if (!list.length) {
        candidates = null;
        break;
      }
      const keys = new Set(list.map(x => `${x.name}|${x.address}`));
      if (candidates === null) candidates = keys;
      else candidates = new Set([...candidates].filter(k => keys.has(k)));
    }
    if (candidates?.size === 1) {
      const [key] = candidates;
      const [orgName, ...rest] = key.split('|');
      return { name: orgName, address: rest.join('|') };
    }
  }

  return null;
}

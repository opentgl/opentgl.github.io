const COLUMN_ALIASES = [
  { match: /^№\s*п\/п$|^N\s*п\/п$|^№п\/п$|^№$|^n\/n$/i, target: '№' },
  { match: /наименован|название|name|title/i, target: 'Наименование' },
  { match: /email|e-mail|e_mail|электронн(ая|ый)|почт/i, target: 'Email' },
  { match: /руководител|директор|director|fio|фио/i, target: 'Руководитель' },
  { match: /телефон|телефоны|phone|phonenumber|\bтел\.?\b/i, target: 'Телефон' },
  { match: /сайт|web|website|url|веб/i, target: 'Сайт' },
  { match: /адрес|address|местонахожд|местополож/i, target: 'Адрес' },
  { match: /кадастров/i, target: 'Кадастровый номер' },
  { match: /площадь|square|area/i, target: 'Площадь' },
  { match: /протяженность|length|длина/i, target: 'Протяжённость' },
  { match: /ширина|width/i, target: 'Ширина' },
  { match: /регистрационн.*номер|номер.*реестр/i, target: 'Номер в реестре' },
  { match: /вид.*объект|тип/i, target: 'Вид объекта' },
  { match: /категори/i, target: 'Категория' },
  { match: /примечан|note|comment/i, target: 'Примечание' },
  { match: /контакт/i, target: 'Контакты' },
  { match: /отдел|departament|department|division|подраздел/i, target: 'Отдел' },
  { match: /должность|post|должн/i, target: 'Должность' },
  { match: /маршрут/i, target: 'Маршрут' },
  { match: /регистрационн.*номер\s*маршрута/i, target: 'Номер маршрута' },
  { match: /порядков.*номер/i, target: '№ п/п' },
  { match: /транспорт|тс|класс\s*тс/i, target: 'Транспортное средство' },
  { match: /экологи/i, target: 'Экология' },
  { match: /дата/i, target: 'Дата' },
];

export function unifyHeader(header) {
  const trimmed = header.trim();
  for (const alias of COLUMN_ALIASES) {
    if (alias.match.test(trimmed)) return alias.target;
  }
  return trimmed;
}

export function unifyHeaders(headers) {
  return headers.map(unifyHeader);
}

export function unifyObject(obj) {
  const unified = {};
  for (const [key, value] of Object.entries(obj)) {
    unified[unifyHeader(key)] = value;
  }
  return unified;
}

export function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function formatDate(dateStr) {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateStr;
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return `${parseInt(m[3])} ${months[parseInt(m[2])-1]} ${m[1]} года`;
}

export function detectLinkType(key, value) {
  const k = key.toLowerCase().trim();
  const v = String(value || '').trim();

  // 1. Email — первый приоритет (даже если в названии есть "адрес")
  if (k.includes('почта') || k.includes('email') || k.includes('e-mail') || k.includes('e_mail') || k.includes('e mail') || k.includes('электронной почты') || k.includes('электронного')) return 'email';

  // 2. Phone — второй приоритет
  if (k.includes('телефон') || k.includes('phone') || k.includes('телефонный') || k === 'тел' || k === 'тел.' || k.includes('контакт') || k.includes('контактная информация') || k.includes('контактный')) return 'phone';

  // 3. URL — третий приоритет
  if (k.includes('url') || k.includes('сайт') || k.includes('web') || k.includes('website') || k.includes('ссылка')) return 'url';

  // 4. Address — четвёртый приоритет (только если не похоже на почту)
  if (k.includes('адрес') || k.includes('address') || k.includes('местополож') || k.includes('местонахожд')) return 'address';

  // Fallback: если значение выглядит как email, даже без имени столбца
  if (v.includes('@') && v.includes('.')) return 'email';
  // Fallback: если значение выглядит как телефон
  if (/^\+?[\d\s\-()]{7,}$/.test(v.replace(/[,;].*/, ''))) return 'phone';

  return null;
}

export function renderFieldLink(key, value) {
  const type = detectLinkType(key, value);
  if (!type) return escapeHtml(String(value || ''));

  const raw = String(value || '').trim();
  if (!raw) return '<span class="text-muted">—</span>';

  switch (type) {
    case 'email': {
      const emails = raw.split(/[,;]/).map(e => e.trim()).filter(e => e.length > 0);
      if (emails.length === 1) {
        return `<a href="mailto:${escapeHtml(emails[0])}" class="text-decoration-none">${escapeHtml(emails[0])}</a>`;
      }
      return emails.map(e => `<a href="mailto:${escapeHtml(e)}" class="d-block text-decoration-none small">${escapeHtml(e)}</a>`).join('');
    }
    case 'phone': {
      const phones = raw.split(/[,;]/).map(p => p.trim()).filter(p => p.length > 0);
      if (phones.length === 1) {
        const digits = phones[0].replace(/\D/g, '');
        return digits ? `<a href="tel:${digits}" class="text-decoration-none">${escapeHtml(phones[0])}</a>` : escapeHtml(phones[0]);
      }
      return phones.map(p => {
        const digits = p.replace(/\D/g, '');
        return digits ? `<a href="tel:${digits}" class="d-block text-decoration-none small">${escapeHtml(p)}</a>` : escapeHtml(p);
      }).join('');
    }
    case 'url': {
      const url = raw.startsWith('http') ? raw : 'https://' + raw;
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="text-decoration-none">${escapeHtml(raw)}</a>`;
    }
    case 'address': {
      const encoded = encodeURIComponent(raw);
      return `<a href="https://2gis.ru/togliatti/search/${encoded}" target="_blank" rel="noopener" class="text-decoration-none">${escapeHtml(raw)}</a>`;
    }
    default:
      return escapeHtml(raw);
  }
}
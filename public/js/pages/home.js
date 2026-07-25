import { state } from '../state.js';
import { formatDate } from '../utils.js';

export async function renderHome(container) {
  container.innerHTML = '<div class="d-flex justify-content-center align-items-center py-5 text-muted"><div class="spinner-border spinner-border-sm me-2"></div> Загрузка...</div>';

  const byDate = {};
  state.csvs.forEach(c => {
    const d = c.date || 'без даты';
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(c);
  });

  const dates = Object.keys(byDate).sort((a, b) => {
    if (a === 'без даты') return 1;
    if (b === 'без даты') return -1;
    return b.localeCompare(a);
  });

  let html = `
    <div class="text-white p-0 p-md-1 mb-4">
      <div class="d-flex gap-2 flex-wrap">
        <span class="badge bg-primary bg-opacity-75 fs-6">${state.csvs.length} файлов</span>
        <span class="badge bg-success bg-opacity-75 fs-6">${dates.filter(d => d !== 'без даты').length} дат</span>
        <span class="badge bg-info bg-opacity-75 fs-6">${Object.keys(state.categoryMeta).length} категорий</span>
      </div>
    </div>`;

  for (const date of dates) {
    const items = byDate[date];
    const byCat = {};
    items.forEach(i => {
      if (!byCat[i.category]) byCat[i.category] = [];
      byCat[i.category].push(i);
    });

    const dateLabel = date === 'без даты' ? 'Без даты' : formatDate(date);

    html += `
      <div class="mb-4">
        <div class="d-flex align-items-center gap-2 mb-3">
          <span class="badge bg-dark fs-6">${dateLabel}</span>
          <small class="text-muted">${items.length} записей</small>
        </div>
        <div class="row g-3">`;

    for (const [cat, fileList] of Object.entries(byCat)) {
      const meta = state.categoryMeta[cat] || { label: 'Прочее', icon: 'file-text', color: '#6c757d' };
      html += `
          <div class="col-sm-6 col-lg-4 col-xl-3">
            <div class="card h-100 border-0 shadow-sm" style="cursor:pointer;" onclick="window.navigate('category/${cat}')">
              <div class="card-body">
                <div class="d-flex align-items-center mb-2">
                  <span class="badge me-2" style="background:${meta.color};">
                    <i data-lucide="${meta.icon}" style="width:14px;height:14px;"></i>
                  </span>
                  <h6 class="card-title mb-0 fw-semibold">${meta.label}</h6>
                </div>
                <p class="card-text small text-muted mb-1">${fileList.map(f => f.subcategory).join(', ')}</p>
                <small class="text-muted">${fileList.length} файл(ов)</small>
              </div>
            </div>
          </div>`;
    }

    html += `
        </div>
      </div>`;
  }

  container.innerHTML = html;
}
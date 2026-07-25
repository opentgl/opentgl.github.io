import { state } from '../state.js';
import { loadCSVData } from '../api.js';
import { escapeHtml, renderFieldLink } from '../utils.js';

export async function renderCategory(container, cat, subFilter) {
  container.innerHTML = '<div class="d-flex justify-content-center align-items-center py-5 text-muted"><div class="spinner-border spinner-border-sm me-2"></div></div>';

  const meta = state.categoryMeta[cat] || { label: 'Прочее', icon: 'file-text', color: '#6c757d' };
  let files = state.csvs.filter(c => c.category === cat);
  if (subFilter) files = files.filter(f => f.subcategory === subFilter);

  if (!files.length) {
    container.innerHTML = '<div class="alert alert-warning">Ничего не найдено. <a href="#/" class="alert-link">На главную</a></div>';
    return;
  }

  const subcats = [...new Set(files.map(f => f.subcategory))];
  const allData = {};
  let totalRows = 0;
  for (const f of files) {
    const data = await loadCSVData(f.filename);
    allData[f.filename] = data;
    totalRows += data.objects.length;
  }

  let html = `
    <div class="d-flex align-items-center gap-2 mb-3">
      <a href="#/" class="btn btn-outline-secondary btn-sm"><i data-lucide="arrow-left" style="width:14px;height:14px;"></i></a>
      <span class="badge fs-6" style="background:${meta.color};"><i data-lucide="${meta.icon}" style="width:14px;height:14px;" class="me-1"></i>${meta.label}</span>
      <h4 class="mb-0 fw-bold">${meta.label}</h4>
    </div>`;

  if (subcats.length > 1 && !subFilter) {
    html += '<div class="d-flex flex-wrap gap-2 mb-3">';
    for (const sc of subcats) {
      const count = files.filter(f => f.subcategory === sc).reduce((acc, f) => acc + (allData[f.filename]?.objects.length || 0), 0);
      html += `<a href="#/category/${cat}/${encodeURIComponent(sc)}" class="btn btn-outline-secondary btn-sm">${escapeHtml(sc)} <span class="badge bg-secondary">${count}</span></a>`;
    }
    html += '</div>';
  }

  for (const f of files) {
    const data = allData[f.filename];
    const fields = data.headers || [];
    const rows = data.objects || [];
    const collapsed = subcats.length > 1 && !subFilter;

    html += `<div class="card border-0 shadow-sm mb-3">
      <div class="card-header bg-light d-flex justify-content-between align-items-center py-2">
        <span class="fw-semibold">${escapeHtml(f.subcategory)}</span>
        <span class="badge bg-secondary">${rows.length} записей</span>
      </div>`;

    if (collapsed) {
      html += '<div class="card-body"><div class="row g-3">';
      for (let i = 0; i < Math.min(rows.length, 6); i++) {
        const obj = rows[i];
        const titleField = fields.find(fn => /назван|name|title|наименован/i.test(fn)) || fields[0];
        const title = obj[titleField] || Object.values(obj).find(v => v && v.length > 5) || '(без названия)';
        const addr = obj['Адрес'] || obj['address'] || obj['Местонахождение'] || obj['Местоположение'] || '';
        html += `<div class="col-md-6 col-xl-4">
          <div class="card h-100 border shadow-sm" style="cursor:pointer;" onclick="window.navigate('item/${encodeURIComponent(f.filename)}/${i}')">
            <div class="card-body py-2 px-3">
              <h6 class="card-title mb-1 fw-semibold" style="font-size:.85rem;">${escapeHtml(String(title).slice(0, 60))}</h6>
              ${addr ? `<p class="card-text small text-muted mb-0">${renderFieldLink('Адрес', addr)}</p>` : ''}
            </div>
          </div>
        </div>`;
      }
      html += '</div></div>';
      if (rows.length > 6) {
        html += `<div class="card-footer bg-light text-center py-2"><a href="#/category/${f.category}/${encodeURIComponent(f.subcategory)}" class="btn btn-sm btn-outline-primary">Показать все ${rows.length} записей &rarr;</a></div>`;
      }
    } else {
      html += `<div class="table-responsive"><table class="table table-hover table-sm mb-0"><thead class="table-light"><tr>`;
      for (const h of fields) html += `<th class="text-nowrap">${escapeHtml(h)}</th>`;
      html += `</tr></thead><tbody>`;
      for (let i = 0; i < rows.length; i++) {
        const obj = rows[i];
        html += `<tr style="cursor:pointer;" onclick="window.navigate('item/${encodeURIComponent(f.filename)}/${i}')">`;
        for (const h of fields) {
          html += `<td>${renderFieldLink(h, obj[h])}</td>`;
        }
        html += '</tr>';
      }
      html += `</tbody></table></div>`;
      html += `<div class="card-footer bg-light text-end py-2"><small class="text-muted">Всего: ${rows.length} записей</small></div>`;
    }

    html += '</div>';
  }

  container.innerHTML = html;
}
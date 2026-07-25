import { state } from '../state.js';
import { loadCSVData } from '../api.js';
import { escapeHtml, renderFieldLink } from '../utils.js';

export async function renderDetail(container, filename, idx) {
  container.innerHTML = '<div class="d-flex justify-content-center align-items-center py-5 text-muted"><div class="spinner-border spinner-border-sm me-2"></div></div>';

  const fileMeta = state.csvs.find(c => c.filename === filename);
  const data = await loadCSVData(filename);
  const obj = data.objects[idx];

  if (!obj) {
    container.innerHTML = '<div class="alert alert-warning">Запись не найдена. <a href="#/" class="alert-link">На главную</a></div>';
    return;
  }

  const meta = state.categoryMeta[fileMeta?.category] || { label: 'Прочее', icon: 'file-text', color: '#6c757d' };
  const titleField = data.headers.find(f => /назван|name|title|наименован/i.test(f)) || data.headers[0];
  const title = obj[titleField] || Object.values(obj).find(v => v && v.length > 5) || 'Без названия';

  let html = `
    <div class="d-flex align-items-center gap-2 mb-3">
      <a href="javascript:history.back()" class="btn btn-outline-secondary btn-sm"><i data-lucide="arrow-left" style="width:14px;height:14px;"></i></a>
      <span class="badge" style="background:${meta.color};"><i data-lucide="${meta.icon}" style="width:12px;height:12px;" class="me-1"></i>${meta.label}</span>
      <small class="text-muted">${escapeHtml(fileMeta?.subcategory || '')} ${fileMeta?.date ? '· ' + fileMeta.date : ''}</small>
    </div>
    <div class="card border-0 shadow-sm">
      <div class="card-header bg-light">
        <h5 class="mb-0 fw-bold">${escapeHtml(String(title))}</h5>
        <small class="text-muted">Запись #${idx + 1}</small>
      </div>
      <div class="card-body p-0">
        <table class="table table-striped mb-0">`;

  for (const [k, v] of Object.entries(obj)) {
    html += `<tr><td class="fw-semibold text-nowrap" style="width:200px;">${escapeHtml(k)}</td><td>${renderFieldLink(k, v)}</td></tr>`;
  }

  html += `</table></div>
      <div class="card-footer bg-light">
        <a href="#/category/${fileMeta?.category || 'other'}" class="btn btn-outline-secondary btn-sm">&larr; К списку ${meta.label.toLowerCase()}</a>
      </div>
    </div>`;

  container.innerHTML = html;
}
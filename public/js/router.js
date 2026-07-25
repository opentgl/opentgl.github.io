import { loadCSVMeta } from './api.js';
import { state } from './state.js';
import { renderHome } from './pages/home.js';
import { renderCategory } from './pages/category.js';
import { renderDetail } from './pages/detail.js';
import { renderAbout } from './pages/about.js';

let initialized = false;

function updateNav() {
  const hash = window.location.hash.slice(1) || '/';
  document.querySelectorAll('[data-nav]').forEach(el => el.classList.remove('active'));
  let key = 'home';
  if (hash.startsWith('/about')) key = 'about';
  document.querySelectorAll(`[data-nav="${key}"]`).forEach(el => el.classList.add('active'));
}

export function navigate(hash) {
  window.location.hash = hash;
  route();
}

async function route() {
  const hash = window.location.hash.slice(1) || '/';
  const parts = hash.split('/');
  const content = document.getElementById('page-content');

  if (hash === '/' || hash === '') {
    await renderHome(content);
  } else if (parts[0] === 'category' && parts[1]) {
    const cat = parts[1];
    const sub = decodeURIComponent(parts.slice(2).join('/') || '');
    await renderCategory(content, cat, sub);
  } else if (parts[0] === 'item' && parts[1] && parts[2]) {
    const filename = decodeURIComponent(parts[1]);
    const idx = parseInt(parts[2], 10);
    await renderDetail(content, filename, idx);
  } else if (parts[0] === 'about') {
    await renderAbout(content);
  } else {
    await renderHome(content);
  }
  updateNav();
  lucide.createIcons();
}

export async function initRouter() {
  if (initialized) return;
  initialized = true;
  await loadCSVMeta();
  buildSidebar();
  window.addEventListener('hashchange', route);
  route();
}

function buildSidebar() {
  const nav = document.getElementById('sidebar-nav');
  const cats = {};
  state.csvs.forEach(c => {
    if (!cats[c.category]) cats[c.category] = { count: 0 };
    cats[c.category].count++;
  });
  for (const [key, meta] of Object.entries(state.categoryMeta)) {
      if (!cats[key]) continue;
      const a = document.createElement('a');
      // Добавлен класс text-center для выравнивания текста и flex-fill / mx-2 для одинаковых расстояний
      a.className = `nav-link d-flex flex-column align-items-center text-center flex-fill mx-2`;
      a.href = `#category/${key}`;
      // Для span добавлен стиль text-wrap (или встроенный стиль max-width + word-break)
      a.innerHTML = `
      <span class="text-wrap" style="color:${meta.color}; max-width: 140px; word-break: break-word;">${meta.label}</span>
      <i color='${meta.color}' data-lucide="${meta.icon}" class="mt-2"></i>
      `;
      nav.appendChild(a);
  }


  const other = state.csvs.filter(c => !state.categoryMeta[c.category]);
  if (other.length) {
    const a = document.createElement('a');
    a.className = 'nav-link';
    a.href = '#category/other';
    a.innerHTML = `<i data-lucide="folder-open" style="width:16px;height:16px;" class="me-2"></i>Прочее <span class="ms-auto badge bg-secondary bg-opacity-25 text-light" style="font-size:.7rem;">${other.length}</span>`;
    nav.appendChild(a);
  }
}
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
    a.className = 'nav-link d-flex flex-column align-items-center text-center px-2 px-md-3';
    a.href = `#category/${key}`;
    a.innerHTML = `
      <span style="color:${meta.color}; font-size:.8rem; line-height:1.1; word-break:break-word;">${meta.label}</span>
      <i data-lucide="${meta.icon}" style="width:20px;height:20px;color:${meta.color};" class="mt-1"></i>`;
    nav.appendChild(a);
  }

  const other = state.csvs.filter(c => !state.categoryMeta[c.category]);
  if (other.length) {
    const a = document.createElement('a');
    a.className = 'nav-link d-flex flex-column align-items-center text-center px-2 px-md-3';
    a.href = '#category/other';
    a.innerHTML = `<span style="font-size:.8rem;">Прочее</span><i data-lucide="folder-open" style="width:20px;height:20px;" class="mt-1"></i>`;
    nav.appendChild(a);
  }
}
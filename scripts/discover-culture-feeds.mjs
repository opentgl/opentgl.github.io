#!/usr/bin/env node
/**
 * Ищет RSS/Atom-ленты у сайтов учреждений культуры.
 *
 * Скрипт НЕ парсит содержимое лент: он только запоминает адрес подходящей
 * ленты в src/data/culture-feeds.json. Ленты предпочитаются в таком порядке:
 * RSS 2.0/RDF, затем Atom. Ленты комментариев отбрасываются.
 *
 * Запуск:
 *   node scripts/discover-culture-feeds.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unifyHeaders, unifyObject } from '../src/lib/column-map.js';
import { detectCategory, extractDate, fileSlug } from '../src/lib/categories.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_FILE = new URL('../src/data/culture-feeds.json', import.meta.url);
const GOOGLE_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(`${ROOT}.env`, 'utf8').split('\n')) {
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  } catch {
    // .env может отсутствовать в CI — переменные придут из окружения.
  }
  return env;
}

const env = loadEnv();
const API_KEY = env.GOOGLE_API;
const SPREADSHEET_ID = env.GOOGLE_SPREADSHEET_ID;

if (!API_KEY || !SPREADSHEET_ID) {
  console.error('Нужны GOOGLE_API и GOOGLE_SPREADSHEET_ID в .env или окружении.');
  process.exit(1);
}

function versionOf(filename) {
  const m = String(filename).match(/file[_-]?(\d+)$/i);
  return m ? Number(m[1]) : 0;
}

async function getJson(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Sheets API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function loadCultureObjects() {
  const meta = await getJson(`${GOOGLE_BASE}/${SPREADSHEET_ID}?key=${API_KEY}`);
  const names = (meta.sheets || [])
    .map(s => s.properties?.title)
    .filter(name => name && !name.startsWith('_'));

  const files = names
    .map(filename => ({ filename, ...detectCategory(filename) }))
    .filter(file => file.cat === 'culture')
    .sort((a, b) => {
      const byVersion = versionOf(b.filename) - versionOf(a.filename);
      if (byVersion !== 0) return byVersion;
      return String(extractDate(b.filename) || '').localeCompare(String(extractDate(a.filename) || ''));
    })
    .filter((file, index, list) => list.findIndex(f => f.sub === file.sub) === index);

  const objects = [];
  for (const file of files) {
    const range = encodeURIComponent(`${file.filename}!A:Z`);
    const data = await getJson(`${GOOGLE_BASE}/${SPREADSHEET_ID}/values/${range}?key=${API_KEY}`);
    const rows = data.values || [];
    if (rows.length < 2) continue;
    const rawHeaders = rows[0].map(h => String(h).trim());
    const headers = unifyHeaders(rawHeaders);
    for (const row of rows.slice(1)) {
      const raw = Object.fromEntries(rawHeaders.map((header, i) => [header, row[i] ?? '']));
      const obj = unifyObject(raw);
      const site = String(obj['Сайт'] || '').trim();
      if (!site) continue;
      objects.push({
        name:
          String(obj['Наименование'] || obj['Название'] || obj['Наименование организации'] || '').trim() ||
          site,
        address: String(obj['Адрес'] || '').trim(),
        site,
        subcategory: file.sub,
        filterId: fileSlug(file.filename),
      });
    }
  }
  return objects;
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)));
}

function getAttribute(tag, name) {
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const m = tag.match(re);
  return decodeEntities(m ? m[1] ?? m[2] ?? m[3] ?? '' : '');
}

function normalizeUrl(value, base) {
  try {
    const url = new URL(decodeEntities(value), base);
    url.hash = '';
    return url.href;
  } catch {
    return '';
  }
}

function normalizeSite(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    url.hash = '';
    url.search = '';
    return {
      site: url.href.replace(/\/$/, ''),
      host: url.hostname.replace(/^www\./i, '').toLowerCase(),
    };
  } catch {
    return null;
  }
}

function isCommentFeed(url, title) {
  const haystack = `${url} ${title}`.toLowerCase();
  return /comment|коммент|comments-rss|feed=comments/.test(haystack);
}

function isAtomType(type) {
  return /application\/atom\+xml/i.test(type);
}

function looksLikeFeed(text) {
  return /<(rss|feed|rdf:RDF)(\s|>)/i.test(String(text || '').slice(0, 2000));
}

async function fetchPage(url, accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8') {
  const res = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept },
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  return { res, text, finalUrl: res.url || url };
}

function findLinkFeeds(html, pageUrl) {
  const rss = [];
  const rdf = [];
  const atom = [];
  const linkRe = /<link\b[^>]*>/gi;
  for (const match of html.matchAll(linkRe)) {
    const tag = match[0];
    const rel = getAttribute(tag, 'rel').toLowerCase();
    if (!rel.split(/\s+/).includes('alternate')) continue;
    const type = getAttribute(tag, 'type').toLowerCase();
    const href = normalizeUrl(getAttribute(tag, 'href'), pageUrl);
    if (!href) continue;
    const title = getAttribute(tag, 'title');
    if (isCommentFeed(href, title)) continue;
    if (/application\/rss\+xml/i.test(type)) rss.push({ url: href, type: 'rss' });
    else if (/application\/rdf\+xml/i.test(type)) rdf.push({ url: href, type: 'rss' });
    else if (isAtomType(type)) atom.push({ url: href, type: 'atom' });
  }
  return { rss, rdf, atom };
}

const PROBE_PATHS = [
  '/rss',
  '/rss.xml',
  '/feed',
  '/feed/',
  '/?feed=rss2',
  '/news/rss',
  '/index.php?format=feed&type=rss',
  '/?format=feed&type=rss',
  '/atom.xml',
];

async function probeFeed(pageUrl) {
  const base = new URL(pageUrl);
  for (const path of PROBE_PATHS) {
    const url = new URL(path, base).href;
    try {
      const { res, text } = await fetchPage(url, 'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*;q=0.5');
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !looksLikeFeed(text)) continue;
      const type = isAtomType(contentType) || /<feed(\s|>)/i.test(text.slice(0, 500)) ? 'atom' : 'rss';
      if (isCommentFeed(url, '')) continue;
      return { url, type };
    } catch {
      // Пробуем следующий адрес.
    }
  }
  return null;
}

async function discoverFeed(site) {
  try {
    const { text, finalUrl } = await fetchPage(site);
    const { rss, rdf, atom } = findLinkFeeds(text, finalUrl);
    if (rss.length) return { ...rss[0], via: 'link' };
    if (rdf.length) return { ...rdf[0], via: 'link' };
    if (atom.length) return { ...atom[0], via: 'link' };
  } catch (error) {
    // Ниже попробуем стандартные адреса — иногда лента есть, а главная
    // страница отдаёт ошибку или требует JS.
    console.warn(`  главная страница недоступна: ${error.message}`);
  }

  const probe = await probeFeed(site);
  return probe ? { ...probe, via: 'probe' } : null;
}

const objects = await loadCultureObjects();
const byHost = new Map();
for (const obj of objects) {
  const normalized = normalizeSite(obj.site);
  if (!normalized) {
    console.warn(`Пропущен некорректный сайт: ${obj.site}`);
    continue;
  }
  if (!byHost.has(normalized.host)) {
    byHost.set(normalized.host, { ...obj, ...normalized });
  }
}

console.log(`Проверяем ${byHost.size} сайтов учреждений культуры…\n`);

const feeds = [];
for (const item of byHost.values()) {
  const { host, site, name } = item;
  process.stdout.write(`- ${host} … `);
  const found = await discoverFeed(site);
  if (!found) {
    console.log('лента не найдена');
    continue;
  }
  console.log(`${found.type.toUpperCase()} ${found.url} (${found.via})`);
  feeds.push({
    id: host.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    name,
    address: item.address,
    subcategory: item.subcategory,
    filterId: item.filterId,
    site,
    host,
    feed: found.url,
    type: found.type,
    discoveredAt: new Date().toISOString(),
  });
}

feeds.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

mkdirSync(dirname(fileURLToPath(OUT_FILE)), { recursive: true });
writeFileSync(
  OUT_FILE,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), feeds }, null, 2)}\n`,
  'utf8',
);

console.log(`\nГотово: ${feeds.length} лент записано в ${fileURLToPath(OUT_FILE)}`);

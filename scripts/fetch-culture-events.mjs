#!/usr/bin/env node
/**
 * Загружает и разбирает RSS/Atom-ленты, найденные
 * scripts/discover-culture-feeds.mjs, в локальный снимок
 * src/data/culture-events.json.
 *
 * Во время обычной сборки сайта сеть не используется: Astro читает
 * уже готовый снимок. Чтобы обновить события, запустите:
 *
 *   node scripts/fetch-culture-events.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';

const FEEDS_FILE = new URL('../src/data/culture-feeds.json', import.meta.url);
const OUT_FILE = new URL('../src/data/culture-events.json', import.meta.url);
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MAX_ITEMS = 30;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  cdataPropName: '#cdata',
  textNodeName: '#text',
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

function readJson(url, fallback) {
  try {
    return JSON.parse(readFileSync(url, 'utf8'));
  } catch {
    return fallback;
  }
}

const feedsData = readJson(FEEDS_FILE, { feeds: [] });
const previous = readJson(OUT_FILE, { feeds: {} });
const feeds = Array.isArray(feedsData.feeds) ? feedsData.feeds : [];

function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)));
}

function textValue(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = textValue(item);
      if (text) return text;
    }
    return '';
  }
  if (typeof value === 'object') {
    if (value['#cdata'] != null) return textValue(value['#cdata']);
    if (value['#text'] != null) return textValue(value['#text']);
  }
  return '';
}

function htmlToText(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSummary(text) {
  return String(text || '')
    .replace(/Сообщение\s+.+?\s+появились сначала на\s+.+?(?:\.|$)/i, '')
    .replace(/Скачать документ[^.]*\.?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shorten(text, max = 320) {
  const value = String(text || '').trim();
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

function normalizeDate(value) {
  const raw = textValue(value).trim();
  if (!raw) return null;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function firstDate(item) {
  for (const key of ['pubDate', 'published', 'updated', 'dc:date', 'date']) {
    const value = normalizeDate(item[key]);
    if (value) return value;
  }
  return null;
}

function firstSummary(item) {
  const candidates = [];
  for (const key of ['description', 'summary', 'content:encoded', 'content', 'encoded']) {
    const text = cleanSummary(htmlToText(textValue(item[key])));
    if (text) candidates.push(text);
  }
  const meaningful = candidates.find(text => text.length >= 25);
  return shorten(meaningful || '');
}

function linkFromValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const link = linkFromValue(item);
      if (link) return link;
    }
    return '';
  }
  if (typeof value === 'object') {
    if (value['@_href']) return String(value['@_href']).trim();
    if (value['#text']) return String(value['#text']).trim();
  }
  return '';
}

function firstLink(item) {
  const direct = linkFromValue(item.link);
  if (direct) return direct;
  return linkFromValue(item.guid) || linkFromValue(item.id);
}

function itemTitle(item) {
  return htmlToText(textValue(item.title));
}

function normalizeItems(root) {
  const channel = root?.rss?.channel || root?.['rdf:RDF'] || null;
  const atomFeed = root?.feed || null;
  const rawItems =
    (Array.isArray(channel?.item) ? channel.item : channel?.item ? [channel.item] : null) ||
    (Array.isArray(atomFeed?.entry) ? atomFeed.entry : atomFeed?.entry ? [atomFeed.entry] : null) ||
    [];

  const seen = new Set();
  const items = [];
  for (const item of rawItems) {
    const title = itemTitle(item);
    const url = firstLink(item);
    if (!title || !url || seen.has(url)) continue;
    seen.add(url);
    items.push({
      title,
      url,
      publishedAt: firstDate(item),
      summary: firstSummary(item),
    });
  }

  items.sort((a, b) => {
    const at = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const bt = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return bt - at;
  });
  return items.slice(0, MAX_ITEMS);
}

function feedMeta(root) {
  const channel = root?.rss?.channel || root?.['rdf:RDF'] || null;
  const atomFeed = root?.feed || null;
  return {
    title: htmlToText(textValue(channel?.title || atomFeed?.title)),
    link: linkFromValue(channel?.link || atomFeed?.link),
    updatedAt: normalizeDate(channel?.lastBuildDate || atomFeed?.updated || atomFeed?.modified),
  };
}

async function fetchFeed(feed) {
  const res = await fetch(feed.feed, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*;q=0.5',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  const root = parser.parse(xml);
  return {
    root,
    ...feedMeta(root),
    items: normalizeItems(root),
  };
}

const output = {
  updatedAt: new Date().toISOString(),
  feeds: {},
};

console.log(`Обновляем ${feeds.length} лент…\n`);

for (const feed of feeds) {
  process.stdout.write(`- ${feed.name} … `);
  const old = previous.feeds?.[feed.id];
  try {
    const parsed = await fetchFeed(feed);
    output.feeds[feed.id] = {
      id: feed.id,
      name: feed.name,
      address: feed.address,
      site: feed.site,
      feed: feed.feed,
      type: feed.type,
      title: parsed.title || feed.name,
      sourceUrl: parsed.link || feed.site,
      feedUpdatedAt: parsed.updatedAt,
      fetchedAt: new Date().toISOString(),
      items: parsed.items,
    };
    console.log(`${parsed.items.length} событий`);
  } catch (error) {
    console.log(`ошибка: ${error.message}`);
    output.feeds[feed.id] = {
      ...(old || {}),
      id: feed.id,
      name: feed.name,
      address: feed.address,
      site: feed.site,
      feed: feed.feed,
      type: feed.type,
      fetchedAt: old?.fetchedAt || null,
      error: error.message,
    };
  }
}

mkdirSync(dirname(fileURLToPath(OUT_FILE)), { recursive: true });
writeFileSync(OUT_FILE, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(`\nГотово: ${fileURLToPath(OUT_FILE)}`);

export const FEED_SHORT_NAMES = {
  'burevestnik-tgl-ru': 'КДЦ «Буревестник»',
  'thm-museum-ru': 'Художественный музей',
  'tltmuseum-ru': 'Краеведческий музей',
  'pkitis-tltsu-ru': 'Парковый комплекс истории техники',
  'mdt-tlt-ru': 'Молодёжный драматический театр',
  'teatrdiligence-ru': 'ТЮЗ «Дилижанс»',
};

export function getFeedSources(feedsData) {
  return (feedsData?.feeds || []).map(feed => ({
    ...feed,
    shortName: FEED_SHORT_NAMES[feed.id] || feed.name,
  }));
}

function normalizedTitle(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Собирает общую ленту из локального снимка RSS.
 * В ленту попадают только записи с описанием.
 */
export function buildNewsItems(feedsData, eventsData, base = '/') {
  const feeds = feedsData?.feeds || [];
  const feedById = new Map(feeds.map(feed => [feed.id, feed]));
  const seen = new Set();

  return Object.entries(eventsData?.feeds || {})
    .flatMap(([feedId, feed]) => {
      const feedInfo = feedById.get(feedId) || {};
      const sourceName = FEED_SHORT_NAMES[feedId] || feed.name || feedInfo.name || feedId;
      return (feed.items || []).map(item => {
        const summary = String(item.summary || '').trim();
        return {
          ...item,
          summary,
          feedId,
          sourceName,
          sourcePage: `${base}events/${feedId}/`,
        };
      });
    })
    .filter(item => item.title && item.url && item.summary)
    .sort((a, b) => {
      const at = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bt = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return bt - at;
    })
    .filter(item => {
      const key = `${normalizedTitle(item.title)}|${(item.publishedAt || '').slice(0, 10)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

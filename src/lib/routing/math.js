// Общие математические утилиты (используются и в воркере, и в клиенте).

// Расстояние между двумя точками в метрах (гаверсинус).
export function haversineM(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLng = (bLng - aLng) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function fmtDistance(m) {
  if (m >= 1000) return (m / 1000).toFixed(2).replace(/\.?0+$/, '') + ' км';
  return Math.round(m) + ' м';
}

export function fmtDuration(m, speedKmh) {
  const s = (m / 1000) / (speedKmh || 40) * 3600;
  const mins = Math.round(s / 60);
  if (mins < 60) return mins + ' мин';
  return Math.floor(mins / 60) + ' ч ' + (mins % 60) + ' мин';
}

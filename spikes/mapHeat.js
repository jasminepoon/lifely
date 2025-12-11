// Lightweight, importable map heat renderer (constellation style, no tiles).
// Usage:
//   import { renderConstellationHeat } from './mapHeat.js';
//   renderConstellationHeat({ el: document.getElementById('map'), points: mapPoints });

export function renderConstellationHeat(options) {
  const {
    el,
    points = [],
    minPoints = 15,
    legend = 'NYC area · dot size = visit count',
    palette = {
      base: 'rgba(0, 212, 255, 0.7)',
      shadow: 'rgba(0, 212, 255, 0.35)',
    },
  } = options || {};

  if (!el) return;
  el.innerHTML = '';

  const filtered = points.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
  );
  if (!filtered.length) {
    el.innerHTML =
      '<p class="muted" style="padding:12px;">No lat/lng available. Add a Google Maps API key or inspect Places enrichment.</p>';
    return;
  }
  if (filtered.length < minPoints) {
    el.innerHTML =
      '<p class="muted" style="padding:12px;">Lat/lng coverage is sparse. Sticking to stacked bars.</p>';
    return;
  }

  const maxCount = Math.max(...filtered.map((p) => p.count || 1), 1);
  const lats = filtered.map((p) => p.lat);
  const lngs = filtered.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, 0.001);
  const lngSpan = Math.max(maxLng - minLng, 0.001);

  // Add gentle padding to avoid edge clipping
  const padLat = latSpan * 0.05;
  const padLng = lngSpan * 0.05;

  const jitter = () => (Math.random() - 0.5) * 0.8;

  // Legend
  const legendEl = document.createElement('div');
  legendEl.className = 'map__legend';
  legendEl.innerHTML = `<span class="map__legend-dot"></span><span>${legend}</span>`;
  el.appendChild(legendEl);

  filtered.slice(0, 300).forEach((p) => {
    const left = ((p.lng - (minLng - padLng)) / (lngSpan + 2 * padLng)) * 100 + jitter();
    const top = 100 - ((p.lat - (minLat - padLat)) / (latSpan + 2 * padLat)) * 100 + jitter();

    const dot = document.createElement('div');
    dot.className = 'map__dot';
    const size = 8 + 6 * Math.sqrt((p.count || 1) / maxCount);
    dot.style.left = `${left}%`;
    dot.style.top = `${top}%`;
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.background = palette.base;
    dot.style.boxShadow = `0 0 18px ${palette.shadow}`;
    dot.style.opacity = Math.min(0.85, 0.45 + (p.count || 1) / maxCount);
    dot.title = `${p.label || 'Location'} · ${p.count || 1}`;
    el.appendChild(dot);
  });
}

// Helper to decorate an existing map container with a “sparse” or “no data” message
export function renderMapFallback(el, message) {
  if (!el) return;
  el.innerHTML = `<p class="muted" style="padding:12px;">${message}</p>`;
}

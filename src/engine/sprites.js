// SVG sprite system — data-URL images, cached by type+color

const _cache = new Map();

function _load(svg, color) {
  const key = color + svg.length;
  if (_cache.has(key)) return _cache.get(key);
  const filled = svg.replace(/\{C\}/g, color);
  const img    = new Image();
  img.src      = 'data:image/svg+xml,' + encodeURIComponent(filled);
  _cache.set(key, img);
  return img;
}

// ── Infantry soldier (top-down, forward = top of image) ──────────────
// Shako hat at top, colored uniform body, musket on right side
const _INF = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 28">
  <ellipse cx="10" cy="25" rx="6.5" ry="2.2" fill="rgba(0,0,0,0.28)"/>
  <ellipse cx="10" cy="18" rx="5.5" ry="7.5" fill="{C}"/>
  <ellipse cx="10" cy="18" rx="5.5" ry="7.5" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="0.8"/>
  <ellipse cx="10" cy="9"  rx="3.2" ry="3.5" fill="#c8906a"/>
  <rect x="6.5" y="3" width="7" height="6.5" rx="1.2" fill="#111"/>
  <rect x="5.5" y="8.5" width="9" height="1.8" rx="0.4" fill="#2a2a2a"/>
  <rect x="16.2" y="3.5" width="1.8" height="20" rx="0.6" fill="#6b4218"/>
  <rect x="16.2" y="3"   width="1.8" height="2.5" rx="0.4" fill="#aaa"/>
</svg>`;

// ── Cavalry — circle with cross ──────────────────────────────────────
const _CAV = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
  <circle cx="10" cy="10" r="8.5" fill="{C}" stroke="rgba(0,0,0,0.6)" stroke-width="1.5"/>
  <line x1="10" y1="2" x2="10" y2="18" stroke="rgba(0,0,0,0.7)" stroke-width="2" stroke-linecap="round"/>
  <line x1="2" y1="10" x2="18" y2="10" stroke="rgba(0,0,0,0.7)" stroke-width="2" stroke-linecap="round"/>
</svg>`;

// ── Cannon (top-down, barrel points up = forward) ────────────────────
const _CANNON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 32">
  <ellipse cx="13" cy="29" rx="9"   ry="2.5" fill="rgba(0,0,0,0.28)"/>
  <circle  cx="13" cy="21" r="9"           fill="#8a5c22"/>
  <circle  cx="13" cy="21" r="9"           fill="none" stroke="#3e2200" stroke-width="2.2"/>
  <circle  cx="13" cy="21" r="2.8"         fill="#3e2200"/>
  <line x1="4"  y1="21" x2="22" y2="21"   stroke="#3e2200" stroke-width="1.8"/>
  <line x1="13" y1="12" x2="13" y2="30"   stroke="#3e2200" stroke-width="1.8"/>
  <line x1="6.5" y1="14.5" x2="19.5" y2="27.5" stroke="#3e2200" stroke-width="1.4"/>
  <line x1="19.5" y1="14.5" x2="6.5" y2="27.5" stroke="#3e2200" stroke-width="1.4"/>
  <rect x="9"  y="1"  width="8" height="22" rx="3.5" fill="#2a2a2a"/>
  <rect x="10" y="2"  width="6" height="19" rx="2.5" fill="#585858"/>
  <rect x="9"  y="1"  width="8" height="3.5" rx="1.5" fill="#1a1a1a"/>
  <rect x="9"  y="18" width="8" height="3.5" rx="1.5" fill="#383838"/>
</svg>`;

export function infantrySprite(color)  { return _load(_INF,    color); }
export function cavalrySprite(color)   { return _load(_CAV,    color); }
export function cannonSprite()         { return _load(_CANNON, '');    }

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

// ── Cannon (aerial top-down, barrel points up = forward) ─────────────
// Barrel center, two spoked wheels on sides, trail extending back
const _CANNON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 36">
  <!-- trail (extends backward from axle) -->
  <rect x="14" y="22" width="4" height="12" rx="1.5" fill="#5a3810"/>

  <!-- axle bar -->
  <rect x="3" y="19" width="26" height="4" rx="1.5" fill="#7a4e20" stroke="#3e2200" stroke-width="0.8"/>

  <!-- left wheel -->
  <circle cx="5"  cy="21" r="5.5" fill="#6b3e14" stroke="#2a1800" stroke-width="1.2"/>
  <line x1="5"  y1="15.8" x2="5"  y2="26.2" stroke="#2a1800" stroke-width="1"/>
  <line x1="-.3" y1="21"  x2="10.3" y2="21"  stroke="#2a1800" stroke-width="1"/>
  <line x1="1.1" y1="17.1" x2="8.9" y2="24.9" stroke="#2a1800" stroke-width="0.8"/>
  <line x1="8.9" y1="17.1" x2="1.1" y2="24.9" stroke="#2a1800" stroke-width="0.8"/>
  <circle cx="5"  cy="21" r="1.6" fill="#2a1800"/>

  <!-- right wheel -->
  <circle cx="27" cy="21" r="5.5" fill="#6b3e14" stroke="#2a1800" stroke-width="1.2"/>
  <line x1="27" y1="15.8" x2="27" y2="26.2" stroke="#2a1800" stroke-width="1"/>
  <line x1="21.7" y1="21"  x2="32.3" y2="21"  stroke="#2a1800" stroke-width="1"/>
  <line x1="23.1" y1="17.1" x2="30.9" y2="24.9" stroke="#2a1800" stroke-width="0.8"/>
  <line x1="30.9" y1="17.1" x2="23.1" y2="24.9" stroke="#2a1800" stroke-width="0.8"/>
  <circle cx="27" cy="21" r="1.6" fill="#2a1800"/>

  <!-- barrel -->
  <rect x="13" y="1"  width="6" height="20" rx="2.5" fill="#2a2a2a"/>
  <rect x="14" y="1"  width="4" height="17" rx="2"   fill="#4a4a4a"/>
  <!-- muzzle band -->
  <rect x="12.5" y="1" width="7" height="3" rx="1.2" fill="#1a1a1a"/>
  <!-- breech band -->
  <rect x="12.5" y="17" width="7" height="3" rx="1.2" fill="#333"/>
</svg>`;

export function infantrySprite(color)  { return _load(_INF,    color); }
export function cavalrySprite(color)   { return _load(_CAV,    color); }
export function cannonSprite()         { return _load(_CANNON, '');    }

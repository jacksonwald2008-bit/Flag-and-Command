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

// ── Cavalry — chess-knight silhouette, forward = top of image ────────
// A simple side-profile horse head + neck + base, like a chess knight.
// The piece faces right (→) in SVG space; the renderer rotates to facing.
const _CAV = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 32">
  <!-- drop shadow -->
  <ellipse cx="14" cy="29.5" rx="9" ry="2" fill="rgba(0,0,0,0.25)"/>
  <!-- base block -->
  <rect x="5" y="23" width="18" height="5" rx="2" fill="{C}" stroke="rgba(0,0,0,0.5)" stroke-width="0.8"/>
  <!-- neck -->
  <path d="M10 23 Q9 14 13 10 Q11 16 15 18 L14 23Z" fill="{C}" stroke="rgba(0,0,0,0.4)" stroke-width="0.6"/>
  <!-- head -->
  <path d="M13 10 Q11 4 16 2 Q22 1 23 6 Q23 10 20 12 Q18 14 15 14 Q13 13 13 10Z"
        fill="{C}" stroke="rgba(0,0,0,0.55)" stroke-width="0.9"/>
  <!-- ear -->
  <path d="M15 3 Q17 0 19 2" fill="none" stroke="rgba(0,0,0,0.6)" stroke-width="1.2" stroke-linecap="round"/>
  <!-- eye -->
  <circle cx="19" cy="6.5" r="1.2" fill="rgba(0,0,0,0.75)"/>
  <!-- nostril -->
  <ellipse cx="22" cy="9.5" rx="1" ry="0.7" fill="rgba(0,0,0,0.45)"/>
  <!-- mane highlight -->
  <path d="M13 10 Q12 8 13 6 Q14 4 15 5" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1" stroke-linecap="round"/>
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

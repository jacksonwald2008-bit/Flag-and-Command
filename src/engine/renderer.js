import {
  LOD_FAR_MAX, LOD_MID_MAX, TEAM_COLORS, MORALE_STATE,
  WORLD_W, WORLD_H, DEPLOY_ZONE_PLAYER, DEPLOY_ZONE_AI, SS, RANK_DEPTH,
} from '../constants.js';

const TERRAIN_BG    = '#7ec850'; // brighter cartoon grass
const SELECTION_CLR = '#ffee00';
const FLAG_STEADY    = '#22bb44';
const FLAG_WAVERING  = '#ddaa00';
const FLAG_ROUTING   = '#ffffff';
const FLAG_BROKEN    = '#aaaaaa';
const FLAG_SHATTERED = '#444444';

export class Renderer {
  constructor(ctx, camera) {
    this.ctx    = ctx;
    this.camera = camera;
  }

  // === TERRAIN ===

  drawTerrain(map) {
    const ctx = this.ctx;
    const cam = this.camera;

    // Fill entire canvas with terrain colour — no black borders ever
    ctx.fillStyle = map ? map.bgColor || TERRAIN_BG : TERRAIN_BG;
    ctx.fillRect(0, 0, cam.canvas.width, cam.canvas.height);

    if (!map) return;

    // Hills and flat terrain
    for (const t of (map.terrain || [])) {
      this._drawPolygon(t.polygon, t.color, 'rgba(0,0,0,0.15)', 1);
    }

    // Forests
    for (const f of (map.forests || [])) {
      this._drawPolygon(f.polygon, f.color, 'rgba(0,0,0,0.2)', 1.5);
      // Add a few tree texture dots
      this._drawForestTexture(f.polygon, f.accent);
    }

    // Rivers
    for (const r of (map.rivers || [])) {
      this._drawRiver(r);
    }
  }

  _drawPolygon(polygon, fill, stroke, lineWidth) {
    if (!polygon || polygon.length < 3) return;
    const ctx = this.ctx;
    const cam = this.camera;
    ctx.beginPath();
    ctx.moveTo(cam.wx(polygon[0][0]), cam.wy(polygon[0][1]));
    for (let i = 1; i < polygon.length; i++) {
      ctx.lineTo(cam.wx(polygon[i][0]), cam.wy(polygon[i][1]));
    }
    ctx.closePath();
    if (fill)   { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }

  _drawForestTexture(polygon, accentColor) {
    if (!polygon || polygon.length < 3) return;
    const ctx = this.ctx;
    const cam = this.camera;
    // Draw small circles inside the polygon bbox as tree canopies
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [px, py] of polygon) {
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
    const step = 60;
    ctx.fillStyle = accentColor;
    for (let wx = minX + step / 2; wx < maxX; wx += step) {
      for (let wy = minY + step / 2; wy < maxY; wy += step) {
        const r = cam.wLen(12);
        if (r < 1) continue;
        ctx.beginPath();
        ctx.arc(cam.wx(wx), cam.wy(wy), r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _drawRiver(river) {
    const ctx = this.ctx;
    const cam = this.camera;
    const path = river.path;
    const w    = cam.wLen(river.width);
    if (w < 1) return;

    ctx.lineWidth   = Math.max(w, 2);
    ctx.strokeStyle = river.bankColor || '#3a7abf';
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(cam.wx(path[0][0]), cam.wy(path[0][1]));
    for (let i = 1; i < path.length; i++) ctx.lineTo(cam.wx(path[i][0]), cam.wy(path[i][1]));
    ctx.stroke();

    // Inner water color
    ctx.lineWidth   = Math.max(w * 0.7, 1.5);
    ctx.strokeStyle = river.color || '#4a8acc';
    ctx.stroke();
  }

  // === DEPLOYMENT ZONES ===

  drawDeploymentZones() {
    const ctx = this.ctx;
    const cam = this.camera;

    const zones = [
      { zone: DEPLOY_ZONE_PLAYER, color: 'rgba(220,60,40,0.18)', border: 'rgba(220,60,40,0.6)' },
      { zone: DEPLOY_ZONE_AI,     color: 'rgba(50,100,210,0.18)', border: 'rgba(50,100,210,0.6)' },
    ];

    for (const { zone, color, border } of zones) {
      ctx.fillStyle   = color;
      ctx.strokeStyle = border;
      ctx.lineWidth   = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.rect(cam.wx(zone.x), cam.wy(zone.y), cam.wLen(zone.w), cam.wLen(zone.h));
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // === UNITS ===

  drawUnit(unit, selected) {
    const cam  = this.camera;
    if (unit.isShattered && unit.isDead) return;
    if (!cam.isVisible(unit.x, unit.y, unit.boundRadius + 20)) return;

    // Dim shattered units that are still on-screen
    if (unit.isShattered) {
      this.ctx.globalAlpha = 0.3;
    }

    this._drawUnitClose(unit, selected);

    this.ctx.globalAlpha = 1.0;

    // Always draw morale bar (at all zoom levels)
    if (!unit.isShattered) this._drawMoraleBar(unit);

    // Particles
    this._drawParticles(unit);
  }

  _drawUnitFar(unit, selected) {
    const ctx = this.ctx;
    const cam = this.camera;
    const sx  = cam.wx(unit.x);
    const sy  = cam.wy(unit.y);
    const r   = Math.max(4, cam.wLen(8));

    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = TEAM_COLORS[unit.team];
    ctx.fill();
    if (selected) {
      ctx.strokeStyle = SELECTION_CLR;
      ctx.lineWidth   = 2;
      ctx.stroke();
    }

    // Tiny banner above
    this._drawMiniFlag(unit, sx, sy - r - 4);
  }

  _drawUnitMid(unit, selected) {
    const ctx = this.ctx;
    const cam = this.camera;
    const sx  = cam.wx(unit.x);
    const sy  = cam.wy(unit.y);
    const size = Math.max(6, cam.wLen(12));

    // Chevron pointing in facing direction
    const fx  = Math.sin(unit.facing);
    const fy  = -Math.cos(unit.facing);
    const rx  = Math.cos(unit.facing);
    const ry  = Math.sin(unit.facing);

    ctx.beginPath();
    ctx.moveTo(sx + fx * size,           sy + fy * size);
    ctx.lineTo(sx + rx * size * 0.7,     sy + ry * size * 0.7);
    ctx.lineTo(sx - fx * size * 0.4,     sy - fy * size * 0.4);
    ctx.lineTo(sx - rx * size * 0.7,     sy - ry * size * 0.7);
    ctx.closePath();
    ctx.fillStyle = TEAM_COLORS[unit.team];
    ctx.fill();

    if (selected) {
      ctx.strokeStyle = SELECTION_CLR;
      ctx.lineWidth   = 2;
      ctx.stroke();
    }

    this._drawMiniFlag(unit, sx + fx * size, sy + fy * size - 4);
  }

  _drawUnitClose(unit, selected) {
    const ctx  = this.ctx;
    const cam  = this.camera;
    const sx   = cam.wx(unit.x);
    const sy   = cam.wy(unit.y);

    const ranks      = unit.stats.ranks;
    const alive      = unit.aliveCount;
    const max        = unit.maxCount;
    const aliveRatio = max > 0 ? alive / max : 0;
    const teamColor  = TEAM_COLORS[unit.team];
    const darkColor  = _darkenHex(teamColor);

    // Formation size in screen pixels
    const perRank  = Math.max(4, Math.min(14, Math.round(alive / ranks / (max / ranks / 8))));
    const fw       = Math.max(52, cam.wLen(unit.frontWidth + 4));
    const fh       = Math.max(20 * ranks, cam.wLen(ranks * RANK_DEPTH + 2));

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(unit.facing);

    // ── Ground shadow beneath formation ──
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(-fw / 2 + 2, -fh / 2 + 2, fw, fh);

    // ── Formation ground plate ──
    ctx.fillStyle = 'rgba(180,140,80,0.28)';
    ctx.fillRect(-fw / 2, -fh / 2, fw, fh);

    // ── Formation border ──
    ctx.strokeStyle = selected ? SELECTION_CLR : 'rgba(0,0,0,0.5)';
    ctx.lineWidth   = selected ? 2.5 : 1;
    ctx.strokeRect(-fw / 2, -fh / 2, fw, fh);
    if (selected) {
      ctx.strokeStyle = SELECTION_CLR;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth   = 6;
      ctx.strokeRect(-fw / 2, -fh / 2, fw, fh);
      ctx.globalAlpha = 1;
      ctx.lineWidth   = 2;
      ctx.strokeRect(-fw / 2, -fh / 2, fw, fh);
    }

    // ── Cartoon soldiers ──
    const visPerRank = Math.max(3, Math.min(14, Math.floor(fw / 11)));
    const totalVis   = visPerRank * ranks;
    const aliveVis   = Math.round(totalVis * aliveRatio);

    for (let i = 0; i < aliveVis; i++) {
      const rank = Math.floor(i / visPerRank);
      const file = i % visPerRank;
      const px   = -fw / 2 + (file + 0.5) * (fw / visPerRank);
      const py   = -fh / 2 + (rank + 0.5) * (fh / ranks);
      _drawCartoonSoldier(ctx, px, py, teamColor, darkColor);
    }

    ctx.restore();

    // ── Flag at formation front ──
    const cos   = Math.cos(unit.facing);
    const sin   = Math.sin(unit.facing);
    const flagX = sx + sin * (fh / 2 + 6);
    const flagY = sy - cos * (fh / 2 + 6);
    this._drawFlag(unit, flagX, flagY);
  }

  _drawFlag(unit, sx, sy) {
    const ctx = this.ctx;
    const h   = 16;   // fixed pixel height — always visible
    const w   = 11;
    const pct = unit.aliveCount / unit.maxCount;
    const col = _moraleColor(unit.moraleState);

    // Pole — black outline then brown
    ctx.lineWidth   = 3.5;
    ctx.strokeStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx, sy - h);
    ctx.stroke();
    ctx.lineWidth   = 2;
    ctx.strokeStyle = '#7a4e18';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx, sy - h);
    ctx.stroke();

    // Flag cloth — black outline then fill
    ctx.fillStyle = '#111';
    ctx.fillRect(sx + 1, sy - h - 1, w + 2, Math.round(h * 0.6) + 2);
    ctx.fillStyle = col;
    if (pct < 0.45) {
      // Tattered
      ctx.beginPath();
      ctx.moveTo(sx + 2, sy - h);
      ctx.lineTo(sx + 2 + w, sy - h + h * 0.15);
      ctx.lineTo(sx + 2 + w * 0.55, sy - h + h * 0.38);
      ctx.lineTo(sx + 2 + w, sy - h + h * 0.55);
      ctx.lineTo(sx + 2, sy - h + h * 0.4);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(sx + 2, sy - h, w, Math.round(h * 0.58));
    }
  }

  _drawMiniFlag(unit, sx, sy) {
    const ctx = this.ctx;
    const col = _moraleColor(unit.moraleState);
    ctx.fillStyle   = col;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth   = 0.5;
    ctx.fillRect(sx, sy - 6, 5, 4);
    ctx.strokeRect(sx, sy - 6, 5, 4);
  }

  // === MORALE BAR ===

  _drawMoraleBar(unit) {
    const ctx = this.ctx;
    const cam = this.camera;
    const sx  = cam.wx(unit.x);
    const sy  = cam.wy(unit.y);

    // Fixed screen-space size so it's always readable
    const barW = Math.max(44, cam.wLen(unit.frontWidth + 4));
    const barH = 5;
    const bx   = sx - barW / 2;
    const by   = sy + Math.max(14, cam.wLen(unit.stats.ranks * RANK_DEPTH / 2 + 2)) + 4;

    // Black outline
    ctx.fillStyle = '#111';
    ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
    // Dark bg
    ctx.fillStyle = 'rgba(20,20,20,0.8)';
    ctx.fillRect(bx, by, barW, barH);
    // Morale fill
    const pct = Math.max(0, unit.morale / unit.maxMorale);
    ctx.fillStyle = _moraleBarColor(unit.moraleState);
    ctx.fillRect(bx, by, barW * pct, barH);
  }

  // === PARTICLES ===

  _drawParticles(unit) {
    const ctx = this.ctx;
    const cam = this.camera;
    for (const p of unit.particles) {
      const sx = cam.wx(p.x);
      const sy = cam.wy(p.y);
      if (p.type === 'flash') {
        ctx.fillStyle = `rgba(255,210,50,${p.life * 0.9})`;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(2, cam.wLen(1.5)), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'smoke') {
        const r = Math.max(3, cam.wLen(3 + (1 - p.life) * 6));
        ctx.fillStyle = `rgba(180,180,180,${p.life * 0.35})`;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'blood') {
        ctx.fillStyle = `rgba(180,20,20,${p.life * 0.7})`;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(1.5, cam.wLen(0.8)), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // === FORMATION PREVIEW ===

  drawFormationPreview(path) {
    if (!path || path.length < 2) return;
    const ctx = this.ctx;
    const cam = this.camera;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,230,0,0.7)';
    ctx.lineWidth   = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(cam.wx(path[0].x), cam.wy(path[0].y));
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(cam.wx(path[i].x), cam.wy(path[i].y));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // === BOX SELECT ===

  drawBoxSelect(rect) {
    if (!rect) return;
    const ctx = this.ctx;
    ctx.strokeStyle = '#ffee00';
    ctx.fillStyle   = 'rgba(255,238,0,0.07)';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    ctx.setLineDash([]);
  }

  // === MINIMAP ===

  drawMinimap(playerArmy, aiArmy, map) {
    const ctx    = this.ctx;
    const cam    = this.camera;
    const mSize  = 130;
    const margin = 12;
    const mx     = cam.canvas.width - mSize - margin;
    const my     = cam.canvas.height - mSize - margin - 108; // above floating card row

    // Background
    ctx.fillStyle   = map ? map.bgColor || '#a8d66e' : '#a8d66e';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth   = 1.5;
    ctx.fillRect(mx, my, mSize, mSize);
    ctx.strokeRect(mx, my, mSize, mSize);

    const toMM = (wx, wy) => ({
      x: mx + (wx / WORLD_W) * mSize,
      y: my + (wy / WORLD_H) * mSize,
    });

    // Draw terrain simplified
    if (map) {
      for (const t of (map.terrain || [])) {
        ctx.fillStyle = t.color;
        ctx.beginPath();
        const [fx, fy] = t.polygon[0];
        const fp = toMM(fx, fy);
        ctx.moveTo(fp.x, fp.y);
        for (let i = 1; i < t.polygon.length; i++) {
          const p = toMM(t.polygon[i][0], t.polygon[i][1]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fill();
      }
      for (const f of (map.forests || [])) {
        ctx.fillStyle = f.color;
        ctx.beginPath();
        const [fx, fy] = f.polygon[0];
        const fp = toMM(fx, fy);
        ctx.moveTo(fp.x, fp.y);
        for (let i = 1; i < f.polygon.length; i++) {
          const p = toMM(f.polygon[i][0], f.polygon[i][1]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    // Units
    const drawMM = (units, color) => {
      ctx.fillStyle = color;
      for (const u of units) {
        if (u.isShattered) continue;
        const p = toMM(u.x, u.y);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    drawMM(playerArmy, TEAM_COLORS[0]);
    drawMM(aiArmy,     TEAM_COLORS[1]);

    // Viewport rect
    const b = cam.viewBounds;
    const vx1 = mx + Math.max(0, (b.left  / WORLD_W)) * mSize;
    const vy1 = my + Math.max(0, (b.top   / WORLD_H)) * mSize;
    const vx2 = mx + Math.min(1, (b.right / WORLD_W)) * mSize;
    const vy2 = my + Math.min(1, (b.bottom/ WORLD_H)) * mSize;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(vx1, vy1, vx2 - vx1, vy2 - vy1);

    // Label
    ctx.fillStyle  = 'rgba(255,255,255,0.7)';
    ctx.font       = '9px sans-serif';
    ctx.fillText('MAP', mx + 4, my + 10);
  }

  // === BATTLE END SCREEN ===

  drawBattleEndScreen(result) {
    if (!result) return;
    const ctx = this.ctx;
    const cw  = ctx.canvas.width;
    const ch  = ctx.canvas.height;

    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, cw, ch);

    const bw = 460;
    const bh = 340;
    const bx = (cw - bw) / 2;
    const by = (ch - bh) / 2;

    ctx.fillStyle   = '#1a1a2a';
    ctx.strokeStyle = result.won ? '#ddaa00' : '#aa3322';
    ctx.lineWidth   = 3;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeRect(bx, by, bw, bh);

    // Title
    ctx.fillStyle  = result.won ? '#ddaa00' : '#ff5533';
    ctx.font       = 'bold 30px serif';
    ctx.textAlign  = 'center';
    ctx.fillText(result.won ? 'VICTORY' : 'DEFEAT', cw / 2, by + 52);

    // Victory type
    ctx.fillStyle = '#dddddd';
    ctx.font      = '18px serif';
    ctx.fillText(result.type, cw / 2, by + 88);

    // Stats
    ctx.font      = '14px sans-serif';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText(`Enemy soldiers killed: ${result.enemyKills}`, cw / 2, by + 130);
    ctx.fillText(`Own casualties: ${result.ownLosses}`, cw / 2, by + 155);
    ctx.fillText(`Battle duration: ${_formatTime(result.duration)}`, cw / 2, by + 180);

    // Buttons (drawn, handled by battleUI click check)
    _drawButton(ctx, bx + 50,  by + bh - 70, 160, 40, 'Restart Battle',  '#335522');
    _drawButton(ctx, bx + 250, by + bh - 70, 160, 40, 'Army Builder',    '#223355');

    ctx.textAlign = 'left';
  }
}

// Helpers
function _moraleColor(state) {
  switch (state) {
    case MORALE_STATE.STEADY:    return FLAG_STEADY;
    case MORALE_STATE.WAVERING:  return FLAG_WAVERING;
    case MORALE_STATE.ROUTING:   return FLAG_ROUTING;
    case MORALE_STATE.BROKEN:    return FLAG_BROKEN;
    case MORALE_STATE.SHATTERED: return FLAG_SHATTERED;
    default: return FLAG_STEADY;
  }
}

function _moraleBarColor(state) {
  switch (state) {
    case MORALE_STATE.STEADY:    return '#22bb44';
    case MORALE_STATE.WAVERING:  return '#ddaa00';
    case MORALE_STATE.ROUTING:   return '#dd4422';
    case MORALE_STATE.BROKEN:    return '#884422';
    case MORALE_STATE.SHATTERED: return '#444444';
    default: return '#22bb44';
  }
}

function _formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function _drawButton(ctx, x, y, w, h, label, bg) {
  ctx.fillStyle   = bg;
  ctx.strokeStyle = '#aaaaaa';
  ctx.lineWidth   = 1.5;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle  = '#ffffff';
  ctx.font       = '13px sans-serif';
  ctx.textAlign  = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 5);
}

// ── Cartoon soldier sprite (Fire & Maneuver style) ──────────────────
// Drawn in formation-local screen coords (px, py = centre of soldier slot)
function _drawCartoonSoldier(ctx, px, py, uniformColor, darkColor) {
  const bw = 6;    // body width
  const bh = 10;   // body height
  const hr = 4.5;  // head radius
  const hh = 5;    // shako (hat) height
  const hw = 5;    // shako half-width

  const bodyTop = py - bh * 0.5;
  const headCY  = bodyTop - hr + 1;
  const hatBot  = headCY - hr + 1;
  const hatTop  = hatBot - hh;

  // ── Black outlines (drawn 1-1.5px larger) ──
  ctx.fillStyle = '#111';
  // Hat outline
  ctx.fillRect(px - hw - 1, hatTop - 1, (hw + 1) * 2, hh + 1.5);
  // Head outline
  ctx.beginPath();
  ctx.arc(px, headCY, hr + 1.2, 0, Math.PI * 2);
  ctx.fill();
  // Body outline
  ctx.fillRect(px - bw / 2 - 1, bodyTop - 1, bw + 2, bh + 2);

  // ── Uniform body ──
  ctx.fillStyle = uniformColor;
  ctx.fillRect(px - bw / 2, bodyTop, bw, bh);

  // ── White crossbelt ──
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(px - 1, bodyTop, 2, bh);
  ctx.fillRect(px - bw / 2, bodyTop + bh * 0.4, bw, 1.5);

  // ── Skin tone head ──
  ctx.fillStyle = '#f2b97a';
  ctx.beginPath();
  ctx.arc(px, headCY, hr, 0, Math.PI * 2);
  ctx.fill();

  // ── Face detail — eyes ──
  ctx.fillStyle = '#333';
  ctx.fillRect(px - 2, headCY - 1, 1.5, 1.5);
  ctx.fillRect(px + 0.5, headCY - 1, 1.5, 1.5);

  // ── Shako (tall military hat) ──
  ctx.fillStyle = darkColor;
  ctx.fillRect(px - hw, hatTop, hw * 2, hh);
  // Hat brim
  ctx.fillStyle = '#111';
  ctx.fillRect(px - hw - 1, hatBot - 1.5, (hw + 1) * 2, 2);
  // Hat badge (tiny white dot)
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(px, hatTop + 2, 1.2, 0, Math.PI * 2);
  ctx.fill();
}

// Darken a hex color for hats and shadow details
function _darkenHex(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dr = Math.max(0, Math.round(r * 0.45));
  const dg = Math.max(0, Math.round(g * 0.45));
  const db = Math.max(0, Math.round(b * 0.45));
  return `rgb(${dr},${dg},${db})`;
}

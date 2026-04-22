import {
  LOD_FAR_MAX, LOD_MID_MAX, TEAM_COLORS, MORALE_STATE,
  WORLD_W, WORLD_H, DEPLOY_ZONE_PLAYER, DEPLOY_ZONE_AI, SS, RANK_DEPTH, SOLDIER_SPACING,
  MUSKET_RANGE, ARTILLERY_RANGE,
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

    // Hills and flat terrain — NTW style with visible dark outlines
    for (const t of (map.terrain || [])) {
      this._drawPolygon(t.polygon, t.color, 'rgba(0,0,0,0.35)', 1.5);
    }

    // Forests
    for (const f of (map.forests || [])) {
      this._drawPolygon(f.polygon, f.color, 'rgba(0,0,0,0.4)', 2);
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
    const ctx       = this.ctx;
    const cam       = this.camera;
    const sx        = cam.wx(unit.x);
    const sy        = cam.wy(unit.y);
    const teamColor = TEAM_COLORS[unit.team];
    const darkColor = _darkenHex(teamColor);
    const cosF      = Math.cos(unit.facing);
    const sinF      = Math.sin(unit.facing);
    const ranks     = unit.currentRanks;
    const alive     = unit.aliveCount;
    const max       = unit.maxCount;

    // Compact visual block — width matches actual soldier spread, height scales with rank count
    const fw = Math.max(36, cam.wLen(unit.frontWidth + SOLDIER_SPACING));
    const fh = Math.max(8, fw * ranks / 6.0);

    if (cam.scale < 1.0) {
      // ── FAR VIEW: solid formation rectangle, like the reference screenshot ──
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(unit.facing);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-fw / 2 + 3, -fh / 2 + 3, fw, fh);

      // Main body — team color, full opacity
      ctx.fillStyle = teamColor;
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh);

      // Casualties shown as a darker right-side strip
      const deadW = fw * (1 - alive / max);
      if (deadW > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(fw / 2 - deadW, -fh / 2, deadW, fh);
      }

      // Thin highlight line across top
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(-fw / 2, -fh / 2, fw, 2);

      // Border
      ctx.strokeStyle = selected ? SELECTION_CLR : 'rgba(0,0,0,0.7)';
      ctx.lineWidth   = selected ? 2.5 : 1.5;
      ctx.strokeRect(-fw / 2, -fh / 2, fw, fh);

      ctx.restore();

    } else {
      // ── CLOSE VIEW: individual soldiers with NTW sprites ──
      if (selected) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(unit.facing);
        ctx.strokeStyle = SELECTION_CLR;
        ctx.shadowColor = SELECTION_CLR;
        ctx.shadowBlur  = 10;
        ctx.lineWidth   = 3;
        ctx.strokeRect(-fw / 2 - 3, -fh / 2 - 3, fw + 6, fh + 6);
        ctx.shadowBlur  = 0;
        ctx.restore();
      }

      for (const s of unit.soldiers) {
        if (s.state === SS.DEAD) continue;
        _drawSoldierLOD(ctx, cam.wx(s.x), cam.wy(s.y), unit.facing, teamColor, darkColor, cam.scale);
      }
    }

    // Flag always drawn above formation front
    const flagX = sx + sinF * (fh / 2 + 4);
    const flagY = sy - cosF * (fh / 2 + 4);
    this._drawFlag(unit, flagX, flagY, unit.team);
  }

  _drawFlag(unit, sx, sy, team) {
    const ctx  = this.ctx;
    const pct  = unit.aliveCount / unit.maxCount;
    const moraleCol = _moraleColor(unit.moraleState);

    // Pole
    const poleH = 28;
    ctx.lineWidth   = 3;
    ctx.strokeStyle = '#111';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - poleH); ctx.stroke();
    ctx.lineWidth   = 1.8;
    ctx.strokeStyle = '#9a6820';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - poleH); ctx.stroke();
    // Pole finial (gold ball)
    ctx.fillStyle = '#ddaa00';
    ctx.beginPath(); ctx.arc(sx, sy - poleH, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(sx, sy - poleH, 2.5, 0, Math.PI * 2); ctx.stroke();

    // Flag cloth
    const fw = 18;
    const fh = 14;
    const fx = sx + 2;
    const fy = sy - poleH + 2;

    if (pct < 0.45) {
      // Tattered flag
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.moveTo(fx - 1, fy - 1);
      ctx.lineTo(fx + fw + 2, fy + fh * 0.2);
      ctx.lineTo(fx + fw * 0.6, fy + fh * 0.5);
      ctx.lineTo(fx + fw + 1, fy + fh * 0.85);
      ctx.lineTo(fx - 1, fy + fh + 1);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = moraleCol;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + fw, fy + fh * 0.2);
      ctx.lineTo(fx + fw * 0.6, fy + fh * 0.5);
      ctx.lineTo(fx + fw, fy + fh * 0.85);
      ctx.lineTo(fx, fy + fh);
      ctx.closePath(); ctx.fill();
    } else {
      // Full tricolor-style flag
      const teamColors = team === 0
        ? ['#ffffff', '#cc2211', '#1133aa'] // player: white/red/blue (British RWB)
        : ['#1133aa', '#ffffff', '#cc2211']; // AI: blue/white/red (French tricolor)
      const sw = fw / 3;
      // Outline
      ctx.fillStyle = '#111';
      ctx.fillRect(fx - 1, fy - 1, fw + 2, fh + 2);
      // Three vertical stripes
      for (let s = 0; s < 3; s++) {
        ctx.fillStyle = teamColors[s];
        ctx.fillRect(fx + s * sw, fy, sw, fh);
      }
      // Thin black border lines between stripes
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(fx, fy, fw, fh);
      ctx.beginPath();
      ctx.moveTo(fx + sw, fy); ctx.lineTo(fx + sw, fy + fh);
      ctx.moveTo(fx + sw * 2, fy); ctx.lineTo(fx + sw * 2, fy + fh);
      ctx.stroke();
      // Morale dot in center of flag
      ctx.fillStyle = moraleCol;
      ctx.beginPath();
      ctx.arc(fx + fw / 2, fy + fh / 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
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

  drawFormationPreview(fd) {
    if (!fd || !fd.active || !fd.corners) return;
    const ctx = this.ctx;
    const cam = this.camera;
    const [p1, p2, p3, p4] = fd.corners;

    ctx.save();

    // ── Ghost soldier dots ──────────────────────────────────────
    if (fd.ghosts && fd.ghosts.length > 0) {
      ctx.fillStyle = 'rgba(255,230,80,0.55)';
      for (const g of fd.ghosts) {
        if (!cam.isVisible(g.x, g.y, 4)) continue;
        ctx.beginPath();
        ctx.arc(cam.wx(g.x), cam.wy(g.y), 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Rectangle outline ───────────────────────────────────────
    ctx.beginPath();
    ctx.moveTo(cam.wx(p1.x), cam.wy(p1.y));
    ctx.lineTo(cam.wx(p2.x), cam.wy(p2.y));
    ctx.lineTo(cam.wx(p3.x), cam.wy(p3.y));
    ctx.lineTo(cam.wx(p4.x), cam.wy(p4.y));
    ctx.closePath();
    ctx.fillStyle   = 'rgba(255,230,0,0.07)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,0,0.60)';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([6, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Bright solid front edge ─────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,120,0.95)';
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.moveTo(cam.wx(p1.x), cam.wy(p1.y));
    ctx.lineTo(cam.wx(p2.x), cam.wy(p2.y));
    ctx.stroke();

    // ── Unit-slice dividers ─────────────────────────────────────
    if (fd.unitCount > 1) {
      ctx.strokeStyle = 'rgba(255,230,0,0.40)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([3, 4]);
      for (let i = 1; i < fd.unitCount; i++) {
        const t  = i / fd.unitCount;
        const fx = p1.x + (p2.x - p1.x) * t;
        const fy = p1.y + (p2.y - p1.y) * t;
        const rx = p4.x + (p3.x - p4.x) * t;
        const ry = p4.y + (p3.y - p4.y) * t;
        ctx.beginPath();
        ctx.moveTo(cam.wx(fx), cam.wy(fy));
        ctx.lineTo(cam.wx(rx), cam.wy(ry));
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // ── Facing arrow on front edge (points toward enemy) ────────
    const mx  = cam.wx((p1.x + p2.x) / 2);
    const my  = cam.wy((p1.y + p2.y) / 2);
    const adx =  Math.sin(fd.facing); // world-space forward = screen-space forward
    const ady = -Math.cos(fd.facing);
    const perpX = -ady, perpY = adx;   // 90° rotation
    const aLen = 20, aHW = 9;

    ctx.fillStyle   = 'rgba(255,255,100,0.95)';
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(mx + adx * aLen,             my + ady * aLen);             // tip
    ctx.lineTo(mx + perpX * aHW,            my + perpY * aHW);            // left base
    ctx.lineTo(mx - perpX * aHW,            my - perpY * aHW);            // right base
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  // === FIRING RANGE ===

  drawFiringRanges(selectedUnits) {
    if (!selectedUnits || selectedUnits.length === 0) return;
    const ctx = this.ctx;
    const cam = this.camera;

    for (const unit of selectedUnits) {
      if (unit.isShattered || unit.isDead) continue;

      const range = unit.stats.isArtillery ? ARTILLERY_RANGE : MUSKET_RANGE;
      const r     = cam.wLen(range);
      if (r < 4) continue;

      const sx = cam.wx(unit.x);
      const sy = cam.wy(unit.y);

      // Canvas forward angle: game facing 0=north, canvas 0=east → offset -PI/2
      // Arc spans ±60° from the forward direction (120° total cone)
      const fwdCanvas = unit.facing - Math.PI / 2;
      const spread    = Math.PI / 3; // 60°
      const arcLA     = fwdCanvas - spread;
      const arcRA     = fwdCanvas + spread;

      // Arc endpoints in screen space
      const arcLX = sx + r * Math.cos(arcLA);
      const arcLY = sy + r * Math.sin(arcLA);
      const arcRX = sx + r * Math.cos(arcRA);
      const arcRY = sy + r * Math.sin(arcRA);

      // Unit flank positions — lines start at formation edges, not center
      // Right screen vector matches world right vector: (cos(facing), sin(facing))
      const hw   = cam.wLen(Math.max(unit.frontWidth / 2, 15));
      const rtSX = Math.cos(unit.facing);
      const rtSY = Math.sin(unit.facing);
      const lfx  = sx - rtSX * hw,  lfy = sy - rtSY * hw;
      const rfx  = sx + rtSX * hw,  rfy = sy + rtSY * hw;

      const depleted = unit.ammo <= 0;

      ctx.save();

      // Fill (closed — includes open bottom edge for canvas fill to work)
      ctx.beginPath();
      ctx.moveTo(lfx, lfy);
      ctx.lineTo(arcLX, arcLY);
      ctx.arc(sx, sy, r, arcLA, arcRA, false);
      ctx.lineTo(rfx, rfy);
      ctx.closePath();
      ctx.fillStyle = depleted ? 'rgba(150,150,150,0.05)' : 'rgba(210,50,20,0.07)';
      ctx.fill();

      // Stroke — only the 3 outer edges (left line, arc, right line); bottom left open
      ctx.beginPath();
      ctx.moveTo(lfx, lfy);
      ctx.lineTo(arcLX, arcLY);
      ctx.arc(sx, sy, r, arcLA, arcRA, false);
      ctx.lineTo(rfx, rfy);
      ctx.strokeStyle = depleted ? 'rgba(180,180,180,0.55)' : 'rgba(220,70,40,0.85)';
      ctx.lineWidth   = 1.8;
      ctx.stroke();

      ctx.restore();
    }
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

// ── Close-zoom soldier: simple circle ───────────────────────────────
function _drawSoldierLOD(ctx, sx, sy, facing, uniformColor, darkColor, scale) {
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = uniformColor;
  ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill();
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

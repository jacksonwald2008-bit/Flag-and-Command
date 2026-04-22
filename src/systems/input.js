import { TEAM_PLAYER, CAMERA_PAN_SPEED, SOLDIER_SPACING, RANK_DEPTH } from '../constants.js';
import { moveToPoint } from './formation.js';

const DRAG_THRESHOLD = 8; // pixels before treating as drag

export class InputHandler {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game   = game;

    // Box select state
    this._boxStart  = null;
    this._boxEnd    = null;
    this._isBoxing  = false;

    // Formation drag (right-drag) state
    this._rmDown       = false;
    this._rmDownPos    = null;  // screen coords of mousedown
    this._rmStartWorld = null;  // world coords of mousedown (front-left anchor)

    // Middle-mouse pan
    this._mmDown     = false;
    this._mmLastPos  = null;

    // Held keys
    this._keys = {};

    canvas.addEventListener('mousedown',  e => this._onMouseDown(e));
    canvas.addEventListener('mousemove',  e => this._onMouseMove(e));
    canvas.addEventListener('mouseup',    e => this._onMouseUp(e));
    canvas.addEventListener('wheel',      e => this._onWheel(e), { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown',    e => this._onKeyDown(e));
    window.addEventListener('keyup',      e => this._onKeyUp(e));
  }

  _screenToWorld(e) {
    const cam = this.game.camera;
    return { x: cam.sx(e.offsetX), y: cam.sy(e.offsetY) };
  }

  update(dt) {
    const cam = this.game.camera;
    const st  = this.game.state;
    if (st !== 'battle' && st !== 'deployment') return;

    const PAN_SPEED = (CAMERA_PAN_SPEED / cam.scale) * (this._keys['shift'] ? 1.65 : 1);
    let vx = 0, vy = 0;
    if (this._keys['a']) vx -= 1;
    if (this._keys['d']) vx += 1;
    if (this._keys['w']) vy -= 1;
    if (this._keys['s']) vy += 1;

    if (vx !== 0 || vy !== 0) {
      cam.x += vx * PAN_SPEED * dt;
      cam.y += vy * PAN_SPEED * dt;
      cam.clamp();
    }

  }

  _onMouseDown(e) {
    if (this.game.state !== 'battle' && this.game.state !== 'deployment') return;

    if (e.button === 0) {
      // Left mouse — start box select
      this._boxStart = { x: e.offsetX, y: e.offsetY };
      this._boxEnd   = { x: e.offsetX, y: e.offsetY };
      this._isBoxing = false;
    }

    if (e.button === 1) {
      // Middle mouse — pan
      this._mmDown   = true;
      this._mmLastPos = { x: e.offsetX, y: e.offsetY };
      e.preventDefault();
    }

    if (e.button === 2) {
      // Right mouse — formation drag start (front-left anchor)
      this._rmDown       = true;
      this._rmDownPos    = { x: e.offsetX, y: e.offsetY };
      this._rmStartWorld = this._screenToWorld(e);
      this.game.formationDraw = { active: false, corners: null };
    }
  }

  _onMouseMove(e) {
    const cam = this.game.camera;

    if (this._mmDown && this._mmLastPos) {
      const sdx = e.offsetX - this._mmLastPos.x;
      const sdy = e.offsetY - this._mmLastPos.y;
      cam.pan(sdx, sdy);
      this._mmLastPos = { x: e.offsetX, y: e.offsetY };
    }

    if (this._boxStart) {
      this._boxEnd = { x: e.offsetX, y: e.offsetY };
      const dx = e.offsetX - this._boxStart.x;
      const dy = e.offsetY - this._boxStart.y;
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) this._isBoxing = true;
    }

    if (this._rmDown && this._rmStartWorld) {
      const sdx = e.offsetX - this._rmDownPos.x;
      const sdy = e.offsetY - this._rmDownPos.y;
      if (Math.sqrt(sdx * sdx + sdy * sdy) >= DRAG_THRESHOLD) {
        const endWorld = this._screenToWorld(e);
        const selected = this.game.selectedUnits.filter(u => u.team === TEAM_PLAYER);
        if (selected.length > 0) {
          this.game.formationDraw = this._computeFormationRect(
            this._rmStartWorld, endWorld, selected,
          );
        }
      }
    }
  }

  _onMouseUp(e) {
    const cam  = this.game.camera;
    const game = this.game;

    if (e.button === 1) {
      this._mmDown    = false;
      this._mmLastPos = null;
    }

    if (e.button === 0 && this._boxStart) {
      if (this._isBoxing) {
        // Box select
        this._boxSelectUnits(this._boxStart, this._boxEnd);
      } else {
        // Single click — select unit under cursor or deselect
        const wp = this._screenToWorld(e);
        this._singleSelect(wp.x, wp.y, e.shiftKey);
      }
      this._boxStart = null;
      this._boxEnd   = null;
      this._isBoxing = false;
    }

    if (e.button === 2 && this._rmDown) {
      this._rmDown = false;
      game.formationDraw = { active: false, corners: null };

      const selectedPlayerUnits = game.selectedUnits.filter(u => u.team === TEAM_PLAYER);
      if (!selectedPlayerUnits.length) return;

      const sdx = e.offsetX - this._rmDownPos.x;
      const sdy = e.offsetY - this._rmDownPos.y;
      const dragDist = Math.sqrt(sdx * sdx + sdy * sdy);

      if (dragDist < DRAG_THRESHOLD) {
        // Simple right-click: move to point
        const wp = this._screenToWorld(e);
        const enemyUnit = this._unitAtWorld(wp.x, wp.y, 1);
        if (enemyUnit) {
          for (const u of selectedPlayerUnits) {
            const ex = enemyUnit.x - u.x, ey = enemyUnit.y - u.y;
            const el = Math.hypot(ex, ey);
            u.moveTo(
              enemyUnit.x - (ex / el) * 30,
              enemyUnit.y - (ey / el) * 30,
              Math.atan2(ex, -ey),
            );
          }
          return;
        }
        moveToPoint(selectedPlayerUnits, wp.x, wp.y);
      } else {
        // Formation drag: place units along dragged front line
        const endWorld = this._screenToWorld(e);
        const fd = this._computeFormationRect(this._rmStartWorld, endWorld, selectedPlayerUnits);
        this._applyFormationRect(fd, selectedPlayerUnits);
      }
    }
  }

  // Build the 4-corner formation rectangle from a drag start/end in world coords
  _computeFormationRect(startW, endW, units) {
    const fl  = startW;
    const dx  = endW.x - fl.x;
    const dy  = endW.y - fl.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return { active: false, corners: null };

    const N = units.length;

    // Clamp drag length: max = min-2-rank width per unit, min = 4-file width
    const minLen = N * 4 * SOLDIER_SPACING;
    const maxLen = Math.max(minLen,
      units.reduce((s, u) => s + Math.ceil(u.aliveCount / 2), 0) * SOLDIER_SPACING);
    const clampedLen = Math.max(minLen, Math.min(maxLen, len));

    // Clamped front-right point
    const fr = {
      x: fl.x + (dx / len) * clampedLen,
      y: fl.y + (dy / len) * clampedLen,
    };

    // Facing: perpendicular to front line, pointing toward enemy (north = negative y)
    let nx = -dy / len;
    let ny =  dx / len;
    if (ny > 0) { nx = -nx; ny = -ny; }
    const facing = Math.atan2(nx, -ny);

    // Rectangle extends BEHIND the front line (opposite of facing direction)
    const fwdX = Math.sin(facing), fwdY = -Math.cos(facing);
    const rtX  = Math.cos(facing), rtY  =  Math.sin(facing);
    const bx = -fwdX, by = -fwdY; // backward direction

    let maxRanks = 2;
    for (let i = 0; i < N; i++) {
      const files = Math.max(4, Math.floor((clampedLen / N) / SOLDIER_SPACING));
      const ranks = Math.max(2, Math.ceil(units[i].aliveCount / files));
      if (ranks > maxRanks) maxRanks = ranks;
    }
    const depth = maxRanks * RANK_DEPTH;

    const corners = [
      { x: fl.x,              y: fl.y },
      { x: fr.x,              y: fr.y },
      { x: fr.x + bx * depth, y: fr.y + by * depth },
      { x: fl.x + bx * depth, y: fl.y + by * depth },
    ];

    // Ghost soldier positions for preview dots
    const ghosts = [];
    for (let i = 0; i < N; i++) {
      const t  = (i + 0.5) / N;
      const cx = fl.x + (fr.x - fl.x) * t;
      const cy = fl.y + (fr.y - fl.y) * t;
      const sliceW   = clampedLen / N;
      const files    = Math.max(4, Math.floor(sliceW / SOLDIER_SPACING));
      const ranks    = Math.max(2, Math.ceil(units[i].aliveCount / files));
      const alive    = units[i].aliveCount;
      const perRank  = Math.ceil(alive / ranks);
      const step     = Math.max(1, Math.round(alive / 60)); // cap at ~60 dots per unit

      for (let r = 0; r < ranks; r++) {
        const rankCount = Math.min(perRank, alive - r * perRank);
        if (rankCount <= 0) break;
        for (let f = 0; f < rankCount; f += step) {
          const offR = (f - (rankCount - 1) / 2) * SOLDIER_SPACING;
          const offB = r * RANK_DEPTH;
          ghosts.push({
            x: cx + rtX * offR + bx * offB,
            y: cy + rtY * offR + by * offB,
          });
        }
      }
    }

    return {
      active: true, corners, facing,
      frontLeft: fl, frontRight: fr,
      dragLen: clampedLen, unitCount: N, ghosts,
    };
  }

  // Move selected units into the dragged formation rectangle
  _applyFormationRect(fd, units) {
    if (!fd.active) return;
    const { frontLeft: fl, frontRight: fr, facing, dragLen } = fd;
    const dx = fr.x - fl.x;
    const dy = fr.y - fl.y;
    const N  = units.length;

    for (let i = 0; i < N; i++) {
      const t0 = i / N;
      const t1 = (i + 1) / N;
      const cx = fl.x + dx * (t0 + t1) / 2;
      const cy = fl.y + dy * (t0 + t1) / 2;

      const sliceW = dragLen / N;
      const files  = Math.max(4, Math.floor(sliceW / SOLDIER_SPACING));
      const ranks  = Math.max(2, Math.ceil(units[i].aliveCount / files));

      units[i].currentRanks = ranks;
      units[i].moveTo(cx, cy, facing);
    }
  }

  _onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    this.game.camera.zoom(factor, e.offsetX, e.offsetY);
  }

  _onKeyDown(e) {
    const key  = e.key.toLowerCase();
    this._keys[key] = true;

    const game = this.game;
    const inPlay = game.state === 'battle' || game.state === 'deployment';

    if (inPlay && ['w','a','s','d',' '].includes(key)) e.preventDefault();

    switch (e.key) {
      case ' ':
        game.togglePause();
        break;
      case '1': game.setSpeed(1); break;
      case '2': game.setSpeed(2); break;
      case '3': game.setSpeed(3); break;
      case 'Escape':
        game.selectedUnits = [];
        break;
    }
  }

  _onKeyUp(e) {
    this._keys[e.key.toLowerCase()] = false;
  }

  _singleSelect(wx, wy, additive) {
    const unit = this._unitAtWorld(wx, wy, TEAM_PLAYER);
    if (!unit) {
      if (!additive) this.game.selectedUnits = [];
      return;
    }
    if (additive) {
      const idx = this.game.selectedUnits.indexOf(unit);
      if (idx === -1) this.game.selectedUnits.push(unit);
      else this.game.selectedUnits.splice(idx, 1);
    } else {
      this.game.selectedUnits = [unit];
    }
  }

  _boxSelectUnits(start, end) {
    const cam  = this.game.camera;
    const minX = cam.sx(Math.min(start.x, end.x));
    const maxX = cam.sx(Math.max(start.x, end.x));
    const minY = cam.sy(Math.min(start.y, end.y));
    const maxY = cam.sy(Math.max(start.y, end.y));

    this.game.selectedUnits = this.game.playerArmy.filter(u => {
      return !u.isShattered &&
             u.x >= minX && u.x <= maxX &&
             u.y >= minY && u.y <= maxY;
    });
  }

  _unitAtWorld(wx, wy, team) {
    const army = team === TEAM_PLAYER ? this.game.playerArmy : this.game.aiArmy;
    for (const u of army) {
      if (u.isShattered) continue;
      const dx = u.x - wx;
      const dy = u.y - wy;
      if (Math.sqrt(dx * dx + dy * dy) <= Math.max(u.boundRadius, 20)) return u;
    }
    return null;
  }

  getBoxSelectRect() {
    if (!this._isBoxing || !this._boxStart || !this._boxEnd) return null;
    return {
      x:      Math.min(this._boxStart.x, this._boxEnd.x),
      y:      Math.min(this._boxStart.y, this._boxEnd.y),
      width:  Math.abs(this._boxEnd.x - this._boxStart.x),
      height: Math.abs(this._boxEnd.y - this._boxStart.y),
    };
  }

}

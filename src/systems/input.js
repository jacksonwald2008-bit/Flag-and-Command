import { TEAM_PLAYER } from '../constants.js';
import { moveToPoint, pathToFormationLine } from './formation.js';

const DRAG_THRESHOLD  = 8;   // pixels before treating as drag
const PATH_SAMPLE_PX  = 12;  // pixels between path samples

export class InputHandler {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game   = game;

    // Box select state
    this._boxStart  = null;
    this._boxEnd    = null;
    this._isBoxing  = false;

    // Formation draw (right-drag) state
    this._rmDown     = false;
    this._rmDownPos  = null;
    this._rmPath     = [];
    this._lastSample = null;

    // Middle-mouse pan
    this._mmDown     = false;
    this._mmLastPos  = null;

    canvas.addEventListener('mousedown',  e => this._onMouseDown(e));
    canvas.addEventListener('mousemove',  e => this._onMouseMove(e));
    canvas.addEventListener('mouseup',    e => this._onMouseUp(e));
    canvas.addEventListener('wheel',      e => this._onWheel(e), { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown',    e => this._onKeyDown(e));
  }

  _screenToWorld(e) {
    const cam = this.game.camera;
    return { x: cam.sx(e.offsetX), y: cam.sy(e.offsetY) };
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
      // Right mouse — formation draw start
      this._rmDown    = true;
      this._rmDownPos = { x: e.offsetX, y: e.offsetY };
      const wp = this._screenToWorld(e);
      this._rmPath    = [{ x: wp.x, y: wp.y }];
      this._lastSample = { x: e.offsetX, y: e.offsetY };
      this.game.formationDraw = { active: true, path: this._rmPath };
    }
  }

  _onMouseMove(e) {
    const cam = this.game.camera;

    if (this._mmDown && this._mmLastPos) {
      const dx = e.offsetX - this._mmLastPos.x;
      const dy = e.offsetY - this._mmLastPos.y;
      cam.pan(dx, dy);
      this._mmLastPos = { x: e.offsetX, y: e.offsetY };
    }

    if (this._boxStart) {
      this._boxEnd = { x: e.offsetX, y: e.offsetY };
      const dx = e.offsetX - this._boxStart.x;
      const dy = e.offsetY - this._boxStart.y;
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) this._isBoxing = true;
    }

    if (this._rmDown && this._lastSample) {
      const dx = e.offsetX - this._lastSample.x;
      const dy = e.offsetY - this._lastSample.y;
      if (Math.sqrt(dx * dx + dy * dy) >= PATH_SAMPLE_PX) {
        const wp = this._screenToWorld(e);
        this._rmPath.push({ x: wp.x, y: wp.y });
        this._lastSample = { x: e.offsetX, y: e.offsetY };
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
      game.formationDraw = { active: false, path: [] };

      const selectedPlayerUnits = game.selectedUnits.filter(u => u.team === TEAM_PLAYER);
      if (!selectedPlayerUnits.length) return;

      const startPos = this._rmDownPos;
      const dx = e.offsetX - startPos.x;
      const dy = e.offsetY - startPos.y;
      const dragDist = Math.sqrt(dx * dx + dy * dy);

      if (dragDist < DRAG_THRESHOLD) {
        // Simple right-click: move to point
        const wp = this._screenToWorld(e);

        // Check if clicking on an enemy unit (attack order)
        const enemyUnit = this._unitAtWorld(wp.x, wp.y, 1); // team 1 = AI
        if (enemyUnit) {
          // Attack order: move toward enemy
          for (const u of selectedPlayerUnits) {
            const dx2 = enemyUnit.x - u.x;
            const dy2 = enemyUnit.y - u.y;
            const len = Math.hypot(dx2, dy2);
            u.moveTo(
              enemyUnit.x - (dx2 / len) * 30,
              enemyUnit.y - (dy2 / len) * 30,
              Math.atan2(dx2, -dy2),
            );
          }
          return;
        }

        moveToPoint(selectedPlayerUnits, wp.x, wp.y);
      } else {
        // Formation draw
        const line = pathToFormationLine(this._rmPath);
        if (line) {
          const orders = await_distributeUnitsOnLine(line, selectedPlayerUnits);
          for (let i = 0; i < orders.length; i++) {
            selectedPlayerUnits[i].moveTo(orders[i].x, orders[i].y, orders[i].facing);
          }
        }
      }
      this._rmPath = [];
    }
  }

  _onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    this.game.camera.zoom(factor, e.offsetX, e.offsetY);
  }

  _onKeyDown(e) {
    const game = this.game;
    switch (e.key) {
      case ' ':
        e.preventDefault();
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

  getFormationPath() {
    return this.game.formationDraw.active ? this._rmPath : null;
  }
}

// Helper to avoid circular — inline distribute
function await_distributeUnitsOnLine(line, units) {
  const n = units.length;
  const orders = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const px = line.x1 + (line.x2 - line.x1) * t;
    const py = line.y1 + (line.y2 - line.y1) * t;
    const toCenterX = 750 - px;
    const toCenterY = 750 - py;
    const normCW  = { x:  line.dy, y: -line.dx };
    const normCCW = { x: -line.dy, y:  line.dx };
    const dotCW   = normCW.x  * toCenterX + normCW.y  * toCenterY;
    const dotCCW  = normCCW.x * toCenterX + normCCW.y * toCenterY;
    const norm    = dotCW > dotCCW ? normCW : normCCW;
    const facing  = Math.atan2(norm.x, -norm.y);
    orders.push({ x: px, y: py, facing });
  }
  return orders;
}

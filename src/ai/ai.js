import { US, MUSKET_RANGE, ARTILLERY_RANGE, MORALE_STATE } from '../constants.js';

const AI_TICK_INTERVAL = 1.5; // seconds between AI decisions
const ADVANCE_STOP_DIST = 55; // meters — stop advancing when this close to enemy line

export class AIController {
  constructor(game) {
    this.game = game;
    this.timer = 0;
    this.phase = 'advance'; // advance | hold | flank | rally
  }

  reset() {
    this.timer = 0;
    this.phase = 'advance';
  }

  update(dt) {
    this.timer += dt;
    if (this.timer < AI_TICK_INTERVAL) return;
    this.timer = 0;
    this._decide();
  }

  _decide() {
    const { aiArmy, playerArmy } = this.game;
    const aliveAI = aiArmy.filter(u => !u.isShattered && !u.isDead);
    const alivePlayer = playerArmy.filter(u => !u.isShattered && !u.isDead);
    if (!aliveAI.length || !alivePlayer.length) return;

    // Compute center of enemy army
    let ex = 0, ey = 0;
    for (const u of alivePlayer) { ex += u.x; ey += u.y; }
    ex /= alivePlayer.length;
    ey /= alivePlayer.length;

    // Compute center of own army
    let ax = 0, ay = 0;
    for (const u of aliveAI) { ax += u.x; ay += u.y; }
    ax /= aliveAI.length;
    ay /= aliveAI.length;

    const armyDist = Math.hypot(ex - ax, ey - ay);

    // Phase transitions
    if (armyDist < ADVANCE_STOP_DIST * 1.2) this.phase = 'hold';
    else if (armyDist > ADVANCE_STOP_DIST * 2) this.phase = 'advance';

    for (const unit of aliveAI) {
      if (unit.moraleState === MORALE_STATE.ROUTING || unit.moraleState === MORALE_STATE.BROKEN) continue;

      const stats = unit.stats;

      // Artillery: find a good position behind lines and hold
      if (stats.isArtillery) {
        if (!unit.isMoving && _distToEnemy(unit, alivePlayer) > ARTILLERY_RANGE * 0.7) {
          const tx = ax + (ex - ax) * 0.3;
          const ty = ay + (ey - ay) * 0.3;
          this._moveUnit(unit, tx, ty);
        }
        continue;
      }

      // Cavalry: flank around the enemy
      if (stats.isCavalry) {
        this._flankMove(unit, alivePlayer, ex, ey, ax, ay);
        continue;
      }

      // Infantry
      const distToEnemy = _distToEnemy(unit, alivePlayer);

      if (this.phase === 'advance') {
        if (distToEnemy > ADVANCE_STOP_DIST) {
          // March toward nearest enemy
          const nearest = _nearestUnit(unit, alivePlayer);
          if (nearest) {
            const dx = nearest.x - unit.x;
            const dy = nearest.y - unit.y;
            const len = Math.hypot(dx, dy);
            // Stop at firing range
            const tx = nearest.x - (dx / len) * (ADVANCE_STOP_DIST * 0.85);
            const ty = nearest.y - (dy / len) * (ADVANCE_STOP_DIST * 0.85);
            this._moveUnit(unit, tx, ty);
          }
        }
      } else {
        // Hold line — face toward enemy and stop
        if (unit.isMoving && distToEnemy < ADVANCE_STOP_DIST * 1.5) {
          unit.targetX = unit.x;
          unit.targetY = unit.y;
          unit.isMoving = false;
          unit.state = US.IDLE;
        }
        // Face the nearest enemy
        const nearest = _nearestUnit(unit, alivePlayer);
        if (nearest && !unit.isMoving) {
          const dx = nearest.x - unit.x;
          const dy = nearest.y - unit.y;
          unit.targetFacing = Math.atan2(dx, -dy);
          unit.facing = _lerpAngle(unit.facing, unit.targetFacing, 0.3);
          unit.layoutFormation();
        }
      }
    }
  }

  _flankMove(unit, enemies, ex, ey, ax, ay) {
    if (unit.isMoving) return; // don't interrupt a cavalry move
    const nearest = _nearestUnit(unit, enemies);
    if (!nearest) return;
    const dist = Math.hypot(nearest.x - unit.x, nearest.y - unit.y);

    if (dist > MUSKET_RANGE * 0.8) {
      // Flank: offset 90° from direct path
      const dx = ex - ax;
      const dy = ey - ay;
      const len = Math.hypot(dx, dy) || 1;
      const flip = unit.x < 750 ? 1 : -1;
      const flankX = ex + (-dy / len) * 200 * flip;
      const flankY = ey + ( dx / len) * 200 * flip;
      this._moveUnit(unit, flankX, flankY);
    }
  }

  _moveUnit(unit, tx, ty) {
    const dx = tx - unit.x;
    const dy = ty - unit.y;
    if (Math.hypot(dx, dy) < 5) return;
    unit.moveTo(tx, ty, Math.atan2(dx, -dy));
  }
}

function _distToEnemy(unit, enemies) {
  let min = Infinity;
  for (const e of enemies) {
    const d = Math.hypot(e.x - unit.x, e.y - unit.y);
    if (d < min) min = d;
  }
  return min;
}

function _nearestUnit(unit, others) {
  let best = null, bestD = Infinity;
  for (const o of others) {
    const d = Math.hypot(o.x - unit.x, o.y - unit.y);
    if (d < bestD) { bestD = d; best = o; }
  }
  return best;
}

function _lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff >  Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return a + diff * t;
}

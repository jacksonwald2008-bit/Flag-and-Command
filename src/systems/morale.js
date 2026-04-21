import {
  MORALE_STATE, MORALE_GENERAL_BONUS, MORALE_GENERAL_AURA,
  MORALE_REGEN_RATE, MORALE_DECAY_COMBAT, MORALE_NEARBY_ROUT,
  MORALE_WAVERING_THRESHOLD, MORALE_ROUTING_THRESHOLD, MORALE_BROKEN_THRESHOLD,
  US,
} from '../constants.js';
import { setRoutDirection } from './movement.js';

export function updateMorale(allUnits, dt) {
  for (const unit of allUnits) {
    if (unit.isShattered || unit.isDead) continue;

    // === Passive regen when out of combat ===
    if (!unit.inCombat) {
      unit.restoreMorale(MORALE_REGEN_RATE * dt);
    } else {
      // Minor morale drain from sustained combat
      unit.damageMorale(MORALE_DECAY_COMBAT * dt);
    }

    // === Nearby routing friendlies ===
    for (const other of allUnits) {
      if (other === unit || other.team !== unit.team) continue;
      if (other.moraleState !== MORALE_STATE.ROUTING && other.moraleState !== MORALE_STATE.BROKEN) continue;
      const dx = other.x - unit.x;
      const dy = other.y - unit.y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < 120) {
        unit.damageMorale(MORALE_NEARBY_ROUT * dt);
      }
    }

    // === Casualty-based morale floor ===
    const casualtyRate = 1 - unit.aliveCount / unit.maxCount;
    if (casualtyRate > unit.stats.moraleThreshold) {
      const excess = casualtyRate - unit.stats.moraleThreshold;
      unit.damageMorale(excess * 4 * dt);
    }

    // === State transitions ===
    _applyMoraleState(unit, allUnits, dt);
  }
}

function _applyMoraleState(unit, allUnits, dt) {
  if (unit.isShattered) return;

  // Shattered: fleeing too long while broken
  if (unit.moraleState === MORALE_STATE.BROKEN) {
    unit.routTimer += dt;
    if (unit.routTimer > 20) {
      unit.isShattered = true;
      unit.moraleState  = MORALE_STATE.SHATTERED;
      unit.state        = US.SHATTERED;
      return;
    }
  }

  // Morale threshold checks
  if (unit.morale <= MORALE_BROKEN_THRESHOLD) {
    if (unit.moraleState !== MORALE_STATE.BROKEN && unit.moraleState !== MORALE_STATE.SHATTERED) {
      unit.moraleState = MORALE_STATE.BROKEN;
      unit.state = US.BROKEN;
      unit.isMoving = false;
      _startRout(unit, allUnits);
    }
  } else if (unit.morale <= MORALE_ROUTING_THRESHOLD) {
    if (unit.moraleState === MORALE_STATE.STEADY || unit.moraleState === MORALE_STATE.WAVERING) {
      unit.moraleState = MORALE_STATE.ROUTING;
      unit.state = US.ROUTING;
      unit.isMoving = true;
      _startRout(unit, allUnits);
    }
  } else if (unit.morale <= MORALE_WAVERING_THRESHOLD) {
    if (unit.moraleState === MORALE_STATE.STEADY) {
      unit.moraleState = MORALE_STATE.WAVERING;
    }
  } else {
    // Recovered
    if (unit.moraleState === MORALE_STATE.WAVERING) {
      unit.moraleState = MORALE_STATE.STEADY;
    }
  }
}

function _startRout(unit, allUnits) {
  // Find nearest enemy to flee from
  let nearestEnemy = null;
  let nearestDist  = Infinity;
  for (const other of allUnits) {
    if (other.team === unit.team || other.isShattered) continue;
    const dx = other.x - unit.x;
    const dy = other.y - unit.y;
    const d  = dx * dx + dy * dy;
    if (d < nearestDist) { nearestDist = d; nearestEnemy = other; }
  }
  if (nearestEnemy) {
    setRoutDirection(unit, nearestEnemy.x, nearestEnemy.y);
  } else {
    unit.routDirX = 0;
    unit.routDirY = unit.team === 0 ? 1 : -1;
  }
}

// General rally: restore a broken unit to routing (not shattered)
// Must be called with a general unit nearby (within MORALE_GENERAL_AURA)
export function rallyUnit(brokenUnit) {
  if (brokenUnit.moraleState !== MORALE_STATE.BROKEN) return false;
  brokenUnit.morale = MORALE_ROUTING_THRESHOLD + 5;
  brokenUnit.moraleState = MORALE_STATE.WAVERING;
  brokenUnit.state = US.IDLE;
  brokenUnit.isMoving = false;
  brokenUnit.routTimer = 0;
  return true;
}

// Simple general-style morale aura (no separate general unit; virtual aura at army center)
export function applyGeneralAura(ownUnits, dt) {
  if (!ownUnits.length) return;
  // Compute army centroid
  let cx = 0, cy = 0, n = 0;
  for (const u of ownUnits) {
    if (!u.isShattered) { cx += u.x; cy += u.y; n++; }
  }
  if (!n) return;
  cx /= n; cy /= n;

  for (const u of ownUnits) {
    if (u.isShattered) continue;
    const dx = u.x - cx;
    const dy = u.y - cy;
    if (Math.sqrt(dx * dx + dy * dy) <= MORALE_GENERAL_AURA) {
      u.restoreMorale(MORALE_GENERAL_BONUS * dt);
    }
  }
}

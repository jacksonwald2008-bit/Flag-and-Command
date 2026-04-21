import {
  MUSKET_RANGE, ARTILLERY_RANGE,
  MELEE_RANGE, BASE_KILL_CHANCE,
  MORALE_CASUALTY_PER_MAN, MORALE_FLANK_HIT, MORALE_REAR_HIT,
  SS, US,
} from '../constants.js';

// Returns angle in radians from unit's forward direction to target
function angleToTarget(unit, tx, ty) {
  const dx = tx - unit.x;
  const dy = ty - unit.y;
  const angle = Math.atan2(dx, -dy);
  let diff = angle - unit.facing;
  while (diff >  Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

// Is target within unit's firing arc? (±90°)
function inFiringArc(unit, target) {
  const diff = Math.abs(angleToTarget(unit, target.x, target.y));
  return diff < Math.PI / 2;
}

// Distance between two units
function unitDist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Determine if attacker is flanking/rear attacking the defender
function getFlanking(attacker, defender) {
  const dx = attacker.x - defender.x;
  const dy = attacker.y - defender.y;
  const attackAngle = Math.atan2(dx, -dy);
  let diff = attackAngle - defender.facing;
  while (diff >  Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const absDiff = Math.abs(diff);
  if (absDiff > Math.PI * 0.75) return 'rear';
  if (absDiff > Math.PI * 0.4)  return 'flank';
  return 'front';
}

// Execute a volley from firingUnit at targetUnit
// Returns number of soldiers killed
export function fireVolley(firingUnit, targetUnit, dt) {
  if (firingUnit.ammo <= 0) return 0;
  if (firingUnit.isShattered || targetUnit.isShattered) return 0;
  if (targetUnit.isDead) return 0;

  const stats    = firingUnit.stats;
  const dist     = unitDist(firingUnit, targetUnit);
  const maxRange = stats.isArtillery ? ARTILLERY_RANGE : MUSKET_RANGE;
  if (dist > maxRange) return 0;

  // Range effectiveness — drops off linearly, 3× damage at point blank
  const rangeMod = stats.isArtillery
    ? 1.0
    : 1.0 + (1.0 - dist / maxRange) * 2.0;

  const readySoldiers = countReadyFront(firingUnit);
  const hits   = readySoldiers * stats.accuracy * rangeMod;
  let kills    = 0;
  for (let i = 0; i < Math.floor(hits); i++) {
    if (Math.random() < BASE_KILL_CHANCE * rangeMod) kills++;
  }
  // Artillery AoE bonus kills
  if (stats.isArtillery) {
    kills = Math.max(1, Math.round(hits * BASE_KILL_CHANCE * 12));
  }

  if (kills > 0) {
    targetUnit.killSoldier(kills);
    const moraleHit = kills * MORALE_CASUALTY_PER_MAN;
    targetUnit.damageMorale(moraleHit);
    targetUnit.inCombat = true;
    targetUnit.combatTimer = 0;
  }

  // Flanking/rear morale bonus
  const flankType = getFlanking(firingUnit, targetUnit);
  if (flankType === 'flank') targetUnit.damageMorale(MORALE_FLANK_HIT * dt * 4);
  if (flankType === 'rear')  targetUnit.damageMorale(MORALE_REAR_HIT  * dt * 4);

  // Emit muzzle flash particles from firing unit
  const count = Math.min(readySoldiers, 8);
  for (let i = 0; i < count; i++) {
    const s = firingUnit.soldiers.find(s => s.state !== SS.DEAD);
    if (s) firingUnit.addParticle(s.x, s.y, 'flash');
  }
  // Smoke on target
  targetUnit.addParticle(targetUnit.x, targetUnit.y, 'smoke');

  firingUnit.ammo = Math.max(0, firingUnit.ammo - 1);
  return kills;
}

// Count soldiers in front rank currently ready to fire
function countReadyFront(unit) {
  let count = 0;
  for (const s of unit.soldiers) {
    if (s.state !== SS.DEAD && s.rankIdx === 0 && s.reloadTimer <= 0) count++;
  }
  return Math.max(1, count);
}

// Begin reload cycle for front rank soldiers
export function triggerReload(unit) {
  for (const s of unit.soldiers) {
    if (s.state !== SS.DEAD && s.rankIdx === 0) {
      s.state = SS.RELOADING;
      s.reloadTimer = unit.stats.reloadTime * (0.9 + Math.random() * 0.2);
    }
  }
}

// Tick reload timers
export function tickReload(unit, dt) {
  for (const s of unit.soldiers) {
    if (s.state === SS.RELOADING) {
      s.reloadTimer -= dt;
      if (s.reloadTimer <= 0) {
        s.reloadTimer = 0;
        s.state = SS.IDLE;
      }
    }
  }
}

// Resolve melee between two units for one tick
export function resolveMelee(unitA, unitB, dt) {
  if (unitA.isShattered || unitB.isShattered) return;
  const stats = unitA.stats;

  // Each alive soldier deals damage each second
  const dmgA = unitA.aliveCount * stats.meleeDmg * dt * 0.08;
  const dmgB = unitB.aliveCount * unitB.stats.meleeDmg * dt * 0.08;

  const dmgAReduced = dmgA * (1 - unitB.stats.armor);
  const dmgBReduced = dmgB * (1 - stats.armor);

  const killsOnB = Math.floor(dmgAReduced);
  const killsOnA = Math.floor(dmgBReduced);

  if (killsOnB > 0) {
    unitB.killSoldier(killsOnB);
    unitB.damageMorale(killsOnB * MORALE_CASUALTY_PER_MAN * 1.5);
  }
  if (killsOnA > 0) {
    unitA.killSoldier(killsOnA);
    unitA.damageMorale(killsOnA * MORALE_CASUALTY_PER_MAN * 1.5);
  }

  // Flanking in melee
  const ft = getFlanking(unitA, unitB);
  if (ft === 'flank') { unitB.damageMorale(0.5 * dt); }
  if (ft === 'rear')  { unitB.damageMorale(0.8 * dt); }

  unitA.inCombat = unitB.inCombat = true;
}

// Main combat update — called every tick for all units
export function updateCombat(allUnits, grid, dt) {
  for (const unit of allUnits) {
    if (unit.isShattered || unit.isDead) continue;
    if (unit.moraleState === 'routing' || unit.moraleState === 'broken') continue;

    tickReload(unit, dt);

    const stats  = unit.stats;
    const range  = stats.isArtillery ? ARTILLERY_RANGE : MUSKET_RANGE;

    // Find nearest enemy
    const enemy = grid.nearestEnemy(unit, range + 20);
    if (!enemy) { unit.inCombat = false; unit.combatTimer = Math.max(0, unit.combatTimer - dt); continue; }

    const dist = unitDist(unit, enemy);

    // === Melee ===
    if (dist <= MELEE_RANGE && !stats.isArtillery) {
      unit.state    = US.MELEE;
      unit.isMoving = false;
      resolveMelee(unit, enemy, dt);
      continue;
    }

    // === Ranged fire ===
    if (dist > range) { unit.inCombat = false; continue; }

    // Artillery always fires if in range
    // Infantry: must be stationary and facing enemy
    if (!stats.isArtillery) {
      if (unit.isMoving) continue;
      if (!inFiringArc(unit, enemy)) continue;
    }

    unit.inCombat   = true;
    unit.combatTimer += dt;

    // Reload timer on the unit level (gates volleys)
    unit.reloadTimer -= dt;
    if (unit.reloadTimer <= 0) {
      fireVolley(unit, enemy, dt);
      unit.reloadTimer = stats.reloadTime;
      triggerReload(unit);
      unit.state = US.FIRING;
    } else {
      if (unit.state !== US.FIRING) unit.state = US.IDLE;
    }
  }
}

import { US, WORLD_W, WORLD_H } from '../constants.js';
import { getTerrainSpeedAt } from '../maps/maps.js';

const ARRIVAL_DIST  = 4;   // meters — unit is "at" target
const ROTATION_RATE = 2.5; // radians per second

export function updateMovement(unit, dt, map) {
  if (unit.isShattered) return;

  // Routing units flee in a direction away from their last known threat
  if (unit.moraleState === 'routing' || unit.moraleState === 'broken') {
    _updateRoutingMovement(unit, dt, map);
    unit.layoutFormation();
    unit.updateSoldierPositions(dt);
    return;
  }

  if (!unit.isMoving) {
    unit.updateSoldierPositions(dt);
    return;
  }

  const dx = unit.targetX - unit.x;
  const dy = unit.targetY - unit.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < ARRIVAL_DIST) {
    // Arrived — snap and rotate to final facing
    unit.x = unit.targetX;
    unit.y = unit.targetY;
    _rotateFacing(unit, unit.targetFacing, dt);
    if (Math.abs(_angleDiff(unit.facing, unit.targetFacing)) < 0.05) {
      unit.isMoving = false;
      unit.state    = US.IDLE;
    }
    unit.layoutFormation();
    unit.updateSoldierPositions(dt);
    return;
  }

  // Rotate toward movement direction while moving
  const moveFacing = Math.atan2(dx, -dy);
  _rotateFacing(unit, moveFacing, dt * 2);

  // Apply terrain speed penalty
  const terrainMod = getTerrainSpeedAt(map, unit.x, unit.y);
  const step = unit.speed * terrainMod * dt;
  unit.x += (dx / dist) * Math.min(step, dist);
  unit.y += (dy / dist) * Math.min(step, dist);

  // Clamp to world
  unit.x = Math.max(0, Math.min(WORLD_W, unit.x));
  unit.y = Math.max(0, Math.min(WORLD_H, unit.y));

  unit.layoutFormation();
  unit.updateSoldierPositions(dt);
}

function _updateRoutingMovement(unit, dt, map) {
  // Flee away from enemy / toward map edge
  const speed = unit.speed * 2.2;
  const terrainMod = getTerrainSpeedAt(map, unit.x, unit.y);
  unit.x += unit.routDirX * speed * terrainMod * dt;
  unit.y += unit.routDirY * speed * terrainMod * dt;

  // Shatter if off map
  if (unit.x < -50 || unit.x > WORLD_W + 50 || unit.y < -50 || unit.y > WORLD_H + 50) {
    unit.isShattered = true;
    unit.moraleState  = 'shattered';
    unit.state        = US.SHATTERED;
  }

  unit.layoutFormation();
}

function _rotateFacing(unit, targetFacing, dt) {
  const diff = _angleDiff(unit.facing, targetFacing);
  const maxRot = ROTATION_RATE * dt;
  if (Math.abs(diff) <= maxRot) {
    unit.facing = targetFacing;
  } else {
    unit.facing += Math.sign(diff) * maxRot;
  }
  unit.facing = _normalizeAngle(unit.facing);
}

function _angleDiff(from, to) {
  let d = to - from;
  while (d >  Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

function _normalizeAngle(a) {
  while (a >  Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// Set rout direction for a unit based on nearest enemy position
export function setRoutDirection(unit, enemyX, enemyY) {
  const dx = unit.x - enemyX;
  const dy = unit.y - enemyY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.1) {
    unit.routDirX = 0;
    unit.routDirY = unit.team === 0 ? 1 : -1; // flee south if player, north if AI
  } else {
    unit.routDirX = dx / len + (Math.random() - 0.5) * 0.4;
    unit.routDirY = dy / len + (Math.random() - 0.5) * 0.4;
  }
}

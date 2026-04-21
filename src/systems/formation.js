
// Lay out a unit's soldiers in a line formation along direction vector
export function layoutLine(unit) {
  unit.layoutFormation();
}

// Given a drawn path (world coords [{x,y},...]), return the formation line
// as { cx, cy, facing, x1, y1, x2, y2 }
export function pathToFormationLine(path) {
  if (path.length < 2) return null;
  const start = path[0];
  const end   = path[path.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 2) return null;
  return {
    x1: start.x, y1: start.y,
    x2: end.x,   y2: end.y,
    cx: (start.x + end.x) / 2,
    cy: (start.y + end.y) / 2,
    len,
    // Facing: perpendicular to line. We'll choose based on team via caller.
    dx: dx / len,
    dy: dy / len,
  };
}

// Distribute multiple units along a formation line drawn by the player
// Returns array of {x, y, facing} move orders, one per unit
export function distributeUnitsOnLine(units, line) {
  if (!units.length || !line) return [];
  const n = units.length;
  const orders = [];

  // Space units evenly along the line
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const px = line.x1 + (line.x2 - line.x1) * t;
    const py = line.y1 + (line.y2 - line.y1) * t;

    // Facing: perpendicular to line direction, pointing away from map edge
    // line.dx, line.dy = normalized line direction
    // Two normals: rotate 90° CW or CCW
    const normCW  = { x:  line.dy, y: -line.dx }; // CW  rotation
    const normCCW = { x: -line.dy, y:  line.dx }; // CCW rotation

    // Choose normal that points generally toward map center (750,750)
    const toCenterX = 750 - px;
    const toCenterY = 750 - py;
    const dotCW  = normCW.x  * toCenterX + normCW.y  * toCenterY;
    const dotCCW = normCCW.x * toCenterX + normCCW.y * toCenterY;
    const norm = dotCW > dotCCW ? normCW : normCCW;

    // Convert normal direction vector to angle (radians, 0=north, clockwise)
    // norm points in the forward direction (facing)
    const facing = Math.atan2(norm.x, -norm.y); // angle from north, clockwise

    orders.push({ x: px, y: py, facing });
  }
  return orders;
}

// Quick move: single right-click with no drag — just move to point keeping current facing
export function moveToPoint(units, wx, wy) {
  if (!units.length) return;
  const n = units.length;

  if (n === 1) {
    // Face toward target
    const dx = wx - units[0].x;
    const dy = wy - units[0].y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const facing = dist > 2 ? Math.atan2(dx, -dy) : units[0].facing;
    units[0].moveTo(wx, wy, facing);
    return;
  }

  // Multiple units: move in a group, spacing them laterally
  // Compute group centroid
  let cx = 0, cy = 0;
  for (const u of units) { cx += u.x; cy += u.y; }
  cx /= n; cy /= n;

  // Direction to target
  const dx = wx - cx;
  const dy = wy - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const facing = dist > 2 ? Math.atan2(dx, -dy) : (units[0] ? units[0].facing : 0);
  const fwdX = Math.sin(facing);
  const fwdY = -Math.cos(facing);
  const rtX  = Math.cos(facing);
  const rtY  = Math.sin(facing);

  // Space units along the right axis
  const spacing = 80; // meters between unit centers
  const offset  = -(n - 1) / 2;
  for (let i = 0; i < n; i++) {
    const off = (offset + i) * spacing;
    const tx = wx + rtX * off;
    const ty = wy + rtY * off;
    units[i].moveTo(tx, ty, facing);
  }
}

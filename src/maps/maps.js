// 5 preset map definitions — terrain in world coords (meters, 0–1500)
// Terrain types: 'flat', 'hill', 'forest', 'river'
// Hills / forests: polygon regions [[x,y], ...]
// Rivers: path arrays with a width in meters

export const MAPS = {
  open_plains: {
    name: 'Open Plains',
    desc: 'Minimal terrain — pure tactical movement.',
    bgColor: '#7ec850',
    terrain: [
      { type: 'hill',   polygon: [[300,600],[500,600],[520,750],[280,750]], color: '#c8e87a' },
      { type: 'hill',   polygon: [[950,700],[1150,700],[1180,850],[920,860]], color: '#c8e87a' },
    ],
    rivers: [],
    forests: [],
  },
  river_valley: {
    name: 'River Valley',
    desc: 'Diagonal river — flanking via fords.',
    bgColor: '#7ec850',
    terrain: [
      { type: 'hill', polygon: [[100,200],[350,200],[380,400],[80,420]], color: '#c8e87a' },
      { type: 'hill', polygon: [[1100,1000],[1400,980],[1420,1200],[1080,1220]], color: '#c8e87a' },
    ],
    rivers: [
      {
        path: [[200,0],[350,200],[500,400],[650,600],[800,750],[900,900],[1000,1100],[1100,1300],[1200,1500]],
        width: 22,
        color: '#4a8acc',
        bankColor: '#3a7abf',
      },
    ],
    forests: [
      { polygon: [[50,600],[200,580],[220,750],[60,760]], color: '#2e7a1a', accent: '#4aaa2a' },
    ],
    fordLocations: [{ x: 640, y: 610 }, { x: 870, y: 840 }],
  },
  hill_country: {
    name: 'Hill Country',
    desc: 'Rolling hills — elevation shapes every fight.',
    bgColor: '#7ec850',
    terrain: [
      { type: 'hill', polygon: [[100,100],[400,80],[450,300],[80,320]], color: '#c8e87a' },
      { type: 'hill', polygon: [[550,400],[800,380],[840,580],[520,610]], color: '#c8e87a' },
      { type: 'hill', polygon: [[1000,200],[1300,190],[1350,400],[980,430]], color: '#c8e87a' },
      { type: 'hill', polygon: [[200,900],[500,870],[540,1100],[180,1120]], color: '#c8e87a' },
      { type: 'hill', polygon: [[900,800],[1200,780],[1250,1000],[870,1030]], color: '#c8e87a' },
      { type: 'hill', polygon: [[600,1100],[900,1080],[950,1350],[580,1370]], color: '#c8e87a' },
    ],
    rivers: [],
    forests: [],
  },
  forest_maze: {
    name: 'Forest Maze',
    desc: 'Dense forests — ambush and concealment dominate.',
    bgColor: '#7ec850',
    terrain: [],
    rivers: [],
    forests: [
      { polygon: [[50,200],[300,180],[320,450],[30,470]], color: '#2e7a1a', accent: '#4aaa2a' },
      { polygon: [[400,100],[700,90],[720,300],[380,320]], color: '#2e7a1a', accent: '#3a8a1a' },
      { polygon: [[900,150],[1150,140],[1170,380],[880,400]], color: '#2e7a1a', accent: '#4aaa2a' },
      { polygon: [[1200,100],[1480,80],[1490,350],[1180,370]], color: '#246a14', accent: '#3a8a1a' },
      { polygon: [[50,700],[350,680],[380,950],[30,970]], color: '#2e7a1a', accent: '#4aaa2a' },
      { polygon: [[500,600],[750,580],[780,800],[480,820]], color: '#246a14', accent: '#3a8a1a' },
      { polygon: [[1000,550],[1300,530],[1330,800],[980,820]], color: '#2e7a1a', accent: '#4aaa2a' },
      { polygon: [[1300,800],[1490,790],[1490,1050],[1280,1060]], color: '#246a14', accent: '#3a8a1a' },
      { polygon: [[100,1100],[400,1080],[430,1350],[80,1370]], color: '#2e7a1a', accent: '#4aaa2a' },
      { polygon: [[650,1000],[950,980],[980,1250],[630,1270]], color: '#246a14', accent: '#3a8a1a' },
      { polygon: [[1100,1200],[1400,1180],[1420,1450],[1080,1470]], color: '#2e7a1a', accent: '#4aaa2a' },
    ],
  },
  mixed_terrain: {
    name: 'Mixed Terrain',
    desc: 'Every terrain type — maximum tactical variety.',
    bgColor: '#7ec850',
    terrain: [
      { type: 'hill', polygon: [[50,100],[350,80],[380,300],[30,320]], color: '#c8e87a' },
      { type: 'hill', polygon: [[700,350],[950,330],[980,550],[680,570]], color: '#c8e87a' },
      { type: 'hill', polygon: [[1100,800],[1400,780],[1430,1000],[1080,1020]], color: '#c8e87a' },
    ],
    rivers: [
      {
        path: [[400,0],[450,200],[500,450],[450,700],[400,900],[350,1100],[300,1300],[280,1500]],
        width: 18,
        color: '#4a8acc',
        bankColor: '#3a7abf',
      },
    ],
    forests: [
      { polygon: [[900,100],[1200,80],[1220,350],[880,370]], color: '#2e7a1a', accent: '#4aaa2a' },
      { polygon: [[100,800],[380,780],[400,1050],[80,1070]], color: '#2e7a1a', accent: '#4aaa2a' },
      { polygon: [[600,900],[850,880],[880,1150],[580,1170]], color: '#246a14', accent: '#3a8a1a' },
    ],
    fordLocations: [{ x: 460, y: 350 }, { x: 420, y: 780 }],
  },
};

export const MAP_KEYS = Object.keys(MAPS);

// Check if a world point is inside a polygon (ray-cast)
export function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Returns movement speed multiplier for a position on the map
export function getTerrainSpeedAt(map, wx, wy) {
  if (!map) return 1.0;
  // Forest check
  for (const f of (map.forests || [])) {
    if (pointInPolygon(wx, wy, f.polygon)) return 0.5;
  }
  // River check
  for (const r of (map.rivers || [])) {
    if (isOnRiver(wx, wy, r)) return 0.4;
  }
  return 1.0;
}

function isOnRiver(wx, wy, river) {
  const hw = river.width / 2;
  const path = river.path;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = path[i];
    const [bx, by] = path[i + 1];
    const dist = pointToSegmentDist(wx, wy, ax, ay, bx, by);
    if (dist <= hw) return true;
  }
  return false;
}

function pointToSegmentDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Is position on or inside a forest?
export function isInForest(map, wx, wy) {
  if (!map) return false;
  for (const f of (map.forests || [])) {
    if (pointInPolygon(wx, wy, f.polygon)) return true;
  }
  return false;
}

// Is position on a hill?
export function isOnHill(map, wx, wy) {
  if (!map) return false;
  for (const t of (map.terrain || [])) {
    if (t.type === 'hill' && pointInPolygon(wx, wy, t.polygon)) return true;
  }
  return false;
}

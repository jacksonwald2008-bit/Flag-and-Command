// World dimensions
export const WORLD_W = 1500; // meters
export const WORLD_H = 1500;

// Spatial grid
export const GRID_CELL = 30; // meters per cell
export const GRID_COLS = Math.ceil(WORLD_W / GRID_CELL); // 50
export const GRID_ROWS = Math.ceil(WORLD_H / GRID_CELL); // 50

// LOD thresholds (camera.scale = pixels per meter)
export const LOD_FAR_MAX  = 0.5;  // below → dots
export const LOD_MID_MAX  = 1.8;  // below → chevrons; above → pin figures

// Formation geometry
export const SOLDIER_SPACING = 2.0;  // meters between soldiers in a rank
export const RANK_DEPTH      = 6.0;  // meters between ranks

// Combat
export const MUSKET_RANGE     = 250; // yards effective range
export const ARTILLERY_RANGE  = 750;
export const ARTILLERY_AOE    = 8;   // meters blast radius
export const MELEE_RANGE      = 3;   // meters — triggers melee
export const BASE_KILL_CHANCE = 0.018; // per hit in a volley

// Morale
export const MORALE_GENERAL_AURA     = 200; // meters radius
export const MORALE_GENERAL_BONUS    = 0.6; // per second
export const MORALE_CASUALTY_PER_MAN = 0.25; // morale lost per soldier killed
export const MORALE_FLANK_HIT        = 20;
export const MORALE_REAR_HIT         = 30;
export const MORALE_NEARBY_ROUT      = 8;   // per routing friendly nearby
export const MORALE_GENERAL_DEATH    = 50;
export const MORALE_REGEN_RATE       = 1.5; // per second when not in combat
export const MORALE_DECAY_COMBAT     = 0.4; // per second passive under fire

// Morale thresholds
export const MORALE_WAVERING_THRESHOLD = 60;
export const MORALE_ROUTING_THRESHOLD  = 35;
export const MORALE_BROKEN_THRESHOLD   = 10;

// Teams
export const TEAM_PLAYER = 0;
export const TEAM_AI     = 1;

export const TEAM_COLORS = ['#cc3322', '#2255bb'];
export const TEAM_NAMES  = ['Player', 'Enemy'];

// Routing
export const ROUT_SPEED_MULTIPLIER = 2.2;
export const ROUT_FLEE_DIRECTION   = Math.PI; // flee away from enemy

// Deployment zones (world Y range)
export const DEPLOY_ZONE_PLAYER = { y: WORLD_H - 280, h: 260, x: 30, w: 1440 };
export const DEPLOY_ZONE_AI     = { y: 10,             h: 260, x: 30, w: 1440 };

// Camera
export const CAMERA_ZOOM_MIN = 0.15;
export const CAMERA_ZOOM_MAX = 5.0;
export const CAMERA_PAN_SPEED = 600; // px/sec with keyboard

// Game speeds
export const SPEEDS = [0, 1, 2, 3]; // 0 = paused

// Soldier states
export const SS = {
  IDLE:      0,
  MOVING:    1,
  FIRING:    2,
  RELOADING: 3,
  MELEE:     4,
  DEAD:      5,
  ROUTING:   6,
};

// Unit states
export const US = {
  IDLE:      'idle',
  MOVING:    'moving',
  FIRING:    'firing',
  MELEE:     'melee',
  ROUTING:   'routing',
  BROKEN:    'broken',
  SHATTERED: 'shattered',
};

// Morale display states
export const MORALE_STATE = {
  STEADY:    'steady',
  WAVERING:  'wavering',
  ROUTING:   'routing',
  BROKEN:    'broken',
  SHATTERED: 'shattered',
};

// Unit types
export const UT = {
  MILITIA:           'militia',
  LINE_INFANTRY:     'line_infantry',
  GRENADIER:         'grenadier',
  BLACK_WATCH:       'black_watch',
  PRUSSIAN_GRENADIER:'prussian_grenadier',
  HORSE_GUNNER:      'horse_gunner',
  SABRE_CAVALRY:     'sabre_cavalry',
  ARTILLERY:         'artillery',
};

export const UNIT_STATS = {
  militia: {
    name: 'Militia', cost: 1,
    soldierCount: 120, ranks: 2,
    morale: 50, accuracy: 0.50, meleeDmg: 1.5,
    speed: 1.8, reloadTime: 4.5, moraleThreshold: 0.20,
    chargeBonus: 1.0, armor: 0.05,
    isCavalry: false, isArtillery: false, isElite: false,
  },
  line_infantry: {
    name: 'Line Infantry', cost: 2,
    soldierCount: 200, ranks: 2,
    morale: 80, accuracy: 0.70, meleeDmg: 2.5,
    speed: 2.0, reloadTime: 4.0, moraleThreshold: 0.30,
    chargeBonus: 1.0, armor: 0.10,
    isCavalry: false, isArtillery: false, isElite: false,
  },
  grenadier: {
    name: 'Grenadiers', cost: 4,
    soldierCount: 200, ranks: 3,
    morale: 100, accuracy: 0.75, meleeDmg: 3.5,
    speed: 1.8, reloadTime: 5.0, moraleThreshold: 0.35,
    chargeBonus: 1.2, armor: 0.15,
    isCavalry: false, isArtillery: false, isElite: true,
    faction: 'france',
  },
  black_watch: {
    name: 'Black Watch', cost: 4,
    soldierCount: 200, ranks: 3,
    morale: 90, accuracy: 0.72, meleeDmg: 3.2,
    speed: 1.9, reloadTime: 4.2, moraleThreshold: 0.33,
    chargeBonus: 1.3, armor: 0.12,
    isCavalry: false, isArtillery: false, isElite: true,
    faction: 'england',
  },
  prussian_grenadier: {
    name: 'Prussian Grenadiers', cost: 4,
    soldierCount: 200, ranks: 3,
    morale: 105, accuracy: 0.76, meleeDmg: 3.8,
    speed: 1.7, reloadTime: 5.2, moraleThreshold: 0.36,
    chargeBonus: 1.2, armor: 0.18,
    isCavalry: false, isArtillery: false, isElite: true,
    faction: 'prussia',
  },
  horse_gunner: {
    name: 'Horse Gunners', cost: 3,
    soldierCount: 60, ranks: 2,
    morale: 70, accuracy: 0.65, meleeDmg: 2.0,
    speed: 3.5, reloadTime: 4.5, moraleThreshold: 0.25,
    chargeBonus: 1.1, armor: 0.08,
    isCavalry: true, isArtillery: false, isElite: false,
    faction: 'russia',
  },
  sabre_cavalry: {
    name: 'Sabre Cavalry', cost: 3,
    soldierCount: 60, ranks: 2,
    morale: 75, accuracy: 0.50, meleeDmg: 3.0,
    speed: 4.5, reloadTime: null, moraleThreshold: 0.28,
    chargeBonus: 1.5, armor: 0.10,
    isCavalry: true, isArtillery: false, isElite: false,
  },
  artillery: {
    name: 'Artillery', cost: 5,
    soldierCount: 48, cannonCount: 4, ranks: 1,
    morale: 60, accuracy: 0.80, meleeDmg: 1.0,
    speed: 0.8, reloadTime: 8.0, moraleThreshold: 0.50,
    chargeBonus: 0, armor: 0.05,
    isCavalry: false, isArtillery: true, isElite: false,
  },
};

export const FACTION_DATA = {
  france:  { name: 'France',  uniformColor: '#1a3d8f', bannerColor: '#002395', uniqueUnit: 'grenadier' },
  england: { name: 'England', uniformColor: '#cc2222', bannerColor: '#cf0000', uniqueUnit: 'black_watch' },
  russia:  { name: 'Russia',  uniformColor: '#1f5c2e', bannerColor: '#003300', uniqueUnit: 'horse_gunner' },
  prussia: { name: 'Prussia', uniformColor: '#1a1a1a', bannerColor: '#000033', uniqueUnit: 'prussian_grenadier' },
};

export const FACTION_UNITS = {
  france:  ['militia', 'line_infantry', 'sabre_cavalry', 'artillery', 'grenadier'],
  england: ['militia', 'line_infantry', 'sabre_cavalry', 'artillery', 'black_watch'],
  russia:  ['militia', 'line_infantry', 'sabre_cavalry', 'artillery', 'horse_gunner'],
  prussia: ['militia', 'line_infantry', 'sabre_cavalry', 'artillery', 'prussian_grenadier'],
};

export const GAME_STATE = {
  ARMY_BUILDER: 'army_builder',
  DEPLOYMENT:   'deployment',
  BATTLE:       'battle',
  BATTLE_END:   'battle_end',
};

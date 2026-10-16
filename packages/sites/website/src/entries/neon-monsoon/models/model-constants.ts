import { ARENA_HEIGHT, type BulletKind, type EnemyKind } from '../data';
import type { ExplosionSize, ShotKind } from './common';

// ---------------------------------------------------------------------------
// Simulation clock
// ---------------------------------------------------------------------------

/** The game advances in fixed steps of 1/60 s, whatever the display's frame rate. */
export const STEP_MS = 1000 / 60;

/**
 * At most this many steps per update. After a long frame the rest of the time
 * is dropped, so the game slows down rather than jumping ahead, as arcade
 * boards did under load.
 */
export const MAX_STEPS_PER_UPDATE = 4;

// ---------------------------------------------------------------------------
// Ship
// ---------------------------------------------------------------------------

export const SHIP_SPEED = 150;
export const SHIP_FOCUSED_SPEED = 60;
/** The hitbox: a small circle at the cockpit, far smaller than the sprite. */
export const SHIP_HIT_RADIUS = 2;
/** A bullet passing within this distance, without hitting, is a graze. */
export const SHIP_GRAZE_RADIUS = 14;
/** How close the ship's centre may come to the arena's edges. */
export const SHIP_EDGE_MARGIN = 8;
export const SHIP_START_Y = ARENA_HEIGHT - 40;
export const RESPAWN_INVULNERABLE_MS = 2500;

export const MAX_POWER = 4;
export const SHOT_INTERVAL_MS = 70;
export const SHOT_SPEED = 420;
export const FOCUSED_SHOT_SPEED = 520;
/** Degrees between the streams of the unfocused spread. */
export const SHOT_SPREAD_DEG = 6;
/** World-units between the parallel shots of the focused column. */
export const FOCUSED_SHOT_SPACING = 5;

export const SHOT_DAMAGE: Readonly<Record<ShotKind, number>> = {
    'shot': 1,
    'shot-focused': 2,
};

export const SHOT_HIT_RADII: Readonly<Record<ShotKind, number>> = {
    'shot': 3,
    'shot-focused': 3,
};

// ---------------------------------------------------------------------------
// Bullets and gems
// ---------------------------------------------------------------------------

export const MAX_ENEMY_BULLETS = 2048;
export const MAX_PLAYER_SHOTS = 128;
export const MAX_GEMS = 2048;
/** Bullets this far outside the arena are removed. */
export const BULLET_MARGIN = 16;

/** Each kind's hit radius: smaller than its sprite, as the genre expects. */
export const BULLET_HIT_RADII: Readonly<Record<BulletKind, number>> = {
    'pellet-red': 2.5,
    'pellet-amber': 2.5,
    'pellet-orange': 2.5,
    'pellet-gold': 2.5,
    'orb-red': 5,
    'orb-amber': 5,
    'needle-orange': 1.5,
    'needle-gold': 1.5,
    'rain': 1.5,
};

export const GEM_COLLECT_RADIUS = 12;

// ---------------------------------------------------------------------------
// Enemies and items
// ---------------------------------------------------------------------------

export const MAX_ENEMIES = 48;
export const MAX_ITEMS = 8;
export const MAX_EXPLOSIONS = 32;

export const ENEMY_HEALTH: Readonly<Record<EnemyKind, number>> = {
    kite: 2,
    lancer: 7,
    turret: 10,
    barge: 70,
    gunship: 520,
};

export const ENEMY_RADII: Readonly<Record<EnemyKind, number>> = {
    kite: 7,
    lancer: 7,
    turret: 8,
    barge: 18,
    gunship: 22,
};

/** How far off the arena an enemy that has been on screen must be before it is gone. */
export const ENEMY_LEAVE_MARGIN = 32;

export const ITEM_COLLECT_RADIUS = 14;

export const EXPLOSION_MS: Readonly<Record<ExplosionSize, number>> = {
    small: 350,
    large: 650,
    huge: 1200,
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export const ENEMY_POINTS: Readonly<Record<EnemyKind, number>> = {
    kite: 10,
    lancer: 30,
    turret: 50,
    barge: 300,
    gunship: 3000,
};

/** A kill within this long of the last one extends the chain. */
export const CHAIN_WINDOW_MS = 1500;
/** A kill scores its points times the chain, up to this. */
export const MAX_CHAIN_MULTIPLIER = 32;
export const GRAZE_POINTS = 10;
/** Per gem, times the loop. */
export const GEM_POINTS = 10;
/** For an item collected when it can do nothing more, at full power or bombs. */
export const SPARE_ITEM_POINTS = 1000;
/** For each boss attack broken without dying or bombing, times the loop. */
export const ATTACK_BONUS = 10_000;
export const BOSS_POINTS = 50_000;
/** For each bomb left when the stage is cleared, times the loop. */
export const TALLY_BOMB_BONUS = 10_000;
/** Each of these scores is worth an extra life. */
export const EXTEND_SCORES: readonly number[] = [300_000, 800_000];

// ---------------------------------------------------------------------------
// Lives and bombs
// ---------------------------------------------------------------------------

export const INITIAL_LIVES = 3;
export const BOMBS_PER_LIFE = 3;
export const MAX_BOMBS = 5;
export const BOMB_MS = 2500;
export const BOMB_DAMAGE_PER_SEC = 60;
export const DYING_MS = 1200;

// ---------------------------------------------------------------------------
// Stage and loops
// ---------------------------------------------------------------------------

/** World-units of city per second. */
export const SCROLL_SPEED = 30;
export const WARNING_MS = 4500;
export const TALLY_MS = 4500;

/** Bullet speed for each loop: the second loop's bullets are 20% faster. */
export const LOOP_SPEED_SCALES: readonly number[] = [1, 1.2];
/** Emitters fire this much more often on each loop. */
export const LOOP_DENSITY_SCALES: readonly number[] = [1, 1.25];

// ---------------------------------------------------------------------------
// Boss
// ---------------------------------------------------------------------------

export const BOSS_START_Y = -60;
export const BOSS_HOLD_Y = 70;
export const BOSS_RADIUS = 30;
export const BOSS_ENTER_MS = 3000;
export const BOSS_BREAK_MS = 1500;
export const BOSS_EXPLODE_MS = 2500;
/** While the boss explodes, a new explosion goes off on it this often. */
export const BOSS_EXPLOSION_INTERVAL_MS = 160;

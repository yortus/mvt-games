// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Distances are in metres and speeds in metres per second, the scene's units.

/** How many laps a race is. */
export const LAPS = 3;

/** How long the lights count down before the start, in milliseconds. */
export const COUNTDOWN_MS = 3000;

/** How much bigger the track is built than its points are written, so its bends suit a fast car. */
export const TRACK_SCALE = 2;

/** The asphalt's width. */
export const TRACK_WIDTH = 16;

/** How far the grass reaches past the asphalt's edge, to the wall. Trees stand on it. */
export const RUNOFF_WIDTH = 16;

/** The spacing of the points the track is measured at, along its centre line. */
export const TRACK_SAMPLE_SPACING = 2;

/** The physics' fixed step, so the car handles the same at any frame rate. */
export const PHYSICS_STEP_MS = 5;

/** The car's top speed on asphalt, about 250 km/h. It always drives toward it, unless you brake. */
export const MAX_SPEED = 70;

/** The car's top speed on the grass. The grass slows it only a little, but the trees stand there. */
export const GRASS_MAX_SPEED = 56;

/** The fastest it reverses. */
export const MAX_REVERSE_SPEED = 12;

/** How quickly it gains speed from a standstill, in metres per second per second. It gains less and less as it nears top speed, so it eases into it. */
export const ACCELERATION = 34;

/** How quickly the brakes slow it, in metres per second per second. */
export const BRAKING = 55;

/** How quickly it slows when it rolls without power, as at the finish, as a fraction of its speed per second. */
export const ROLLING_DRAG = 0.15;

/** How quickly the grass slows it, as a fraction of its speed per second. */
export const GRASS_DRAG = 0.35;

/** How fast it turns at full lock, in radians per second, once it is moving briskly. */
export const TURN_RATE = 1.7;

/** The speed at which it reaches its full turn rate. Slower than this, it turns less, and standing still it can't turn. */
export const FULL_TURN_SPEED = 10;

/** How much of its turn rate it keeps at top speed. Fast cars turn wider. */
export const TOP_SPEED_TURN_FRACTION = 0.5;

/** How quickly its sideways slide dies away, as a fraction per second. Lower is driftier. */
export const GRIP = 4.5;

/** How quickly the steering wheel turns to full lock and back, as a fraction of full lock per second. */
export const STEERING_SPEED = 3.2;

/** How much of its speed into a wall it keeps, bouncing back off it. */
export const WALL_BOUNCE = 0.3;

/** How fast the car can hit a wall, straight on, and bounce off it rather than blow up. */
export const WALL_CRASH_SPEED = 22;

/** How fast the car can touch a tree or another car and stop, rather than blow up. */
export const BUMP_SPEED = 6;

/** How long a wreck burns before the car comes back on the track, in milliseconds. */
export const WRECK_MS = 1600;

/** How long the car drives through things after it comes back, so it can't be wrecked again at once, in milliseconds. */
export const SHIELD_MS = 2200;

/** How fast the car is going as it comes back on the track. */
export const RESPAWN_SPEED = 25;

/** The car's size, for collisions: its half length and half width. */
export const CAR_HALF_LENGTH = 2.2;
export const CAR_HALF_WIDTH = 0.95;

/** The trunk's radius, for collisions. The crown overhangs it, so the car can brush the leaves. */
export const TREE_RADIUS = 0.7;

/** How far apart the trees in the run-off are, on average, along the track. */
export const TREE_SPACING = 18;

/** The track sample the start gantry spans, about 30 metres past the start line. */
export const GANTRY_SAMPLE = 15;
/** How far past the asphalt's edge each of the gantry's posts stands, in metres. A car that hits one stops, as at a tree. */
export const GANTRY_POST_CLEARANCE = 2.5;
/** How thick each square post is, in metres. */
export const GANTRY_POST_SIZE = 0.5;

/** How many rival cars drive the track. */
export const RIVAL_COUNT = 48;

/** The rivals' cruising speeds, a range each takes one from. All are well below your top speed. */
export const RIVAL_MIN_SPEED = 32;
export const RIVAL_MAX_SPEED = 52;

/** The lanes the rivals keep to, as distances from the centre line, positive to the left. */
export const RIVAL_LANES: readonly number[] = [-4.5, 0, 4.5];

/** How close a rival comes up behind another in its lane before it slows to that car's speed. */
export const RIVAL_FOLLOW_GAP = 32;

/** How far ahead a rival looks for a wreck in its lane, to move to another lane round it. */
export const RIVAL_LOOK_AHEAD = 70;

/** How quickly a rival moves across to another lane, in metres per second. */
export const RIVAL_LANE_CHANGE_SPEED = 9;

/** How long a wrecked rival is gone before it rejoins the track, behind you, in milliseconds. */
export const RIVAL_RESPAWN_MS = 4000;

/** How far behind you a wrecked rival rejoins the track, out of sight. */
export const RIVAL_RESPAWN_BEHIND = 220;

/** How long a rival drives through things after it rejoins the track, in milliseconds. */
export const RIVAL_SHIELD_MS = 1500;

/** How far ahead of a rival you can be for it to fire at you, nearest and furthest. */
export const RIVAL_FIRE_MIN_RANGE = 20;
export const RIVAL_FIRE_MAX_RANGE = 110;

/** How far to one side of a rival's nose you can be, at most, for it to fire at you. */
export const RIVAL_FIRE_AIM = 3;

/** How long a rival waits between shots, a range each wait takes one from, in milliseconds. */
export const RIVAL_FIRE_MIN_WAIT_MS = 2500;
export const RIVAL_FIRE_MAX_WAIT_MS = 6000;

/** How long you wait between missiles while you hold Fire, in milliseconds. */
export const FIRE_INTERVAL_MS = 450;

/** How much faster a missile flies than the car that fires it. */
export const MISSILE_SPEED = 90;

/** How long a missile flies before it burns out, if it doesn't hit anything, in milliseconds. */
export const MISSILE_MS = 2000;

/** A missile's radius, for collisions. */
export const MISSILE_RADIUS = 0.4;

/** How long an explosion lasts, smoke and all, in milliseconds. */
export const EXPLOSION_MS = 2200;

/** How long a wreck burns on the track, in the way, before it's gone, in milliseconds. */
export const WRECKAGE_MS = 10000;

/** The seed that places the trees and the rivals, the same every race. */
export const LAYOUT_SEED = 20261120;

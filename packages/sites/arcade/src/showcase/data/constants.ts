// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Every length is in metres, every angle in radians, and every heading is
// measured from +x toward +z, as seen from above.

/** The hall's floor, a rectangle centred on the origin. Its length runs along x. */
export const HALL_LENGTH = 11;
export const HALL_WIDTH = 7;
export const HALL_HEIGHT = 3.2;

/** How many cabinets stand along each long wall, facing the aisle. */
export const CABINETS_PER_WALL = 6;
/** The gap from one cabinet's middle to the next. */
export const CABINET_SPACING = 1.35;
/** A cabinet's footprint. Its front is the side with the screen. */
export const CABINET_WIDTH = 0.8;
export const CABINET_DEPTH = 0.75;
export const CABINET_HEIGHT = 1.95;

/** The player, as a circle on the floor. */
export const PLAYER_RADIUS = 0.3;
export const WALK_SPEED = 2.4;
/** Where the player stands to play, this far in front of the cabinet. */
export const PLAY_DISTANCE = 0.45;
/** How close to that spot the player must be for the cabinet to be in reach. */
export const REACH = 1.2;
/** How directly the player must face a cabinet to play it, as the cosine of the widest angle. */
export const FACING_COSINE = Math.cos((55 * Math.PI) / 180);

/** The screen's middle, above the floor and back from the cabinet's front. */
export const SCREEN_HEIGHT_ABOVE_FLOOR = 1.4;
export const SCREEN_SETBACK = 0.2;
/** How far the screen leans back from upright. */
export const SCREEN_TILT = 0.22;
/** The biggest screen that fits a cabinet. Each game's screen is the shape of its play area, inside this. */
export const SCREEN_MAX_WIDTH = 0.64;
export const SCREEN_MAX_HEIGHT = 0.56;

/**
 * The door in the entrance wall, which leads back out of a hall inside the
 * hall's own cabinet. Walking into it puts the player back in the hall
 * outside, stepping back from that cabinet.
 */
export const DOOR_WIDTH = 1.2;
export const DOOR_HEIGHT = 2.2;
/** How near the door the player must be for the way out to be pointed out. */
export const DOOR_HINT_DISTANCE = 2;

/**
 * How many halls deep the last hall is. It's empty, but for a small box at
 * the far end with a button on it, which leads outside, to the meadow.
 */
export const FINAL_DEPTH = 5;
/** The box with the button, standing in the middle of the far end, facing the entrance. */
export const BUTTON_BOX_X = HALL_LENGTH / 2 - 1.2;
export const BUTTON_BOX_WIDTH = 0.6;
export const BUTTON_BOX_DEPTH = 0.5;
export const BUTTON_BOX_HEIGHT = 1.0;
/** How long the view takes to fade to white as the button is pressed, and back from white in the meadow. */
export const WHITE_OUT_MS = 1400;
export const WHITE_IN_MS = 2600;
/** How long the player must keep heading inside, in the meadow, before they go. */
export const HEAD_INSIDE_MS = 1200;
/** How wide a tree's trunk is, as drawn and as the player bumps into it. */
export const TRUNK_WIDTH = 0.32;

export const EYE_HEIGHT = 1.62;
/** How long the player takes to step up to a cabinet, or back from it. */
export const STEP_MS = 450;

/**
 * While the player walks, the cabinets nearest them run their games in
 * attract mode, up to this many at once. One starts within the first
 * distance of the player, and stops beyond the second.
 */
export const MAX_ATTRACT_GAMES = 3;
export const ATTRACT_START_DISTANCE = 3.6;
export const ATTRACT_STOP_DISTANCE = 4.6;
/** How long an attract game stays on its game over screen before it starts again. */
export const ATTRACT_GAME_OVER_MS = 4000;

/** The camera's field of view, top to bottom, in degrees. */
export const FIELD_OF_VIEW = 62;

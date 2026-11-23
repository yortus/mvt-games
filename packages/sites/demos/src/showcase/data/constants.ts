// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Every length is in metres, every angle in radians, and every heading is
// measured from +x toward +z, as seen from above.

/** The gallery's floor, a rectangle centred on the origin. Its length runs along x. */
export const ROOM_LENGTH = 21;
export const ROOM_WIDTH = 14.4;
export const ROOM_HEIGHT = 3.6;

/** How thick the walls between the corridors are. */
export const PARTITION_THICKNESS = 0.3;

/** The visitor, as a circle on the floor. */
export const VISITOR_RADIUS = 0.3;
/** A gentle stroll, slower than the arcade's. */
export const WALK_SPEED = 2.2;
export const EYE_HEIGHT = 1.62;
/** How directly the visitor must face a painting to look closer at it, as the cosine of the widest angle. */
export const FACING_COSINE = Math.cos((50 * Math.PI) / 180);

/** Where the visitor stands to look at a painting, this far in front of it. */
export const VIEW_DISTANCE = 1.7;
/** How close to that spot the visitor must be for the painting to be in reach. */
export const REACH = 1.4;
/** How long the visitor takes to step up to a painting, or back from it. */
export const STEP_MS = 600;

/** How high a painting's middle hangs, and the biggest a painting can be. Each painting is the shape of its demo. */
export const PAINTING_HEIGHT_ABOVE_FLOOR = 1.62;
export const PAINTING_MAX_WIDTH = 1.7;
export const PAINTING_MAX_HEIGHT = 1.3;
/** How far a painting's picture stands out from the wall it hangs on. */
export const PAINTING_STANDOFF = 0.06;

/** A bench's footprint, and how high its seat is. Its length runs along the corridor. */
export const BENCH_LENGTH = 2;
export const BENCH_WIDTH = 0.55;
export const BENCH_HEIGHT = 0.46;
/** A plant pot's footprint, square for walking round. */
export const POT_SIZE = 0.7;

/**
 * The door in the west wall, a dark doorway with no sign. It leads to the
 * lantern room, a room hidden from the rest of the gallery. The lantern room
 * has a door like it, which leads back.
 */
export const DOOR_WIDTH = 1.4;
export const DOOR_HEIGHT = 2.3;

/**
 * The lantern room, a dark square room hung with glowing lanterns, which
 * rise and brighten round the visitor as they walk among them. It's far to
 * the west of the gallery, out of sight of it, with its door in its east
 * wall. Its floor is centred on (`LANTERN_ROOM_X`, 0).
 */
export const LANTERN_ROOM_X = -40;
export const LANTERN_ROOM_SIZE = 11;
/** How many lanterns hang along each side of the room, in a square grid. */
export const LANTERNS_ACROSS = 11;
/** How high a lantern hangs at rest, and how high it rises out of the visitor's way, in metres. Each hangs a little higher or lower than the next. */
export const LANTERN_REST_HEIGHT = 1.55;
export const LANTERN_RISE = 0.85;

/** The camera's field of view, top to bottom, in degrees. */
export const FIELD_OF_VIEW = 60;

/**
 * While the visitor walks, the paintings nearest them play their demos, up
 * to this many at once. One starts within the first distance of the visitor,
 * and stops beyond the second.
 */
export const MAX_LIVE_PAINTINGS = 2;
export const LIVE_START_DISTANCE = 4.5;
export const LIVE_STOP_DISTANCE = 5.5;
/** How long a demo that ends stays still on its painting before it starts again. Most demos never end. */
export const LIVE_OVER_MS = 4000;

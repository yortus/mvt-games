// How long each part of the way into an entry takes, in milliseconds. The
// model times the way in from these, so it decides when the entry starts and
// when it runs. The transition fits its drawing to the same numbers, so what
// you see always matches what the model is doing.

// ---------------------------------------------------------------------------
// Launching: the wall burns away and the picture floats to the play area
// ---------------------------------------------------------------------------

/** Each card's burn, and the spread of their starts: the nearest to the polaroid first. */
export const BURN_MS = 700;
export const BURN_STAGGER_MS = 250;
/** The polaroid floating to the centre, once the burn has caught. */
export const FLOAT_DELAY_MS = 100;
export const FLOAT_MS = 700;
/** The page blacks out once most of the cards have burnt. */
export const BACKDROP_DELAY_MS = 650;
export const BACKDROP_MS = 300;
/**
 * The shortest time the model spends launching an entry from the wall, so
 * that an entry that loads at once can't cut the burn and the float short.
 * A slower load holds the polaroid at the play area for as long as it takes.
 */
export const LAUNCH_MS = Math.max(BURN_STAGGER_MS + BURN_MS, FLOAT_DELAY_MS + FLOAT_MS, BACKDROP_DELAY_MS + BACKDROP_MS);

// ---------------------------------------------------------------------------
// Revealing: the entry has started, and shows before it runs
// ---------------------------------------------------------------------------

/** The polaroid receding into the dark. The entry has started, but is not seen yet. */
export const RECEDE_MS = 300;
/** The entry's screen powering on, like an old tube. */
export const POWER_ON_MS = 500;
/** The entry's first frame showing still, so the visitor can take it in before it runs. */
export const SHOW_STILL_MS = 500;
/** The whole reveal. The entry stands still through it, then runs. */
export const REVEAL_MS = RECEDE_MS + POWER_ON_MS + SHOW_STILL_MS;

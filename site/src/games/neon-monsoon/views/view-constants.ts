import { ARENA_HEIGHT, ARENA_WIDTH } from '../data';

// One world-unit is one pixel; the cabinet scales the whole screen up by a
// whole number for crisp pixel art. The HUD is drawn over the arena, as on a
// portrait cabinet, so the screen is the arena.

export const SCREEN_WIDTH = ARENA_WIDTH;
export const SCREEN_HEIGHT = ARENA_HEIGHT;

export const HUD_FONT = 'monospace';

/**
 * The game's neon: every glowing thing that is not a bullet. All cool
 * colours, cyan to magenta, since the bullets are all warm, red to gold, and
 * must never blend into the scenery.
 */
export const NEON = {
    cyan: 0x2ff3ff,
    magenta: 0xff2bd6,
    violet: 0xa66bff,
    blue: 0x3d7bff,
} as const;

/** The neon colours, in a fixed order, for picking one by number. */
export const NEON_COLOURS: readonly number[] = [NEON.cyan, NEON.magenta, NEON.violet, NEON.blue];

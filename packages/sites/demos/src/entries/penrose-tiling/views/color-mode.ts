/**
 * What decides each tile's colour. `shapes` gives each shape of tile its own
 * colour, `directions` each way a tile can point. `rings` colours by the
 * distance from the middle of the tiling, and `spiral` by the distance and
 * the angle together.
 */
export type ColorMode = 'shapes' | 'directions' | 'rings' | 'spiral';

/** Every colour mode, in the order the panel shows them. */
export const COLOR_MODES: readonly ColorMode[] = ['shapes', 'directions', 'rings', 'spiral'];

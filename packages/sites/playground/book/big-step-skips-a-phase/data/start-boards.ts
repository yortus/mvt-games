import type { CellKind } from '../models';

/** A board where swapping the top left two cactii makes no match, so they swap back. */
export const NO_MATCH_AFTER_SWAP: readonly (readonly CellKind[])[] = [
    ['green', 'pink', 'blue', 'gold'],
    ['blue', 'gold', 'green', 'pink'],
    ['pink', 'green', 'gold', 'blue'],
];

/** A board where swapping the top left two cactii lines up three gold ones, which clear. */
export const MATCH_AFTER_SWAP: readonly (readonly CellKind[])[] = [
    ['gold', 'green', 'gold', 'gold'],
    ['blue', 'pink', 'green', 'pink'],
    ['pink', 'blue', 'blue', 'green'],
];

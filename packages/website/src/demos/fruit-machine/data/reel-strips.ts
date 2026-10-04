import type { SymbolKind } from './symbol-kind';
// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
/**
 * The five reel strips, first reel first, each read top to bottom as the
 * window shows it. Tuned with the paytable (see `computeReturn` and its test).
 *
 * - No symbol repeats within three places of itself, wrapping round, so a
 *   window never shows a picture twice on one reel. That keeps the ways a
 *   spin can win, and so its swings, small: with a balance of only ten bets,
 *   a steady machine is what keeps game over rare.
 * - One wild on each reel but the first. None on the first, so every way's
 *   picture is the one it starts with.
 * - Lower pictures are commoner: from two `pic1` per strip to seven `pic6`.
 */
export const REEL_STRIPS: readonly (readonly SymbolKind[])[] = [
    [
        'pic1', 'pic4', 'pic2', 'pic6', 'pic3', 'pic4', 'pic6',
        'pic5', 'pic3', 'pic2', 'pic1', 'pic3', 'pic5', 'pic6',
        'pic4', 'pic5', 'pic6', 'pic2', 'pic3', 'pic6', 'pic5',
        'pic4', 'pic6', 'pic5', 'pic4', 'pic6', 'pic5',
    ],
    [
        'pic1', 'pic4', 'pic6', 'pic3', 'pic4', 'pic5', 'pic1',
        'pic6', 'pic4', 'pic5', 'pic3', 'pic6', 'wild', 'pic5',
        'pic4', 'pic6', 'pic3', 'pic2', 'pic5', 'pic4', 'pic6',
        'pic2', 'pic5', 'pic6', 'pic2', 'pic5', 'pic6', 'pic3',
    ],
    [
        'pic6', 'pic1', 'pic4', 'pic6', 'pic2', 'pic3', 'pic4',
        'pic6', 'pic5', 'pic4', 'pic6', 'pic5', 'pic3', 'pic6',
        'pic5', 'pic4', 'pic6', 'pic5', 'wild', 'pic3', 'pic2',
        'pic1', 'pic5', 'pic6', 'pic2', 'pic5', 'pic3', 'pic4',
    ],
    [
        'pic2', 'pic3', 'pic6', 'pic5', 'pic3', 'pic1', 'pic4',
        'pic6', 'pic3', 'pic2', 'pic6', 'pic5', 'pic4', 'pic3',
        'pic5', 'pic6', 'pic2', 'pic4', 'pic5', 'pic6', 'pic4',
        'pic5', 'wild', 'pic4', 'pic6', 'pic5', 'pic1', 'pic6',
    ],
    [
        'pic6', 'wild', 'pic5', 'pic6', 'pic3', 'pic1', 'pic5',
        'pic6', 'pic3', 'pic4', 'pic6', 'pic2', 'pic5', 'pic4',
        'pic2', 'pic6', 'pic4', 'pic5', 'pic3', 'pic6', 'pic2',
        'pic1', 'pic4', 'pic5', 'pic6', 'pic4', 'pic3', 'pic5',
    ],
];

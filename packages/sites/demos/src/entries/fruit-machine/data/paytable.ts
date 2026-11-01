import type { PictureKind } from './symbol-kind';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** How many adjacent reels, from the first, a win spans. */
export type WinLength = 3 | 4 | 5;

/** Credits paid per winning way, by picture and by the win's length. */
export type Paytable = { readonly [P in PictureKind]: { readonly [L in WinLength]: number } };

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

/**
 * The machine's pays, in credits per way, at the fixed bet. Tuned with the
 * reel strips to a return of about 85% (see `computeReturn` and its test),
 * as a real machine's is: it pays back less than it takes.
 */
export const PAYTABLE: Paytable = {
    pic1: { 3: 18, 4: 28, 5: 53 },
    pic2: { 3: 14, 4: 21, 5: 39 },
    pic3: { 3: 11, 4: 15, 5: 28 },
    pic4: { 3: 8, 4: 12, 5: 22 },
    pic5: { 3: 6, 4: 9, 5: 18 },
    pic6: { 3: 6, 4: 8, 5: 16 },
};

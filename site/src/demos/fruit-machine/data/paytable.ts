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
 * reel strips to a return of about 120% (see `computeReturn` and its test).
 */
export const PAYTABLE: Paytable = {
    pic1: { 3: 25, 4: 40, 5: 75 },
    pic2: { 3: 20, 4: 30, 5: 55 },
    pic3: { 3: 15, 4: 22, 5: 40 },
    pic4: { 3: 11, 4: 17, 5: 32 },
    pic5: { 3: 9, 4: 13, 5: 25 },
    pic6: { 3: 8, 4: 12, 5: 22 },
};

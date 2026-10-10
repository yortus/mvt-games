// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A region of the complex plane: where it is centred, and how wide it is.
 * Its height is not given here. A grid of square samples drawn over the
 * region decides it, as the grid's shape.
 */
export interface PlaneRegion {
    readonly centerRe: number;
    readonly centerIm: number;
    /** How wide the region is, in units of the complex plane. */
    readonly span: number;
}

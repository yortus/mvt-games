// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface FitShowcaseWidthOptions {
    /** The area the page passes the showcase, in CSS pixels. */
    readonly areaWidth: number;
    readonly areaHeight: number;
    /** The showcase's own height, in its pixels, which it keeps whatever the area. */
    readonly height: number;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Returns the width, in its own pixels, that a showcase lays itself out to
 * (`fitTo`) for an area of this size. It's as wide as the area's shape needs
 * at the showcase's own height, so the showcase fills the area as the card
 * wall does. Its height never changes, so whatever is measured against it,
 * such as how far a drag turns the view, stays the same. A very wide or very
 * narrow area is kept within reason, and the page fits the showcase inside
 * it.
 */
export function fitShowcaseWidth({ areaWidth, areaHeight, height }: FitShowcaseWidthOptions): number {
    if (!(areaWidth > 0 && areaHeight > 0)) return height;
    const aspect = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, areaWidth / areaHeight));
    return Math.round(height * aspect);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The narrowest and widest a showcase gets, as its width over its height: a phone held upright, and a very wide window. */
const MIN_ASPECT = 0.45;
const MAX_ASPECT = 2.6;

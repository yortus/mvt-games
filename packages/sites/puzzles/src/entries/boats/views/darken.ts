// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns `color` darker, for an outline round it. */
export function darken(color: number): number {
    const r = Math.floor(((color >> 16) & 0xff) * DARKEN);
    const g = Math.floor(((color >> 8) & 0xff) * DARKEN);
    const b = Math.floor((color & 0xff) * DARKEN);
    return (r << 16) | (g << 8) | b;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How much darker an outline is than what it goes round. */
const DARKEN = 0.68;

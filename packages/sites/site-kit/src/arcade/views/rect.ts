// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A rectangle, in CSS pixels: in the viewport, or in whatever box the user of it says. */
export interface Rect {
    /** Its top left corner. */
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/** No rectangle: zero-sized, at the origin. */
export const NO_RECT: Rect = { x: 0, y: 0, width: 0, height: 0 };

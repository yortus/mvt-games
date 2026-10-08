// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * The largest picture, in pixels, a test may make without `large: true`:
 * about a 960 by 540 screen. Pictures cost storage in every version of
 * every reference, and drawing time; a whole screen is better cropped,
 * posed in parts, or drawn at a lower resolution.
 */
export const MAX_PICTURE_PIXELS = 500_000;

/** Why a picture of this size is over the budget, or undefined if it is not (or is allowed to be). */
export function overBudget(width: number, height: number, isLarge: boolean | undefined): string | undefined {
    if (isLarge === true || width * height <= MAX_PICTURE_PIXELS) return undefined;
    return `is ${width}x${height}, ${(width * height).toLocaleString('en-US')} pixels, over the budget of ${MAX_PICTURE_PIXELS.toLocaleString('en-US')}: `
        + 'crop it (width, height), pose part of the view, draw it at a lower resolution (smooth views only), '
        + 'or pass large: true if every pixel matters at full size';
}

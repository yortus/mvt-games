// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Returns how an image of this size fits the size budget.
 *
 * - An image within the budget is drawn at full resolution.
 * - An image over the budget that can be scaled (a smooth view) is drawn
 *   at the largest of a half, a quarter and so on that fits. Halving keeps
 *   each image pixel an exact square of view pixels, so the detail that
 *   is averaged away is regular.
 * - An image over the budget that cannot be scaled gets a problem instead.
 *   The problem says why, and the test fails with it.
 */
export function fitImage(options: {
    readonly width: number;
    readonly height: number;
    readonly maxPixels: number;
    readonly canScale: boolean;
}): { readonly resolution: number } | { readonly problem: string } {
    const { width, height, maxPixels, canScale } = options;
    if (width * height <= maxPixels) return { resolution: 1 };
    if (!canScale) {
        return {
            problem: `The image is ${width}x${height}, which is ${count(width * height)} pixels. That is over the budget of ${count(maxPixels)} `
                + '(maxPixels in vitest.visual.config.ts). Pixel art and HTML are drawn at full size, so crop the image (width, height) '
                + 'or pose part of the view. A smooth view (artStyle: \'smooth\') is drawn at a lower resolution to fit instead.',
        };
    }
    let resolution = 1;
    while (Math.round(width * resolution) * Math.round(height * resolution) > maxPixels) resolution /= 2;
    return { resolution };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function count(n: number): string {
    return n.toLocaleString('en-US');
}

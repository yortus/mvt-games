// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * How a picture of this size fits the budget: at full resolution, or, if it
 * can be scaled (a smooth view), at the largest of a half, a quarter, ...
 * that fits. Halves keep each picture pixel an exact square of view pixels,
 * so what is averaged away is regular. A picture that cannot be scaled and
 * does not fit gets the reason, to fail with.
 */
export function fitPicture(options: {
    readonly width: number;
    readonly height: number;
    readonly maxPixels: number;
    readonly canScale: boolean;
}): { readonly resolution: number } | { readonly problem: string } {
    const { width, height, maxPixels, canScale } = options;
    if (width * height <= maxPixels) return { resolution: 1 };
    if (!canScale) {
        return {
            problem: `The picture is ${width}x${height}, ${count(width * height)} pixels, over the budget of ${count(maxPixels)} `
                + '(maxPixels in vitest.visual.config.ts). Pixel art and HTML are drawn at full size: crop the picture (width, height) '
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

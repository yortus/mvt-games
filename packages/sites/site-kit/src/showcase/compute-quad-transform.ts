// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface QuadTransformOptions {
    /** The box's size, in pixels. */
    readonly width: number;
    readonly height: number;
    /**
     * The shape's corners as x, y pairs: where the box's top left goes, then
     * its top right, its bottom right and its bottom left.
     */
    readonly corners: ArrayLike<number>;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Returns the CSS transform that lays a box onto a four-sided shape, as
 * `matrix3d(...)`, for a box with its transform origin at its top left. It
 * returns undefined for a flat shape, since a transform can't reach one.
 *
 * A flat rectangle seen in perspective, such as a painting on a wall, is
 * such a shape. So a box of HTML can be laid exactly over one, by projecting
 * the rectangle's corners onto the screen and passing them here. The
 * mapping is a projective one. Straight lines stay straight, and the
 * picture shrinks toward the far edge, as it does in the scene.
 */
export function computeQuadTransform(options: QuadTransformOptions): string | undefined {
    const { width, height, corners } = options;
    const x0 = corners[0];
    const y0 = corners[1];
    const x1 = corners[2];
    const y1 = corners[3];
    const x2 = corners[4];
    const y2 = corners[5];
    const x3 = corners[6];
    const y3 = corners[7];
    // The square from 0 to 1 onto the shape (Heckbert, "Fundamentals of Texture Mapping", 1989)
    const sumX = x0 - x1 + x2 - x3;
    const sumY = y0 - y1 + y2 - y3;
    const dx1 = x1 - x2;
    const dx2 = x3 - x2;
    const dy1 = y1 - y2;
    const dy2 = y3 - y2;
    const denominator = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(denominator) < 1e-9) return undefined;
    const g = (sumX * dy2 - dx2 * sumY) / denominator;
    const h = (dx1 * sumY - sumX * dy1) / denominator;
    const a = x1 - x0 + g * x1;
    const b = x3 - x0 + h * x3;
    const d = y1 - y0 + g * y1;
    const e = y3 - y0 + h * y3;
    // Then the box onto the square, so a pixel of the box is a step of 1 / width or 1 / height. CSS lists a
    // matrix column by column, and the box's z stays 0
    return `matrix3d(${a / width}, ${d / width}, 0, ${g / width}, ${b / height}, ${e / height}, 0, ${h / height}, 0, 0, 1, 0, ${x0}, ${y0}, 0, 1)`;
}

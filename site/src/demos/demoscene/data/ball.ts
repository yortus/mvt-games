// ---------------------------------------------------------------------------
// Ball
// ---------------------------------------------------------------------------

/** A multicolour sprite is 12 pixels across, each two screen pixels wide, and 21 lines down. */
export const BALL_WIDTH = 12;
export const BALL_HEIGHT = 21;

/**
 * The ball sprite, as multicolour values: 0 transparent, 1 the shared rim
 * colour, 2 the sprite's own colour, 3 the shared highlight colour. Computed
 * rather than drawn: an ellipse 12 wide and 21 tall is a circle on screen,
 * since each pixel is two wide, with a dark rim and a highlight up and to
 * the left.
 */
export const BALL: Uint8Array = buildBall();

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function buildBall(): Uint8Array {
    const pixels = new Uint8Array(BALL_WIDTH * BALL_HEIGHT);
    const radiusX = BALL_WIDTH / 2;
    const radiusY = BALL_HEIGHT / 2;
    for (let y = 0; y < BALL_HEIGHT; y++) {
        for (let x = 0; x < BALL_WIDTH; x++) {
            const dx = (x + 0.5 - radiusX) / radiusX;
            const dy = (y + 0.5 - radiusY) / radiusY;
            const distance = dx * dx + dy * dy;
            if (distance > 1) continue;
            const hx = dx + 0.35;
            const hy = dy + 0.4;
            pixels[y * BALL_WIDTH + x] = hx * hx + hy * hy < 0.09 ? 3 : distance > 0.7 ? 1 : 2;
        }
    }
    return pixels;
}

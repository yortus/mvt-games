import { parseTextArt, type TextArt } from './text-art';

// ---------------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------------

/**
 * The MVT logo in multicolour pixels, which are two screen pixels wide:
 * `LOGO_WIDTH` such pixels across, `LOGO_HEIGHT` lines down. Each pixel is a
 * multicolour value: 0 shows the background, 1 the shadow colour, 2 the
 * highlight colour and 3 the body colour, the bit pairs of the chip's
 * multicolour bitmap mode.
 *
 * Built from a coarse mask of the three letters (below): scaled up, slanted,
 * bevelled (highlights on the top and left edges, shadows on the bottom and
 * right) and given a drop shadow and a chrome stripe.
 */
export const LOGO: TextArt = buildLogo();

export const LOGO_WIDTH = LOGO.width;
export const LOGO_HEIGHT = LOGO.height;

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function buildLogo(): TextArt {
    /** Each mask column becomes this many multicolour pixels, and each mask row this many lines. */
    const SCALE_X = 3;
    const SCALE_Y = 4;

    /** How far the top row is pushed right of the bottom row, in multicolour pixels. */
    const SLANT = 10;

    /** The drop shadow's offset, in multicolour pixels and lines. */
    const SHADOW_X = 2;
    const SHADOW_Y = 3;

    const SHADOW = 1;
    const HIGHLIGHT = 2;
    const BODY = 3;

    const mask = parseTextArt({ text: maskArt(), inks: 'x' });
    const width = mask.width * SCALE_X + SLANT + SHADOW_X;
    const height = mask.height * SCALE_Y + SHADOW_Y;
    const pixels = new Uint8Array(width * height);
    const stripeTop = Math.round(mask.height * SCALE_Y * 0.42);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (isInside(x, y)) {
                let value = BODY;
                if (!isInside(x + 1, y) || !isInside(x, y + 1) || !isInside(x, y + 2)) value = SHADOW;
                else if (!isInside(x - 1, y) || !isInside(x, y - 1) || !isInside(x, y - 2)) value = HIGHLIGHT;
                else if (y === stripeTop || y === stripeTop + 1) value = HIGHLIGHT;
                pixels[y * width + x] = value;
            }
            else if (isInside(x - SHADOW_X, y - SHADOW_Y)) {
                pixels[y * width + x] = SHADOW;
            }
        }
    }
    return { width, height, pixels };

    /** Whether the slanted, scaled-up mask covers a logo pixel. */
    function isInside(x: number, y: number): boolean {
        const maskHeight = mask.height * SCALE_Y;
        if (y < 0 || y >= maskHeight) return false;
        const slant = Math.round((SLANT * (maskHeight - 1 - y)) / (maskHeight - 1));
        const col = Math.floor((x - slant) / SCALE_X);
        const row = Math.floor(y / SCALE_Y);
        if (col < 0 || col >= mask.width) return false;
        return mask.pixels[row * mask.width + col] !== 0;
    }
}

/** The letters' coarse mask. A function, so it is hoisted above `LOGO`'s initialiser. */
function maskArt(): string {
    return `
xxxx.....xxxx...xxx.......xxx...xxxxxxxxxxxxx
xxxxx...xxxxx...xxx.......xxx...xxxxxxxxxxxxx
xxxxxx.xxxxxx...xxx.......xxx...xxxxxxxxxxxxx
xxxxxxxxxxxxx...xxx.......xxx........xxx.....
xxx.xxxxx.xxx...xxxx.....xxxx........xxx.....
xxx..xxx..xxx....xxx.....xxx.........xxx.....
xxx...x...xxx....xxxx...xxxx.........xxx.....
xxx.......xxx.....xxx...xxx..........xxx.....
xxx.......xxx.....xxxx.xxxx..........xxx.....
xxx.......xxx......xxxxxxx...........xxx.....
xxx.......xxx.......xxxxx............xxx.....
xxx.......xxx........xxx.............xxx.....
`;
}

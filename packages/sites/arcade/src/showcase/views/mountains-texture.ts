import { Texture } from 'pixi.js';
import { createRandom, type Random } from '@mvtjs/site-kit/random';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface MountainsTextureOptions {
    /** The sky's colour overhead, at the top of the picture. */
    readonly skyColour: number;
    /** The pale haze at the horizon, which the mountains fade into at their feet, and which fills the picture below it. */
    readonly horizonColour: number;
    /** How far the picture reaches round, from its left edge to its right, in metres. */
    readonly around: number;
    /** How far the picture reaches above and below the horizon, in metres. */
    readonly above: number;
    readonly below: number;
    /** How high the tallest peaks reach above the horizon, in metres. */
    readonly peakHeight: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Paints the far distance on a canvas, all the way round. The sky fades to
 * haze at the horizon, and mountains stand along it, in a simple, low-poly
 * style. Each far peak is a triangle, lit on one face and shaded on the
 * other, with a cap of snow. Lower foothills stand in front of them. The
 * picture's left edge meets its right edge, so it wraps round without a
 * seam. The mountains are grandest a quarter of the way across, and
 * grand again at three quarters, where the valley runs. They're lowest
 * between, where the hills beside the valley hide them. It's painted from
 * a fixed seed, so it's the same every time.
 */
export function createMountainsTexture(options: MountainsTextureOptions): Texture {
    const { skyColour, horizonColour, around, above, below, peakHeight } = options;
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('The arcade hall needs a 2D canvas to paint its mountains');
    const random = createRandom({ seed: 8848 });
    // Pixels a metre, across and up. The picture is wrapped round a wide ring, so a pixel across is wider than a pixel up
    const acrossScale = WIDTH / around;
    const upScale = HEIGHT / (above + below);
    const horizon = Math.round(above * upScale);
    const tallest = peakHeight * upScale;
    // How wide a peak's foot is, in pixels across, for each pixel of its height
    const footScale = acrossScale / upScale;
    const sky = toCss(skyColour);
    const haze = toCss(horizonColour);

    // The sky, deep blue overhead, paling toward the horizon, and the haze below it
    const skyGradient = context.createLinearGradient(0, 0, 0, horizon);
    skyGradient.addColorStop(0, sky);
    skyGradient.addColorStop(0.45, mixCss(skyColour, horizonColour, 0.45));
    skyGradient.addColorStop(1, haze);
    context.fillStyle = skyGradient;
    context.fillRect(0, 0, WIDTH, horizon);
    context.fillStyle = haze;
    context.fillRect(0, horizon, WIDTH, HEIGHT - horizon);

    const base = horizon + BASE_BELOW_HORIZON;
    paintRange(context, random, spreadPeaks({ random, tallest, footScale, spacing: FAR_SPACING }), base, FAR_COLOURS);
    paintRange(context, random, spreadPeaks({ random, tallest: tallest * FOOTHILL_SHARE, footScale, spacing: FOOTHILL_SPACING }), base, FOOTHILL_COLOURS);

    // The mountains' feet fade into the haze, as far-off things do on a clear day
    const feet = context.createLinearGradient(0, horizon - tallest * FEET_IN_HAZE, 0, horizon + 2);
    feet.addColorStop(0, withAlpha(horizonColour, 0));
    feet.addColorStop(1, withAlpha(horizonColour, 1));
    context.fillStyle = feet;
    context.fillRect(0, horizon - tallest * FEET_IN_HAZE, WIDTH, tallest * FEET_IN_HAZE + 2);
    context.fillStyle = haze;
    context.fillRect(0, horizon + 2, WIDTH, HEIGHT - horizon - 2);
    return Texture.from(canvas);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The picture's size, in pixels. It goes all the way round, so it's much wider than it is tall. */
const WIDTH = 2048;
const HEIGHT = 512;
/** How far below the horizon the mountains start, in pixels, so the haze never shows through under them. */
const BASE_BELOW_HORIZON = 6;
/** How far apart the peaks are, in pixels, at the least and the most, and how tall the foothills are beside the far peaks. */
const FAR_SPACING = { least: 22, most: 60 } as const;
const FOOTHILL_SPACING = { least: 30, most: 70 } as const;
const FOOTHILL_SHARE = 0.38;
/** How much of the tallest peak's height, up from the horizon, fades into the haze. */
const FEET_IN_HAZE = 0.2;

interface RangeColours {
    readonly lit: number;
    readonly shaded: number;
    /** The snow's colours, if the range has snow. */
    readonly snowLit: number | undefined;
    readonly snowShaded: number | undefined;
}

/** The far peaks, pale and bluish with distance, and capped with snow. */
const FAR_COLOURS: RangeColours = { lit: 0x93b0dc, shaded: 0x6f8dc2, snowLit: 0xffffff, snowShaded: 0xcbdcf3 };
/** The foothills, nearer, so a little deeper in colour, and too low for snow. */
const FOOTHILL_COLOURS: RangeColours = { lit: 0x6f9fc4, shaded: 0x5583ad, snowLit: undefined, snowShaded: undefined };

interface Peak {
    /** Where the peak's tip is across the picture, in pixels. */
    readonly x: number;
    /** How tall it is, in pixels. */
    readonly height: number;
    /** How far its foot reaches to the left and right of its tip, in pixels. */
    readonly left: number;
    readonly right: number;
}

/** What `spreadPeaks` spreads the peaks by. */
interface PeakOptions {
    readonly random: Random;
    readonly tallest: number;
    readonly footScale: number;
    readonly spacing: { readonly least: number; readonly most: number };
}

/**
 * Spreads peaks across the picture, `spacing` apart, up to `tallest` high
 * where the mountains are grandest. A peak's foot is `footScale` times as
 * wide, in pixels, as it would be if a pixel across were as wide as one
 * up. They're listed tallest first, so the lower ones are painted in front.
 */
function spreadPeaks(options: PeakOptions): Peak[] {
    const { random, tallest, footScale, spacing } = options;
    const peaks: Peak[] = [];
    for (let x = random.between(0, spacing.most); x < WIDTH; x += random.between(spacing.least, spacing.most)) {
        const height = tallest * grandeurAt(x / WIDTH) * random.between(0.5, 1);
        peaks.push({ x, height, left: height * footScale * random.between(1, 1.7), right: height * footScale * random.between(1, 1.7) });
    }
    return peaks.sort((a, b) => b.height - a.height);
}

/**
 * How grand the mountains are at `across`, from 0 to 1 across the picture,
 * which goes once round. They're grandest at a quarter of the way, and a
 * little less so at three quarters. They're low halfway and at the edges.
 */
function grandeurAt(across: number): number {
    const toward = Math.cos((across - 0.25) * Math.PI * 2);
    return 0.3 + 0.7 * Math.max(0, toward) ** 1.5 + 0.4 * Math.max(0, -toward) ** 1.5;
}

/** Paints a range of `peaks` standing on `base`, each one three times, so peaks that cross the picture's edge carry on round from the other side. */
function paintRange(context: CanvasRenderingContext2D, random: Random, peaks: readonly Peak[], base: number, colours: RangeColours): void {
    for (let i = 0; i < peaks.length; i++) {
        // The snow's ragged edge is drawn once for each peak, so its three copies match
        const snowline = random.between(0.3, 0.45);
        const jags = [random.between(-0.08, 0.08), random.between(-0.08, 0.08), random.between(-0.08, 0.08)];
        for (let copy = -1; copy <= 1; copy++) paintPeak(context, peaks[i], peaks[i].x + copy * WIDTH, base, colours, snowline, jags);
    }
}

/**
 * Paints a peak with its tip at `x`. It's a triangle in its lit colour,
 * and its right face is shaded, as if the sun were to the left. If the
 * range has snow, the top `snowline` of the peak is snow. The snow's edge
 * goes raggedly up and down by the `jags`.
 */
function paintPeak(
    context: CanvasRenderingContext2D, peak: Peak, x: number, base: number, colours: RangeColours,
    snowline: number, jags: readonly number[],
): void {
    const top = base - peak.height;
    const left = x - peak.left;
    const right = x + peak.right;
    fillTwoFaced(context, x, colours.lit, colours.shaded, () => {
        context.moveTo(left, base);
        context.lineTo(x, top);
        context.lineTo(right, base);
    });
    if (colours.snowLit === undefined || colours.snowShaded === undefined) return;
    // Where the snow's edge meets the peak's sides, and the ragged points between them
    const edgeY = top + peak.height * snowline;
    const snowLeft = x - peak.left * snowline;
    const snowRight = x + peak.right * snowline;
    fillTwoFaced(context, x, colours.snowLit, colours.snowShaded, () => {
        context.moveTo(x, top);
        context.lineTo(snowRight, edgeY);
        for (let j = 0; j < jags.length; j++) {
            const along = (j + 1) / (jags.length + 1);
            context.lineTo(snowRight + (snowLeft - snowRight) * along, edgeY + peak.height * (jags[j] + (j % 2 === 0 ? 0.06 : -0.03)));
        }
        context.lineTo(snowLeft, edgeY);
    });
}

/** Fills the shape that `trace` draws, in `lit` to the left of `split`, and in `shaded` to its right. */
function fillTwoFaced(context: CanvasRenderingContext2D, split: number, lit: number, shaded: number, trace: () => void): void {
    context.beginPath();
    trace();
    context.closePath();
    context.fillStyle = toCss(lit);
    context.fill();
    context.save();
    context.beginPath();
    context.rect(split, 0, WIDTH * 2, HEIGHT);
    context.clip();
    context.beginPath();
    trace();
    context.closePath();
    context.fillStyle = toCss(shaded);
    context.fill();
    context.restore();
}

function toCss(colour: number): string {
    return `#${colour.toString(16).padStart(6, '0')}`;
}

function withAlpha(colour: number, alpha: number): string {
    return `rgba(${(colour >> 16) & 0xff}, ${(colour >> 8) & 0xff}, ${colour & 0xff}, ${alpha})`;
}

/** The colour `amount` of the way from `from` to `to`, as CSS. */
function mixCss(from: number, to: number, amount: number): string {
    const red = Math.round(((from >> 16) & 0xff) + ((((to >> 16) & 0xff) - ((from >> 16) & 0xff)) * amount));
    const green = Math.round(((from >> 8) & 0xff) + ((((to >> 8) & 0xff) - ((from >> 8) & 0xff)) * amount));
    const blue = Math.round((from & 0xff) + (((to & 0xff) - (from & 0xff)) * amount));
    return `rgb(${red}, ${green}, ${blue})`;
}

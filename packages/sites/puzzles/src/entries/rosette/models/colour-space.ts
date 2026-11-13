// Colours in OKLab, Björn Ottosson's perceptual colour space (2020), and
// sRGB, the space a screen shows. In OKLab, equal distances look about
// equally different everywhere, so a distance between two colours says how
// alike they look. OKLCH is the same space in polar form: lightness L, from
// 0 (black) to 1 (white), chroma C, how colourful, and hue h, an angle
// round the colour wheel, in degrees.
//
// Every function writes into an array it is given, so none allocates.

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A colour as three numbers, written into by the functions here: OKLab's L, a and b, or linear sRGB's red, green and blue, from 0 to 1. */
export type ColourTriple = Float64Array;

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Makes an empty colour to write into. */
export function createColourTriple(): ColourTriple {
    return new Float64Array(3);
}

/** Writes the OKLab colour of OKLCH's lightness `l`, chroma `c` and hue `h`, in degrees, into `out`. */
export function writeOklch(l: number, c: number, h: number, out: ColourTriple): ColourTriple {
    const angle = (h * Math.PI) / 180;
    out[0] = l;
    out[1] = c * Math.cos(angle);
    out[2] = c * Math.sin(angle);
    return out;
}

/** Writes the linear sRGB of the OKLab colour `lab` into `out`. The channels may fall outside 0 to 1, for a colour sRGB can't show. */
export function writeLinearRgb(lab: ColourTriple, out: ColourTriple): ColourTriple {
    const l = lab[0];
    const a = lab[1];
    const b = lab[2];
    const lc = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const mc = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const sc = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
    out[0] = 4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc;
    out[1] = -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc;
    out[2] = -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc;
    return out;
}

/** Writes the OKLab colour of the linear sRGB `rgb` into `out`. */
export function writeOklab(rgb: ColourTriple, out: ColourTriple): ColourTriple {
    const r = rgb[0];
    const g = rgb[1];
    const b = rgb[2];
    const lc = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const mc = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const sc = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    out[0] = 0.2104542553 * lc + 0.793617785 * mc - 0.0040720468 * sc;
    out[1] = 1.9779984951 * lc - 2.428592205 * mc + 0.4505937099 * sc;
    out[2] = 0.0259040371 * lc + 0.7827717662 * mc - 0.808675766 * sc;
    return out;
}

/** Whether sRGB can show the linear sRGB colour `rgb`: whether every channel is from 0 to 1. */
export function isInGamut(rgb: ColourTriple): boolean {
    return rgb[0] >= -GAMUT_SLACK && rgb[0] <= 1 + GAMUT_SLACK
        && rgb[1] >= -GAMUT_SLACK && rgb[1] <= 1 + GAMUT_SLACK
        && rgb[2] >= -GAMUT_SLACK && rgb[2] <= 1 + GAMUT_SLACK;
}

/** Returns the most chroma sRGB can show at OKLCH's lightness `l` and hue `h`. */
export function findMostChroma(l: number, h: number): number {
    let low = 0;
    let high = MOST_CHROMA_SEARCHED;
    for (let i = 0; i < CHROMA_SEARCH_STEPS; i++) {
        const middle = (low + high) / 2;
        writeLinearRgb(writeOklch(l, middle, h, scratchLab), scratchRgb);
        if (isInGamut(scratchRgb)) low = middle;
        else high = middle;
    }
    return low;
}

/** Returns the colour `rgb`, in linear sRGB, as a screen shows it: 0xRRGGBB, each channel rounded to 8 bits. */
export function toHexColour(rgb: ColourTriple): number {
    return (toByte(rgb[0]) << 16) | (toByte(rgb[1]) << 8) | toByte(rgb[2]);
}

/** Writes the linear sRGB of the 0xRRGGBB colour `hex` into `out`. */
export function writeLinearRgbOfHex(hex: number, out: ColourTriple): ColourTriple {
    out[0] = fromByte((hex >> 16) & 0xff);
    out[1] = fromByte((hex >> 8) & 0xff);
    out[2] = fromByte(hex & 0xff);
    return out;
}

/** Returns how different two OKLab colours look: the distance between them. */
export function measureColourDistance(p: ColourTriple, q: ColourTriple): number {
    const dl = p[0] - q[0];
    const da = p[1] - q[1];
    const db = p[2] - q[2];
    return Math.sqrt(dl * dl + da * da + db * db);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far past 0 or 1 a channel may go and still count as in the gamut, for rounding. */
const GAMUT_SLACK = 1e-6;
/** More chroma than any colour in sRGB has, and how finely the most it can show is found. */
const MOST_CHROMA_SEARCHED = 0.4;
const CHROMA_SEARCH_STEPS = 14;

// Shared by the searches, which never run at the same time
const scratchLab = createColourTriple();
const scratchRgb = createColourTriple();

/** A linear channel as an 8-bit sRGB channel, with sRGB's curve. */
function toByte(linear: number): number {
    const v = Math.min(1, Math.max(0, linear));
    const encoded = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
    return Math.round(encoded * 255);
}

function fromByte(byte: number): number {
    const v = byte / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

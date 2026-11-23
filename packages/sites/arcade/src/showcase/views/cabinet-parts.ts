import { CubeGeometry, Material3D, PlaneGeometry } from '@pixi/3d';
import { CABINET_DEPTH, CABINET_HEIGHT, CABINET_WIDTH } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What every cabinet has the same of, which the hall's scene creates once, owns, and passes to each `CabinetView`. */
export interface CabinetParts {
    /** One paint for each of `CABINET_COLORS`, in the same order. */
    readonly paints: readonly Material3D[];
    /** The black of the control panel, the bezel and the marquee's box. */
    readonly black: Material3D;
    /** The boxes a cabinet is built from. */
    readonly base: CubeGeometry;
    readonly panel: CubeGeometry;
    readonly upper: CubeGeometry;
    readonly bezel: CubeGeometry;
    readonly marqueeBox: CubeGeometry;
    /** The plane each marquee's picture is drawn on. Every marquee is the same size. */
    readonly marqueePlane: PlaneGeometry;
    /** Every material and shape in the set, for the `owns` of the view that created it. */
    readonly resources: readonly (Material3D | CubeGeometry | PlaneGeometry)[];
}

/** The cabinets' paint, in turn along each wall. */
export const CABINET_COLORS: readonly number[] = [0xd8343f, 0x2f6fd6, 0xf0b429, 0x2fa86b, 0x8e44c9, 0xe8732c];

/** The base's height, in metres, which the control panel sits on. */
export const BASE_HEIGHT = 1.0;
/** How deep the control panel is, in metres. */
export const PANEL_DEPTH = 0.32;
/** The marquee's box along the top, its height and depth, in metres. */
export const MARQUEE_HEIGHT = 0.22;
export const MARQUEE_DEPTH = 0.4;
/** The upper body, with the screen set into it, its height and depth, in metres. */
export const UPPER_HEIGHT = CABINET_HEIGHT - BASE_HEIGHT - MARQUEE_HEIGHT;
export const UPPER_DEPTH = 0.4;
/** The bezel round the screen, its height and how thick it is, in metres. */
export const BEZEL_HEIGHT = 0.66;
export const BEZEL_DEPTH = 0.04;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the parts every cabinet shares. The view that calls it owns them, and lists `resources` in its `owns`. */
export function createCabinetParts(): CabinetParts {
    const paints = CABINET_COLORS.map((color) => new Material3D({ baseColor: color, roughness: 0.45, metallic: 0.1 }));
    const black = new Material3D({ baseColor: 0x0b0b10, roughness: 0.6 });
    const base = new CubeGeometry({ width: CABINET_WIDTH, height: BASE_HEIGHT, depth: CABINET_DEPTH });
    const panel = new CubeGeometry({ width: CABINET_WIDTH, height: 0.08, depth: PANEL_DEPTH });
    const upper = new CubeGeometry({ width: CABINET_WIDTH, height: UPPER_HEIGHT, depth: UPPER_DEPTH });
    const bezel = new CubeGeometry({ width: CABINET_WIDTH - 0.06, height: BEZEL_HEIGHT, depth: BEZEL_DEPTH });
    const marqueeBox = new CubeGeometry({ width: CABINET_WIDTH, height: MARQUEE_HEIGHT, depth: MARQUEE_DEPTH });
    const marqueePlane = new PlaneGeometry({ width: CABINET_WIDTH - 0.04, height: (CABINET_WIDTH - 0.04) / 4, flipV: true });
    return {
        paints,
        black,
        base,
        panel,
        upper,
        bezel,
        marqueeBox,
        marqueePlane,
        resources: [...paints, black, base, panel, upper, bezel, marqueeBox, marqueePlane],
    };
}

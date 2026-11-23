// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Where a screen is in a showcase, and its size, in metres. A screen is any flat rectangle that shows an entry, such as a cabinet's screen or a painting. */
export interface ScreenPlacement {
    /** The screen's middle. */
    readonly x: number;
    readonly y: number;
    readonly z: number;
    /** The way the screen faces, a unit vector. */
    readonly normalX: number;
    readonly normalY: number;
    readonly normalZ: number;
    /** The screen's right and its up, as someone facing it sees them, unit vectors along it. Its right is always level, so it doesn't have a y. */
    readonly rightX: number;
    readonly rightZ: number;
    readonly upX: number;
    readonly upY: number;
    readonly upZ: number;
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PlaceScreenOptions {
    /** The screen's middle, in metres. */
    readonly x: number;
    readonly y: number;
    readonly z: number;
    /** The way the screen faces, from +x toward +z, as seen from above. */
    readonly facing: number;
    /** How far the screen leans back from upright, in radians. Defaults to 0, upright. */
    readonly tilt?: number;
    /** The entry's play area, in its own pixels. The screen is the same shape. */
    readonly playWidth: number;
    readonly playHeight: number;
    /** The biggest the screen can be, in metres. It's as big as fits inside this. */
    readonly maxWidth: number;
    readonly maxHeight: number;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/** Returns where a screen is, and how big it is for its entry. */
export function placeScreen(options: PlaceScreenOptions): ScreenPlacement {
    const { x, y, z, facing, playWidth, playHeight, maxWidth, maxHeight } = options;
    const tilt = options.tilt ?? 0;
    const aspect = playWidth / playHeight;
    const isWide = aspect > maxWidth / maxHeight;
    const frontX = Math.cos(facing);
    const frontZ = Math.sin(facing);
    return {
        x,
        y,
        z,
        normalX: frontX * Math.cos(tilt),
        normalY: Math.sin(tilt),
        normalZ: frontZ * Math.cos(tilt),
        // Facing the screen, its right is a quarter turn on from the way the viewer faces
        rightX: frontZ,
        rightZ: -frontX,
        // Its up leans back with it
        upX: -frontX * Math.sin(tilt),
        upY: Math.cos(tilt),
        upZ: -frontZ * Math.sin(tilt),
        width: isWide ? maxWidth : maxHeight * aspect,
        height: isWide ? maxWidth / aspect : maxHeight,
    };
}

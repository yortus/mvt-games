import { placeScreen, type ScreenPlacement } from '@mvtjs/site-kit/showcase';
import { CABINET_DEPTH, SCREEN_HEIGHT_ABOVE_FLOOR, SCREEN_MAX_HEIGHT, SCREEN_MAX_WIDTH, SCREEN_SETBACK, SCREEN_TILT } from '../data';
import type { Cabinet } from '../models';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PlaceCabinetScreenOptions {
    readonly cabinet: Cabinet;
    /** The game's play area, in its own pixels. The screen is the same shape, as big as fits the cabinet. */
    readonly playWidth: number;
    readonly playHeight: number;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/** Returns where `cabinet`'s screen is, leaning back a little, set into its front, and how big it is for its game. */
export function placeCabinetScreen({ cabinet, playWidth, playHeight }: PlaceCabinetScreenOptions): ScreenPlacement {
    const forward = CABINET_DEPTH / 2 - SCREEN_SETBACK;
    return placeScreen({
        x: cabinet.x + Math.cos(cabinet.facing) * forward,
        y: SCREEN_HEIGHT_ABOVE_FLOOR,
        z: cabinet.z + Math.sin(cabinet.facing) * forward,
        facing: cabinet.facing,
        tilt: SCREEN_TILT,
        playWidth,
        playHeight,
        maxWidth: SCREEN_MAX_WIDTH,
        maxHeight: SCREEN_MAX_HEIGHT,
    });
}

import { Container, Graphics } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import type { Direction } from '../models';
import { drawOutlinedPixels, type PixelRects } from './drawing';
import { COLOURS } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FarmhandViewBindings {
    /** Where the farmhand is, in grid steps. */
    row: () => number;
    col: () => number;
    /** A cell's size in pixels, read once. */
    cellSize: number;
    /** How many times its pixel art's size to draw the farmhand, read once. Larger reads better on a small screen. */
    spriteScale: number;
    direction: () => Direction;
    isMoving: () => boolean;
    /** Whether they have wire out. They carry the reel. */
    isStringing: () => boolean;
    /** Whether they have been caught. They reel, and flicker. */
    isSnapped: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The farmhand: a small figure in a straw hat, a red shirt and blue
 * overalls, outlined in dark, standing on the fence at their grid point. They walk while
 * they move, carry a reel of wire while stringing, and face the way they
 * last went left or right.
 */
export function FarmhandView(bindings: FarmhandViewBindings): Container {
    const { cellSize, spriteScale } = bindings;
    const standing = drawPose(STAND_LEGS);
    const stepping = drawPose(STEP_LEGS);
    const striding = drawPose(STRIDE_LEGS);
    const reel = drawOutlinedPixels(new Graphics(), REEL, COLOURS.boot);
    const figure = new Container();
    figure.addChild(standing, stepping, striding, reel);
    const view = new Container();
    view.addChild(figure);

    // Presentation state: how far they have walked, for their steps; how
    // long since they were caught; and which way they face
    let walkMs = 0;
    let snappedMs = 0;
    let isFacingLeft = bindings.direction() === 'left';

    setUpdate(view, (deltaMs) => {
        if (bindings.isMoving()) walkMs += deltaMs;
        snappedMs = bindings.isSnapped() ? snappedMs + deltaMs : 0;
        const direction = bindings.direction();
        if (direction === 'left') isFacingLeft = true;
        else if (direction === 'right') isFacingLeft = false;
    });
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        view.position.set(Math.round(bindings.col() * cellSize), Math.round(bindings.row() * cellSize) + 2);
        figure.scale.set(isFacingLeft ? -spriteScale : spriteScale, spriteScale);
        const isMoving = bindings.isMoving();
        const step = Math.floor(walkMs / STEP_MS) % 4;
        standing.visible = !isMoving || step === 0 || step === 2;
        stepping.visible = isMoving && step === 1;
        striding.visible = isMoving && step === 3;
        reel.visible = bindings.isStringing();

        const isSnapped = bindings.isSnapped();
        figure.rotation = isSnapped ? Math.sin(snappedMs * 0.02) * 0.5 : 0;
        figure.alpha = isSnapped && Math.floor(snappedMs / 100) % 2 === 1 ? 0.3 : 1;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const STEP_MS = 90;

// Facing right, with the feet at the origin

const BODY: PixelRects = [
    [-2, -15, 5, 2, COLOURS.hat],
    [-2, -13, 5, 1, COLOURS.hatBand],
    [-4, -12, 9, 1, COLOURS.hat],
    [-2, -11, 5, 3, COLOURS.skin],
    [1, -10, 1, 1, COLOURS.boot],
    [-3, -8, 7, 4, COLOURS.shirt],
    [-2, -7, 5, 3, COLOURS.overalls],
    [-3, -4, 7, 2, COLOURS.overalls],
    [4, -6, 1, 2, COLOURS.skin],
];

const STAND_LEGS: PixelRects = [
    [-3, -2, 2, 2, COLOURS.overalls],
    [1, -2, 2, 2, COLOURS.overalls],
    [-3, 0, 2, 1, COLOURS.boot],
    [1, 0, 3, 1, COLOURS.boot],
];

const STEP_LEGS: PixelRects = [
    [-4, -2, 2, 2, COLOURS.overalls],
    [2, -2, 2, 2, COLOURS.overalls],
    [-4, 0, 2, 1, COLOURS.boot],
    [2, 0, 3, 1, COLOURS.boot],
];

const STRIDE_LEGS: PixelRects = [
    [-1, -2, 3, 2, COLOURS.overalls],
    [-1, 0, 3, 1, COLOURS.boot],
];

/** A reel of wire in the farmhand's hand. */
const REEL: PixelRects = [
    [4, -8, 3, 4, COLOURS.reel],
    [5, -7, 1, 2, COLOURS.wire],
];

/** A pose: the body and these legs, outlined in dark so the farmhand stands out from the straw. */
function drawPose(legs: PixelRects): Graphics {
    return drawOutlinedPixels(new Graphics(), [...BODY, ...legs], COLOURS.boot);
}

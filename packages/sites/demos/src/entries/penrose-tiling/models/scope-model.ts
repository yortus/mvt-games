import {
    DEFAULT_RADIUS,
    MAX_RADIUS,
    MIN_RADIUS,
    RESET_MS,
} from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Which way the window is zooming while a control is held. */
export type ZoomDirection = 'in' | 'out' | 'none';

/** Which way the window is turning while a control is held. Clockwise is as it looks on the screen. */
export type TurnDirection = 'clockwise' | 'anticlockwise' | 'none';

/**
 * The scope: an instrument, like a microscope, for looking at something flat.
 * Its state is the window it takes in: the point it is centred on, how far it
 * reaches, and how far it is turned. Its controls travel, zoom and turn the
 * window. Lengths are in whatever units the thing under it is measured in,
 * and y points down, as the screen's does.
 *
 * It only looks. It can't change what's under it, and it doesn't even know
 * what that is. It has no picture and no colours.
 */
export interface ScopeModel {
    /** The x of the window's centre. */
    readonly centreX: number;
    /** The y of the window's centre. */
    readonly centreY: number;
    /**
     * How far the window reaches, from its centre to its furthest corner,
     * from `MIN_RADIUS` to `MAX_RADIUS`. Smaller is closer in.
     * Setting it zooms about the centre.
     */
    radius: number;
    /** How far the window is turned, in radians, from -pi to pi. Positive turns what it sees clockwise. */
    rotation: number;

    /** Which way the window is travelling across the screen, from -1 (left) to 1 (right). */
    travelX: number;
    /** Which way the window is travelling down the screen, from -1 (up) to 1 (down). */
    travelY: number;
    /** Which way the window is zooming. */
    zooming: ZoomDirection;
    /** Which way the window is turning. */
    turning: TurnDirection;

    /** Moves the window's centre by (`deltaX`, `deltaY`). */
    moveCentre: (deltaX: number, deltaY: number) => void;
    /**
     * Zooms in by `factor` about the point (`x`, `y`), which stays where it
     * is in the window. Above 1 is closer in. The radius stops at its limits.
     */
    zoomAbout: (factor: number, x: number, y: number) => void;
    /** Turns the window by `angle` radians about the point (`x`, `y`), which stays where it is in the window. */
    turnAbout: (angle: number, x: number, y: number) => void;
    /**
     * Eases the window back to where it started over `RESET_MS`: centred on
     * the middle, at the starting zoom, unturned. Any other move of the window
     * stops it where it has got to, so the visitor always has the last word.
     */
    reset: () => void;
    /** Moves the window on by `deltaMs`, as its held controls and any reset ask. */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a scope with its window at the middle, at the starting zoom, unturned. */
export function createScopeModel(): ScopeModel {
    let centreX = 0;
    let centreY = 0;
    let radius = DEFAULT_RADIUS;
    let rotation = 0;

    let travelX = 0;
    let travelY = 0;
    let zooming: ZoomDirection = 'none';
    let turning: TurnDirection = 'none';

    // Where a reset set out from, and how long it has been going
    let isResetting = false;
    let resetMs = 0;
    let resetFromX = 0;
    let resetFromY = 0;
    let resetFromRadius = 0;
    let resetFromRotation = 0;

    const model: ScopeModel = {
        get centreX() { return centreX; },
        get centreY() { return centreY; },
        get radius() { return radius; },
        set radius(value) {
            isResetting = false;
            radius = clamp(value, MIN_RADIUS, MAX_RADIUS);
        },
        get rotation() { return rotation; },
        set rotation(value) {
            isResetting = false;
            rotation = wrapAngle(value);
        },

        get travelX() { return travelX; },
        set travelX(value) { travelX = clamp(value, -1, 1); },
        get travelY() { return travelY; },
        set travelY(value) { travelY = clamp(value, -1, 1); },
        get zooming() { return zooming; },
        set zooming(value) { zooming = value; },
        get turning() { return turning; },
        set turning(value) { turning = value; },

        moveCentre(deltaX, deltaY) {
            isResetting = false;
            centreX = clamp(centreX + deltaX, -MAX_TRAVEL, MAX_TRAVEL);
            centreY = clamp(centreY + deltaY, -MAX_TRAVEL, MAX_TRAVEL);
        },

        zoomAbout(factor, x, y) {
            if (!(factor > 0)) return;
            const nextRadius = clamp(radius / factor, MIN_RADIUS, MAX_RADIUS);
            // The factor actually applied, after the limits. The point keeps
            // its place in the window, so the window closes in on it.
            const applied = radius / nextRadius;
            radius = nextRadius;
            model.moveCentre((x - centreX) * (1 - 1 / applied), (y - centreY) * (1 - 1 / applied));
        },

        turnAbout(angle, x, y) {
            rotation = wrapAngle(rotation + angle);
            // Turning what it sees one way about the point turns the centre
            // the other way about it, as seen from what is under it.
            const cos = Math.cos(-angle);
            const sin = Math.sin(-angle);
            const fromX = centreX - x;
            const fromY = centreY - y;
            model.moveCentre(x + fromX * cos - fromY * sin - centreX, y + fromX * sin + fromY * cos - centreY);
        },

        reset() {
            isResetting = true;
            resetMs = 0;
            resetFromX = centreX;
            resetFromY = centreY;
            resetFromRadius = radius;
            resetFromRotation = rotation;
        },

        update,
    };

    return model;

    // ---- Update ------------------------------------------------------------

    function update(deltaMs: number): void {
        moveWindow(deltaMs / 1000);
        if (isResetting) easeBack(deltaMs);
    }

    /** Travels, zooms and turns the window, as its held controls ask. */
    function moveWindow(seconds: number): void {
        if (zooming !== 'none') {
            const factor = Math.exp(ZOOM_RATE * seconds);
            model.zoomAbout(zooming === 'in' ? factor : 1 / factor, centreX, centreY);
        }
        if (turning !== 'none') {
            isResetting = false;
            rotation = wrapAngle(rotation + (turning === 'clockwise' ? TURN_RATE : -TURN_RATE) * seconds);
        }
        if (travelX !== 0 || travelY !== 0) {
            // Across the window, which is turned against what is under it
            const distance = TRAVEL_RATE * radius * seconds;
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            model.moveCentre((travelX * cos + travelY * sin) * distance, (travelY * cos - travelX * sin) * distance);
        }
    }

    /**
     * Moves a reset on. Each value is worked out from where the reset set
     * out, so it follows the same path at any step size. The radius moves by
     * equal factors rather than equal amounts, which looks like an even zoom.
     */
    function easeBack(deltaMs: number): void {
        resetMs += deltaMs;
        if (resetMs >= RESET_MS) {
            centreX = 0;
            centreY = 0;
            radius = DEFAULT_RADIUS;
            rotation = 0;
            isResetting = false;
            return;
        }
        const progress = resetMs / RESET_MS;
        const eased = progress * progress * (3 - 2 * progress);
        centreX = resetFromX * (1 - eased);
        centreY = resetFromY * (1 - eased);
        radius = resetFromRadius * (DEFAULT_RADIUS / resetFromRadius) ** eased;
        rotation = resetFromRotation * (1 - eased);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How fast the window travels while a control is held, in radii per second. */
const TRAVEL_RATE = 0.5;
/** How fast the window zooms while a control is held, as the natural log of the zoom per second. */
const ZOOM_RATE = 1.1;
/** How fast the window turns while a control is held, in radians per second. */
const TURN_RATE = 1.2;
/** How far the window's centre can go from the middle. */
const MAX_TRAVEL = 100_000;

function clamp(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
}

/** `angle`, brought round into the range from -pi up to, but not including, pi. */
function wrapAngle(angle: number): number {
    return angle - Math.PI * 2 * Math.floor((angle + Math.PI) / (Math.PI * 2));
}

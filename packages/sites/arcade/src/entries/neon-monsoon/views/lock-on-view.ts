import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { NEON } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface LockOnViewBindings {
    isShown: () => boolean;
    /** How far the lock has closed, from 0 to 1. At 1 it is locked. */
    progress: () => number;
    /** Where the crosshairs set out from: the ship. */
    fromX: () => number;
    fromY: () => number;
    /** The target, and its hit radius, which the crosshairs close around. */
    x: () => number;
    y: () => number;
    targetRadius: () => number;
    /** The game's step count, which times the blink once locked, so a replay blinks the same way. */
    stepCount: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The volley's crosshairs: four corner brackets. As the lock closes, they
 * fly from the ship to the target, then tighten around it. Once locked,
 * they blink. They have no state of their own: everything follows the
 * lock's progress and the target's place.
 */
export function LockOnView(bindings: LockOnViewBindings): Container {
    const view = new Container();
    // One bracket shape, the top left corner, flipped for the other three
    const corners: Graphics[] = [];
    for (let i = 0; i < 4; i++) {
        const corner = new Graphics();
        drawCorner(corner);
        corner.scale.set(i % 2 === 0 ? 1 : -1, i < 2 ? 1 : -1);
        corners.push(corner);
        view.addChild(corner);
    }

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        view.visible = bindings.isShown();
        if (!view.visible) return;

        const progress = bindings.progress();
        const travel = easeOutCubic(Math.min(1, progress / TRAVEL_FRACTION));
        const fromX = bindings.fromX();
        const fromY = bindings.fromY();
        const x = Math.round(fromX + (bindings.x() - fromX) * travel);
        const y = Math.round(fromY + (bindings.y() - fromY) * travel);
        const gap = Math.round(bindings.targetRadius() + WIDE_GAP + (TIGHT_GAP - WIDE_GAP) * easeInOutQuad(progress));

        // Each flipped corner covers the pixels just inside its own position
        corners[0].position.set(x - gap, y - gap);
        corners[1].position.set(x + gap + 1, y - gap);
        corners[2].position.set(x - gap, y + gap + 1);
        corners[3].position.set(x + gap + 1, y + gap + 1);

        const isLocked = progress >= 1;
        const isBlinkOn = Math.floor(bindings.stepCount() / BLINK_STEPS) % 2 === 0;
        const tint = isLocked ? (isBlinkOn ? 0xffffff : NEON.cyan) : NEON.magenta;
        const alpha = isLocked ? 1 : 0.5 + 0.5 * progress;
        for (let i = 0; i < corners.length; i++) {
            corners[i].tint = tint;
            corners[i].alpha = alpha;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The part of the lock spent flying from the ship to the target. The rest tightens on it. */
const TRAVEL_FRACTION = 0.4;
/** How far outside the target's radius the brackets start, and end, in pixels. */
const WIDE_GAP = 14;
const TIGHT_GAP = 3;
/** The length of each bracket's arms, in pixels. */
const ARM = 4;
/** Steps between the blink's changes, once locked. */
const BLINK_STEPS = 4;

/** A top left corner, one pixel wide, in white, so it can be tinted. */
function drawCorner(g: Graphics): void {
    g.rect(0, 0, ARM, 1).fill(0xffffff);
    g.rect(0, 1, 1, ARM - 1).fill(0xffffff);
}

function easeOutCubic(t: number): number {
    const u = 1 - t;
    return 1 - u * u * u;
}

function easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
}

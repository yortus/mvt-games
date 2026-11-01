import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { ChestPhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ChestViewBindings {
    readonly phase: () => ChestPhase;
    /** How far through opening or closing, 0..1. 1 when open or closed. */
    readonly progress: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The chest, seen from the side, with a lid that swings open on its hinge,
 * and gold that glows inside as it opens. The view's origin is the middle
 * of the chest's top edge.
 */
export function ChestView(bindings: ChestViewBindings): Container {
    const view = new Container();

    const glow = new Graphics().ellipse(0, 0, CHEST_WIDTH * 0.42, 16).fill({ color: 0xffd34d, alpha: 0.9 });

    const base = new Graphics()
        .rect(-CHEST_WIDTH / 2, 0, CHEST_WIDTH, BASE_HEIGHT).fill(0x8a5a2b)
        .rect(-CHEST_WIDTH / 2, 20, CHEST_WIDTH, 7).fill(0x5e3b19)
        .rect(-7, 5, 14, 16).fill(0xd9b44a);

    // The lid turns on its hinge, at the back of the chest, on the left
    const lid = new Graphics()
        .rect(0, -LID_HEIGHT, CHEST_WIDTH, LID_HEIGHT).fill(0x9c6631)
        .rect(0, -LID_HEIGHT, CHEST_WIDTH, 6).fill(0x5e3b19);
    lid.position.set(-CHEST_WIDTH / 2, 0);

    view.addChild(glow, base, lid);
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const openness = opennessOf(bindings.phase(), bindings.progress());
        lid.rotation = -MAX_LID_ANGLE * openness;
        glow.alpha = openness;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const CHEST_WIDTH = 100;
const BASE_HEIGHT = 60;
const LID_HEIGHT = 24;
/** How far the lid swings back, in radians: a little past upright. */
const MAX_LID_ANGLE = 1.9;

/** How open the chest looks, from 0 for shut to 1 for wide open. */
function opennessOf(phase: ChestPhase, progress: number): number {
    if (phase === 'opening') return progress;
    if (phase === 'open') return 1;
    if (phase === 'closing') return 1 - progress;
    return 0;
}

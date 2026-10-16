import { Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SpinnerViewBindings {
    /** How far through its turn it is, from 0 up to 1. */
    readonly progress: () => number;
    /** Where its centre is, in the stage's pixels. */
    readonly x: number;
    readonly y: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A square that turns once each cycle. */
export function SpinnerView(bindings: SpinnerViewBindings): Graphics {
    const square = new Graphics().rect(-SIZE / 2, -SIZE / 2, SIZE, SIZE).fill(0x44aaff);
    square.position.set(bindings.x, bindings.y);
    setRefresh(square, refresh);
    return square;

    function refresh(): void {
        square.rotation = bindings.progress() * Math.PI * 2;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The square's width and height, in pixels. */
const SIZE = 80;

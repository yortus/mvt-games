// Easing functions turn steady progress, from 0 to 1, into curved progress.
// Each is a pure function, with no state.

/** Starts fast, and slows to a stop. */
export function easeOutQuad(t: number): number {
    return t * (2 - t);
}

/** Overshoots the end a little, then springs back to it. */
export function easeOutBack(t: number): number {
    const u = t - 1;
    return 1 + 2.7 * u * u * u + 1.7 * u * u;
}

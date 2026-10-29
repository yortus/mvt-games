// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** How a chip's `stop` stops a song. */
export interface StopOptions {
    /**
     * How long to fade the song out over, in ms, before it stops. The fade
     * is even in decibels, so it sounds even to the ear. The chip fades as a
     * whole, sounds included, which is why a game plays its sound effects on
     * a chip of their own. Defaults to 0, which stops the song at once. A
     * sound's `stop` ignores it: its envelope's release fades it out.
     */
    readonly fadeMs?: number;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** The fade a `stop` asks for, in ms, or 0 for none. Throws if `fadeMs` is not 0 or more and finite. */
export function checkStopFadeMs(options: StopOptions | undefined): number {
    const fadeMs = options?.fadeMs ?? 0;
    if (!(Number.isFinite(fadeMs) && fadeMs >= 0)) throw new Error(`stop: fadeMs must be 0 or more, and finite; got ${fadeMs}`);
    return fadeMs;
}

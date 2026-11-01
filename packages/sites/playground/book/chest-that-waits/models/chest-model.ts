// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long the lid takes to open, in ms. */
const OPEN_MS = 400;
/** How long the lid takes to close, in ms. */
const CLOSE_MS = 300;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Which part of opening or closing the chest is in. */
export type ChestPhase = 'opening' | 'open' | 'closing' | 'closed';

/**
 * A treasure chest. Opening and closing take a set time, but once it's open
 * or closed, it waits until an action moves it on: `open` and `closed` are
 * open-ended phases.
 */
export interface ChestModel {
    readonly phase: ChestPhase;
    /** How far through opening or closing, 0..1. 1 when open or closed. */
    readonly progress: number;
    /** Starts opening the chest, if it's closed. */
    readonly open: () => void;
    /** Starts closing the chest, if it's open. */
    readonly close: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a chest that's closed. */
export function createChestModel(): ChestModel {
    let phase: ChestPhase = 'closed';
    let elapsedMs = 0;
    let durationMs = 0;

    return {
        get phase() { return phase; },
        get progress() {
            if (durationMs <= 0) return 1;
            return Math.min(1, elapsedMs / durationMs);
        },

        open() {
            if (phase === 'closed') beginPhase('opening', OPEN_MS);
        },

        close() {
            if (phase === 'open') beginPhase('closing', CLOSE_MS);
        },

        update(deltaMs) {
            if (durationMs <= 0) return; // open-ended: nothing to time
            elapsedMs += deltaMs;
            if (elapsedMs >= durationMs) nextPhase();
        },
    };

    function beginPhase(next: ChestPhase, ms: number): void {
        phase = next;
        elapsedMs = 0;
        durationMs = ms;
    }

    function nextPhase(): void {
        if (phase === 'opening') beginPhase('open', 0);
        else if (phase === 'closing') beginPhase('closed', 0);
    }
}

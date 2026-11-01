// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long the popup takes to open, in ms. */
const OPEN_MS = 400;
/** How long the popup takes to close, in ms. Slow enough to watch it bob as it goes. */
const CLOSE_MS = 1500;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Where the popup is in its life. `'open'` lasts until the player closes it. */
export type PopupPhase = 'opening' | 'open' | 'closing' | 'closed';

/**
 * A popup that opens over a set time, stays open until it's closed, then
 * closes over a set time. The model times the opening and the closing, and
 * keeps no clock while the popup is open, since nothing in the game depends
 * on how long it has been open.
 */
export interface PopupModel {
    readonly phase: PopupPhase;
    /** How far through the phase the popup is, from 0 to 1. Always 1 in `'closed'` and `'open'`. */
    readonly progress: number;
    /** Opens a closed popup. */
    readonly open: () => void;
    /** Closes an open popup. */
    readonly close: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a popup that has just begun to open. */
export function createPopupModel(): PopupModel {
    let phase: PopupPhase = 'opening';
    let elapsedMs = 0;

    const model: PopupModel = {
        get phase() { return phase; },
        get progress() {
            if (phase === 'opening') return Math.min(1, elapsedMs / OPEN_MS);
            if (phase === 'closing') return Math.min(1, elapsedMs / CLOSE_MS);
            return 1;
        },

        open() {
            if (phase !== 'closed') return;
            phase = 'opening';
            elapsedMs = 0;
        },

        close() {
            if (phase !== 'open') return;
            phase = 'closing';
            elapsedMs = 0;
        },

        update(deltaMs) {
            if (phase !== 'opening' && phase !== 'closing') return;
            elapsedMs += deltaMs;
            if (phase === 'opening' && elapsedMs >= OPEN_MS) phase = 'open';
            if (phase === 'closing' && elapsedMs >= CLOSE_MS) phase = 'closed';
        },
    };

    return model;
}

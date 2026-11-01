// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long the banner takes to slide in, in ms. */
const OPEN_MS = 300;
/** How long the banner stays, once it's in, in ms. */
const SHOW_MS = 2000;
/** How long the banner takes to slide out, in ms. */
const CLOSE_MS = 200;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Which part of its show the banner is in. */
export type BannerPhase = 'opening' | 'open' | 'closing' | 'closed';

/**
 * A banner that slides in, stays for a while, then slides out. It gives
 * one phase, and one progress through that phase.
 */
export interface BannerModel {
    readonly phase: BannerPhase;
    /** How far through the phase, from 0 to 1. */
    readonly progress: number;
    /** Starts the banner's show, if it's closed. */
    readonly show: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a banner that's closed. */
export function createBannerModel(): BannerModel {
    let phase: BannerPhase = 'closed';
    let elapsedMs = 0;
    let durationMs = 0;

    return {
        get phase() { return phase; },
        get progress() {
            if (durationMs <= 0) return 1;
            return Math.min(1, elapsedMs / durationMs);
        },

        show() {
            if (phase === 'closed') beginPhase('opening', OPEN_MS);
        },

        update(deltaMs) {
            if (phase === 'closed') return;
            elapsedMs += deltaMs;
            if (elapsedMs >= durationMs) nextPhase();
        },
    };

    function beginPhase(next: BannerPhase, ms: number): void {
        phase = next;
        elapsedMs = 0;
        durationMs = ms;
    }

    function nextPhase(): void {
        if (phase === 'opening') beginPhase('open', SHOW_MS);
        else if (phase === 'open') beginPhase('closing', CLOSE_MS);
        else if (phase === 'closing') beginPhase('closed', 0);
    }
}

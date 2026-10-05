import { assert } from '@mvtjs/utils';
import { SETTLE_DISTANCE, SETTLE_MS, SPIN_SPEED, type SymbolKind } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** `'settling'` while the reel slows onto its stop. */
export type ReelPhase = 'stopped' | 'spinning' | 'settling';

/**
 * One reel: a fixed strip of symbols that turns, and lands on a stop it is
 * given. Everything is in strip positions: the window shows the symbols at
 * `position`, `position + 1` and `position + 2`, top to bottom.
 *
 * While settling, `position` moves linearly from `settleDistance` above the
 * stop down to the stop. That is the domain's account of the landing; a view
 * that wants it to bounce eases `progress` itself.
 *
 * Leap-safe: one large `update` lands the reel exactly where many small ones
 * would.
 */
export interface ReelModel {
    readonly strip: readonly SymbolKind[];
    readonly phase: ReelPhase;
    /**
     * The strip position showing in the window's top row, in `[0, strip
     * length)`. Fractional while the reel moves. It falls as the reel turns,
     * so symbols move down the window.
     */
    readonly position: number;
    /** The strip position the reel lands on, or rests at. */
    readonly stopIndex: number;
    /** How far the current settle travels, in strip positions. */
    readonly settleDistance: number;
    /** How far through the settle the reel is, from 0 to 1, rising steadily. 0 unless settling. */
    readonly progress: number;
    /** The symbol at a strip position. Any whole number, wrapping round the strip. */
    symbolAt: (index: number) => SymbolKind;

    /** Start turning at full speed, to start settling onto `stopIndex` after `settleAfterMs`. */
    spin: (options: ReelSpinOptions) => void;
    /** Land within `withinMs`, settling from where the reel is if it hasn't started to. */
    hurry: (withinMs: number) => void;
    update: (deltaMs: number) => void;
}

/** Where a spin lands, and when the reel starts to settle onto it. */
export interface ReelSpinOptions {
    /** The strip position to land on. */
    readonly stopIndex: number;
    /** How long to turn at full speed before settling. */
    readonly settleAfterMs: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ReelModelOptions {
    readonly strip: readonly SymbolKind[];
    /** Where the reel rests to begin with. */
    readonly stopIndex: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createReelModel(options: ReelModelOptions): ReelModel {
    const { strip } = options;
    const length = strip.length;

    let phase: ReelPhase = 'stopped';
    let stopIndex = options.stopIndex;
    let spinPosition = stopIndex;
    let msUntilSettle = 0;
    let progress = 0;
    let settleRemainingMs = 0;

    const model: ReelModel = {
        strip,
        get phase() { return phase; },
        get position() {
            if (phase === 'spinning') return spinPosition;
            if (phase === 'settling') return wrap(stopIndex + (1 - progress) * SETTLE_DISTANCE);
            return stopIndex;
        },
        get stopIndex() { return stopIndex; },
        get settleDistance() { return SETTLE_DISTANCE; },
        get progress() { return progress; },
        symbolAt: (index) => strip[wrap(index)],

        spin({ stopIndex: nextStop, settleAfterMs }) {
            assert(phase === 'stopped', 'A reel spins only from rest');
            spinPosition = stopIndex;
            stopIndex = nextStop;
            msUntilSettle = settleAfterMs;
            phase = 'spinning';
        },

        hurry(withinMs) {
            if (phase === 'spinning') {
                startSettling(withinMs);
            }
            else if (phase === 'settling') {
                // Faster, never slower, and from the same progress, so an eased landing doesn't jump
                settleRemainingMs = Math.min(settleRemainingMs, withinMs);
            }
        },

        update(deltaMs) {
            let remainingMs = deltaMs;
            if (phase === 'spinning') {
                if (remainingMs < msUntilSettle) {
                    msUntilSettle -= remainingMs;
                    spinPosition = wrap(spinPosition - SPIN_SPEED * remainingMs * 0.001);
                    return;
                }
                remainingMs -= msUntilSettle;
                startSettling(SETTLE_MS);
            }
            if (phase === 'settling') {
                if (remainingMs < settleRemainingMs) {
                    // Linear from here to the end, at whatever rate lands it on time
                    progress += (1 - progress) * remainingMs / settleRemainingMs;
                    settleRemainingMs -= remainingMs;
                }
                else {
                    progress = 0;
                    phase = 'stopped';
                }
            }
        },
    };

    return model;

    /**
     * Settling starts `settleDistance` above the stop, wherever the reel was:
     * the stop was drawn at random, so the reel can't both turn honestly and
     * arrive on it in time. Video slots jump the same way. At full speed
     * the jump can't be seen.
     */
    function startSettling(durationMs: number): void {
        phase = 'settling';
        progress = 0;
        settleRemainingMs = durationMs;
    }

    function wrap(index: number): number {
        const wrapped = index % length;
        return wrapped < 0 ? wrapped + length : wrapped;
    }
}

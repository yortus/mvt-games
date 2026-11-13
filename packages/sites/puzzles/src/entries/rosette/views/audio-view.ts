import { Container } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { watch } from '@mvtjs/utils';
import type { SfxChip } from '@mvtjs/site-kit/sound';
import { LOCKED, SOLVED, SWAPPED, UNDONE } from '../data';
import { FLY_MS } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What an `AudioView` plays on, and what it plays the sounds of. Each count rises at a moment worth a sound. */
export interface AudioViewBindings {
    /** The chip the sound effects play on. It is the view's output, so the view reads it once. */
    readonly sfx: SfxChip<'audio90'>;
    /** Swaps made, and undone, in the open puzzle. */
    readonly swapsMade: () => number;
    readonly undosDone: () => number;
    /** Where across the picture the last swap ended, from -1 at the left edge to 1 at the right, which its sound is panned to. */
    readonly swapPan: () => number;
    /** Swaps that locked more pieces, in the open puzzle. */
    readonly locksGained: () => number;
    /** Whether the open puzzle is solved, when the solved chime says it all. */
    readonly isSolved: () => boolean;
    /** Puzzles solved on this visit. */
    readonly puzzlesSolved: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Plays the game's sounds, on the Audio90. A swap clinks like glass,
 * panned to where it ended, undo blips, and a picture made whole chimes.
 * Pieces that join the locked ones chime softly as they lift into the
 * frame, once the swapped pieces have landed, unless that swap made the
 * picture whole. No other sound says whether a piece went to its own tile.
 *
 * The wait for the pieces to land is presentation state, counted down in
 * the update step, and each lock chime is counted as it falls due, so the
 * refresh step plays it as that count rises.
 */
export function AudioView(bindings: AudioViewBindings): Container {
    const { sfx } = bindings;
    const view = new Container();
    view.label = 'rosette-audio';
    // The time left until the lock chime, or -1 for none due, and how many have fallen due
    let lockChimeMs = -1;
    let lockChimesDue = 0;
    const gains = watch({ gained: bindings.locksGained });
    const watcher = watch({ swaps: bindings.swapsMade, undos: bindings.undosDone, solved: bindings.puzzlesSolved, chimes: () => lockChimesDue });
    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function update(deltaMs: number): void {
        if (gains.poll().gained.increased) lockChimeMs = bindings.isSolved() ? -1 : FLY_MS;
        else if (lockChimeMs >= 0) {
            lockChimeMs -= deltaMs;
            if (lockChimeMs <= 0) {
                lockChimeMs = -1;
                lockChimesDue++;
            }
        }
    }

    function refresh(): void {
        const w = watcher.poll();
        if (w.solved.increased) sfx.play(SOLVED);
        else if (w.swaps.increased) sfx.play(SWAPPED, { pan: bindings.swapPan() * PAN_SPREAD });
        if (w.undos.increased) sfx.play(UNDONE);
        if (w.chimes.increased) sfx.play(LOCKED);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How wide the swaps' sounds spread across the stereo field. */
const PAN_SPREAD = 0.5;

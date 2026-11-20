import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { SfxChip } from '@mvtjs/site-kit/sound';
import { watch } from '@mvtjs/utils';
import { CLASHED, CROSSED, GROUPED, RUBBED, SOLVED, STARRED, UNDONE } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What an `AudioView` plays on, and what it plays the sounds of. Each count rises at a moment worth a sound. */
export interface AudioViewBindings {
    /** The chip the sound effects play on. It is the view's output, so the view reads it once. */
    readonly sfx: SfxChip<'audio90'>;
    /** Stars placed in the open puzzle. */
    readonly starsPlaced: () => number;
    /** Crosses marked in the open puzzle. */
    readonly crossesMarked: () => number;
    /** Marks taken off in the open puzzle. */
    readonly marksCleared: () => number;
    /** Marks that made more stars break a rule, in the open puzzle. */
    readonly clashesMade: () => number;
    /** Groups ringed in the open puzzle. */
    readonly groupsNoted: () => number;
    /** Rings taken off in the open puzzle. */
    readonly groupsCleared: () => number;
    /** Actions undone in the open puzzle. */
    readonly undosDone: () => number;
    /** Where across the grid the last mark was, from -1 at the left edge to 1 at the right, which its sound is panned to. */
    readonly markPan: () => number;
    /**
     * The number of puzzles opened on this visit. It rises each time the
     * puzzle shown changes, which happens when a puzzle is opened or started
     * again, and when a walkthrough starts or ends. The other counts are read
     * from the puzzle shown, so they can jump when it changes, even though the
     * player hasn't made a move. On the tick when this number changes, the
     * view stays silent for those counts.
     */
    readonly puzzlesOpened: () => number;
    /** Puzzles solved on this visit. */
    readonly puzzlesSolved: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Plays the game's sounds, on the Audio90. Each cross ticks, and a star
 * twinkles. A ring drawn round a group sweeps up, and a mark or a ring
 * taken off brushes. A star that breaks a rule knocks low, twice, in place
 * of its own sound. Undo blips, and a solved puzzle chimes. When the
 * puzzle shown changes, its counts replace the last puzzle's, and on that
 * tick the view stays silent for them.
 */
export function AudioView(bindings: AudioViewBindings): Container {
    const { sfx } = bindings;
    const view = new Container();
    view.label = 'stars-audio';
    const watcher = watch({
        stars: bindings.starsPlaced,
        crosses: bindings.crossesMarked,
        cleared: bindings.marksCleared,
        clashes: bindings.clashesMade,
        grouped: bindings.groupsNoted,
        ungrouped: bindings.groupsCleared,
        undos: bindings.undosDone,
        opened: bindings.puzzlesOpened,
        solved: bindings.puzzlesSolved,
    });
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const w = watcher.poll();
        if (!w.opened.changed) {
            const pan = bindings.markPan() * PAN_SPREAD;
            if (w.clashes.increased) sfx.play(CLASHED, { pan });
            else if (w.stars.increased) sfx.play(STARRED, { pan });
            else if (w.crosses.increased) sfx.play(CROSSED, { pan });
            else if (w.grouped.increased) sfx.play(GROUPED, { pan });
            else if (w.cleared.increased || w.ungrouped.increased) sfx.play(RUBBED, { pan });
            if (w.undos.increased) sfx.play(UNDONE);
        }
        if (w.solved.increased) sfx.play(SOLVED);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How wide the marks' sounds spread across the stereo field. */
const PAN_SPREAD = 0.5;

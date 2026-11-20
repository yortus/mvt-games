import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { SfxChip } from '@mvtjs/site-kit/sound';
import { watch } from '@mvtjs/utils';
import { BUBBLED, CHIRPED, CLASHED, RUSTLED, SANG, SOLVED, UNDONE } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What an `AudioView` plays on, and what it plays the sounds of. Each count rises at a moment worth a sound. */
export interface AudioViewBindings {
    /** The chip the sound effects play on. It is the view's output, so the view reads it once. */
    readonly sfx: SfxChip<'audio90'>;
    /** Edges the river was drawn across in the open puzzle. */
    readonly riverDrawn: () => number;
    /** Edges the river was rubbed out from in the open puzzle. */
    readonly riverCleared: () => number;
    /** Cells marked as meadow in the open puzzle. */
    readonly meadowsMarked: () => number;
    /** Meadow marks taken off in the open puzzle. */
    readonly meadowsCleared: () => number;
    /** Marks that made more cells break a rule, in the open puzzle. */
    readonly clashesMade: () => number;
    /** Strokes undone in the open puzzle. */
    readonly undosDone: () => number;
    /** Where across the valley the last mark was, from -1 at the left edge to 1 at the right, which its sound is panned to. */
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
 * Plays the game's sounds, the sounds of a valley in spring, on the Audio90.
 * Drawing the river bubbles, planting a flower chirps like a bird, and
 * taking off river or a flower rustles like grass. A mark that breaks a rule
 * plunks low, twice, like pebbles into deep water, in place of its own
 * sound. Undo is a bubble going back down. A solved puzzle ripples with
 * bells, like a stream running to the sea, and a bird sings. When the puzzle
 * shown changes, its counts replace the last puzzle's, and on that tick the
 * view stays silent for them.
 */
export function AudioView(bindings: AudioViewBindings): Container {
    const { sfx } = bindings;
    const view = new Container();
    view.label = 'river-audio';
    const watcher = watch({
        drawn: bindings.riverDrawn,
        rubbed: bindings.riverCleared,
        planted: bindings.meadowsMarked,
        unplanted: bindings.meadowsCleared,
        clashes: bindings.clashesMade,
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
            else if (w.drawn.increased) sfx.play(BUBBLED, { pan });
            else if (w.planted.increased) sfx.play(CHIRPED, { pan });
            else if (w.rubbed.increased || w.unplanted.increased) sfx.play(RUSTLED, { pan });
            if (w.undos.increased) sfx.play(UNDONE);
        }
        if (w.solved.increased) {
            sfx.play(SOLVED);
            sfx.play(SANG);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How wide the marks' sounds spread across the stereo field. */
const PAN_SPREAD = 0.5;

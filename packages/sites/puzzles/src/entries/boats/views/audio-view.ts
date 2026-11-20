import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { SfxChip } from '@mvtjs/site-kit/sound';
import { watch } from '@mvtjs/utils';
import { CALLED, CLASHED, MOORED, RUBBED, SOLVED, TOOTED, UNDONE, WATERED } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What an `AudioView` plays on, and what it plays the sounds of. Each count rises at a moment worth a sound. */
export interface AudioViewBindings {
    /** The chip the sound effects play on. It is the view's output, so the view reads it once. */
    readonly sfx: SfxChip<'audio90'>;
    /** Boat cells marked in the open puzzle. */
    readonly boatsMarked: () => number;
    /** Water cells marked in the open puzzle. */
    readonly waterMarked: () => number;
    /** Marks taken off in the open puzzle. */
    readonly marksCleared: () => number;
    /** Marks that made more boats break a rule, in the open puzzle. */
    readonly clashesMade: () => number;
    /** Strokes that finished a boat, in the open puzzle. */
    readonly boatsFinished: () => number;
    /** Strokes undone in the open puzzle. */
    readonly undosDone: () => number;
    /** Where across the harbour the last mark was, from -1 at the left edge to 1 at the right, which its sound is panned to. */
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
 * Plays the game's sounds, the sounds of a harbour, on the Audio90. Water
 * laps, and part of a boat knocks like a hull on a jetty. A boat finished
 * toots a little ship's horn twice, in place of its knock, and a mark taken
 * off is a wave drawing back. A boat that breaks a rule bumps low, twice,
 * like hulls knocking together, in place of its own sound. Undo drops back
 * into the water. A solved puzzle rings the harbour's bell, and a gull
 * calls. A drag that marks many cells in a tick plays one sound.
 * When the puzzle shown changes, its counts replace the last puzzle's, and
 * on that tick the view stays silent for them.
 */
export function AudioView(bindings: AudioViewBindings): Container {
    const { sfx } = bindings;
    const view = new Container();
    view.label = 'boats-audio';
    const watcher = watch({
        boats: bindings.boatsMarked,
        water: bindings.waterMarked,
        cleared: bindings.marksCleared,
        clashes: bindings.clashesMade,
        finished: bindings.boatsFinished,
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
            else if (w.finished.increased) sfx.play(TOOTED, { pan });
            else if (w.boats.increased) sfx.play(MOORED, { pan });
            else if (w.water.increased) sfx.play(WATERED, { pan });
            else if (w.cleared.increased) sfx.play(RUBBED, { pan });
            if (w.undos.increased) sfx.play(UNDONE);
        }
        if (w.solved.increased) {
            sfx.play(SOLVED);
            sfx.play(CALLED);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How wide the marks' sounds spread across the stereo field. */
const PAN_SPREAD = 0.5;

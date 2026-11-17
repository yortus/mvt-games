import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { SfxChip } from '@mvtjs/site-kit/sound';
import { watch } from '@mvtjs/utils';
import { CLASHED, DOTTED, GROUPED, RUBBED, SOLVED, STARRED, UNDONE } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What an `AudioView` plays on, and what it plays the sounds of. Each count rises at a moment worth a sound. */
export interface AudioViewBindings {
    /** The chip the sound effects play on. It is the view's output, so the view reads it once. */
    readonly sfx: SfxChip<'audio90'>;
    /** Stars placed, dots marked, marks taken off, stars that broke a rule, groups ringed and taken off, and actions undone, in the open puzzle. */
    readonly starsPlaced: () => number;
    readonly dotsMarked: () => number;
    readonly marksCleared: () => number;
    readonly clashesMade: () => number;
    readonly groupsNoted: () => number;
    readonly groupsCleared: () => number;
    readonly undosDone: () => number;
    /** Where across the grid the last mark was, from -1 at the left edge to 1 at the right, which its sound is panned to. */
    readonly markPan: () => number;
    /** Puzzles solved on this visit. */
    readonly puzzlesSolved: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Plays the game's sounds, on the Audio90. Each dot ticks, and a star
 * twinkles. A ring drawn round a group sweeps up, and a mark or a ring
 * taken off brushes. A star that breaks a rule knocks low, twice, in place
 * of its own sound. Undo blips, and a solved puzzle chimes.
 */
export function AudioView(bindings: AudioViewBindings): Container {
    const { sfx } = bindings;
    const view = new Container();
    view.label = 'stars-audio';
    const watcher = watch({
        stars: bindings.starsPlaced,
        dots: bindings.dotsMarked,
        cleared: bindings.marksCleared,
        clashes: bindings.clashesMade,
        grouped: bindings.groupsNoted,
        ungrouped: bindings.groupsCleared,
        undos: bindings.undosDone,
        solved: bindings.puzzlesSolved,
    });
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const w = watcher.poll();
        const pan = bindings.markPan() * PAN_SPREAD;
        if (w.clashes.increased) sfx.play(CLASHED, { pan });
        else if (w.stars.increased) sfx.play(STARRED, { pan });
        else if (w.dots.increased) sfx.play(DOTTED, { pan });
        else if (w.grouped.increased) sfx.play(GROUPED, { pan });
        else if (w.cleared.increased || w.ungrouped.increased) sfx.play(RUBBED, { pan });
        if (w.undos.increased) sfx.play(UNDONE);
        if (w.solved.increased) sfx.play(SOLVED);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How wide the marks' sounds spread across the stereo field. */
const PAN_SPREAD = 0.5;

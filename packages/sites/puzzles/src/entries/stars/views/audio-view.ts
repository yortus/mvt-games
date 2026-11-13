import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { SfxChip } from '@mvtjs/site-kit/sound';
import { watch } from '@mvtjs/utils';
import { CLASHED, DOTTED, RUBBED, SOLVED, STARRED, UNDONE } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What an `AudioView` plays on, and what it plays the sounds of. Each count rises at a moment worth a sound. */
export interface AudioViewBindings {
    /** The chip the sound effects play on. It is the view's output, so the view reads it once. */
    readonly sfx: SfxChip<'audio90'>;
    /** Stars placed, dots marked, marks taken off, stars that broke a rule, and actions undone, in the open puzzle. */
    readonly starsPlaced: () => number;
    readonly dotsMarked: () => number;
    readonly marksCleared: () => number;
    readonly clashesMade: () => number;
    readonly undosDone: () => number;
    /** Dots marked in the stroke being made, which set its next tick's note. */
    readonly strokeDots: () => number;
    /** Where across the grid the last mark was, from -1 at the left edge to 1 at the right, which its sound is panned to. */
    readonly markPan: () => number;
    /** Puzzles solved on this visit. */
    readonly puzzlesSolved: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Plays the game's sounds, on the Audio90. Each dot ticks, a step up a
 * pentatonic scale from the last in its stroke, so a long drag climbs. A
 * star twinkles, a mark taken off brushes, and a star that breaks a rule
 * knocks low, twice, in place of its own sound. Undo blips, and a solved
 * puzzle chimes. A fast drag can make several marks in a frame, and the
 * frame plays one sound for them.
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
        else if (w.dots.increased) sfx.play(DOTTED, { note: DOT_ROOT + toPentatonic(bindings.strokeDots() - 1), pan });
        else if (w.cleared.increased) sfx.play(RUBBED, { pan });
        if (w.undos.increased) sfx.play(UNDONE);
        if (w.solved.increased) sfx.play(SOLVED);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The note a stroke's first dot plays at: G-4. */
const DOT_ROOT = 67;

/** A major pentatonic scale, in semitones up from the root, over two octaves. A longer stroke stays at the top. */
const PENTATONIC: readonly number[] = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

function toPentatonic(step: number): number {
    return PENTATONIC[Math.max(0, Math.min(step, PENTATONIC.length - 1))];
}

/** How wide the marks' sounds spread across the stereo field. */
const PAN_SPREAD = 0.5;

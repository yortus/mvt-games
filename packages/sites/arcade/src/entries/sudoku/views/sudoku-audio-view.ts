import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { watch } from '@mvtjs/utils';
import type { SfxChip } from '#shared';
import { CLASHED, OPENED, PLACED, SOLVED, UNDONE } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What a `SudokuAudioView` plays on, and what it plays the sounds of. Each count rises at a moment worth a sound. */
export interface SudokuAudioViewBindings {
    /** The chip the sound effects play on. It is the view's output, so the view reads it once. */
    readonly sfx: SfxChip<'audio90'>;
    /** The cell a number is being chosen for, or -1. The picker ticks as it opens. */
    readonly pickerCell: () => number;
    /** Digits filled in, and those that broke a rule as they went in, in the open puzzle. */
    readonly answersPlaced: () => number;
    readonly clashesMade: () => number;
    /** The cell filled in last, and its digit, which the digit's knock plays at. */
    readonly filledCell: () => number;
    readonly filledDigit: () => number;
    /** Actions undone in the open puzzle. */
    readonly undosDone: () => number;
    /** Puzzles solved on this visit. */
    readonly puzzlesSolved: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Plays the game's sounds, on the Audio90. The picker ticks as it opens.
 * Each digit filled in knocks at its own note on a pentatonic scale, from
 * where its cell is across the grid, and one that breaks a rule knocks low,
 * twice. Undo blips, and a solved puzzle chimes. Notes are silent, as a
 * pencil is. A double tap on a digit's key takes back what its first tap
 * made, and that undo is not heard.
 */
export function SudokuAudioView(bindings: SudokuAudioViewBindings): Container {
    const { sfx } = bindings;
    const view = new Container();
    view.label = 'sudoku-audio';
    const watcher = watch({
        pickerCell: bindings.pickerCell,
        placed: bindings.answersPlaced,
        clashes: bindings.clashesMade,
        undos: bindings.undosDone,
        solved: bindings.puzzlesSolved,
    });

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const w = watcher.poll();
        const isPickerOpened = w.pickerCell.changed && w.pickerCell.current >= 0;
        if (isPickerOpened) sfx.play(OPENED, { pan: toPan(w.pickerCell.current) });
        if (w.clashes.increased) sfx.play(CLASHED, { pan: toPan(bindings.filledCell()) });
        else if (w.placed.increased) sfx.play(PLACED, { note: PLACED_ROOT + toPentatonic(bindings.filledDigit()), pan: toPan(bindings.filledCell()) });
        if (w.undos.increased && !isPickerOpened && !w.placed.increased && !w.clashes.increased) sfx.play(UNDONE);
        if (w.solved.increased) sfx.play(SOLVED);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The note a digit's knock is played up from: C-5. */
const PLACED_ROOT = 72;

/** Each digit's place on a major pentatonic scale, in semitones up from the root. */
const PENTATONIC: readonly number[] = [0, 0, 2, 4, 7, 9, 12, 14, 16, 19];

function toPentatonic(digit: number): number {
    return PENTATONIC[digit] ?? 0;
}

/** Where a cell's sound comes from, across the stereo field, by its column. */
function toPan(cell: number): number {
    return cell < 0 ? 0 : ((cell % 9) / 8 * 2 - 1) * 0.5;
}

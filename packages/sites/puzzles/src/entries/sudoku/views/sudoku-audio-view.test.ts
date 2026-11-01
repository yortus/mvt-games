import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshView, updateView } from '@mvtjs/pixi';
import type { Audio90PlayOptions } from 'audio90';
import { createHeadlessAudio90, type HeadlessAudio90 } from 'audio90/headless';
import { CLASHED, OPENED, PLACED, SOLVED, UNDONE } from '../data';
import { SudokuAudioView } from './sudoku-audio-view';

// The view is tested by what it asks of its chip: which sounds it plays, at which notes, and where.

const TICK_MS = 1000 / 60;

afterEach(() => {
    vi.restoreAllMocks();
});

describe('SudokuAudioView', () => {
    it('plays nothing as it is made', () => {
        const { sfx } = setUp({ answersPlaced: 3, puzzlesSolved: 1 });
        expect(listPlayed(sfx)).toEqual([]);
    });

    it('ticks as the picker opens, but not as it closes', () => {
        const { sfx, state, tick } = setUp();
        state.pickerCell = 40;
        tick();
        state.pickerCell = -1;
        tick();
        expect(listPlayed(sfx)).toEqual([OPENED]);
    });

    it('knocks each digit filled in at its own note, higher for a higher digit, from its cell\'s side', () => {
        const { sfx, state, tick } = setUp();
        state.answersPlaced = 1;
        state.filledCell = 0;
        state.filledDigit = 2;
        tick();
        state.answersPlaced = 2;
        state.filledCell = 8;
        state.filledDigit = 7;
        tick();
        const [low, high] = listPlayOptions(sfx);
        expect(listPlayed(sfx)).toEqual([PLACED, PLACED]);
        expect(Number(high?.note)).toBeGreaterThan(Number(low?.note));
        expect(low?.pan).toBeLessThan(0);
        expect(high?.pan).toBeGreaterThan(0);
    });

    it('knocks low, in place of the digit\'s note, for a digit that breaks a rule', () => {
        const { sfx, state, tick } = setUp();
        state.answersPlaced = 1;
        state.clashesMade = 1;
        tick();
        expect(listPlayed(sfx)).toEqual([CLASHED]);
    });

    it('blips for an undo, unless it took back the first tap of a double tap that opened the picker or filled a cell', () => {
        const { sfx, state, tick } = setUp();
        state.undosDone = 1;
        tick();
        state.undosDone = 2;
        state.pickerCell = 10;
        tick();
        state.pickerCell = -1;
        state.undosDone = 3;
        state.answersPlaced = 1;
        tick();
        expect(listPlayed(sfx)).toEqual([UNDONE, OPENED, PLACED]);
    });

    it('chimes as a puzzle is solved', () => {
        const { sfx, state, tick } = setUp();
        state.puzzlesSolved = 1;
        tick();
        expect(listPlayed(sfx)).toEqual([SOLVED]);
    });
});

interface State {
    pickerCell: number;
    answersPlaced: number;
    clashesMade: number;
    filledCell: number;
    filledDigit: number;
    undosDone: number;
    puzzlesSolved: number;
}

function setUp(initial: Partial<State> = {}) {
    const state: State = {
        pickerCell: -1, answersPlaced: 0, clashesMade: 0, filledCell: -1, filledDigit: 0, undosDone: 0, puzzlesSolved: 0, ...initial,
    };
    const sfx = createSpiedChip();
    const view = SudokuAudioView({
        sfx,
        pickerCell: () => state.pickerCell,
        answersPlaced: () => state.answersPlaced,
        clashesMade: () => state.clashesMade,
        filledCell: () => state.filledCell,
        filledDigit: () => state.filledDigit,
        undosDone: () => state.undosDone,
        puzzlesSolved: () => state.puzzlesSolved,
    });
    // One tick as the Arcade runs it: the chip's clock, then the view's update and refresh
    const tick = (): void => {
        sfx.update(TICK_MS);
        updateView(view, TICK_MS);
        refreshView(view);
    };
    tick();
    return { sfx, state, tick };
}

/** Creates a headless chip whose `play` is spied on, so a test can read what the view asked of it. */
function createSpiedChip(): HeadlessAudio90 {
    const chip = createHeadlessAudio90();
    vi.spyOn(chip, 'play');
    return chip;
}

/** The sounds played on `chip`, oldest first. */
function listPlayed(chip: HeadlessAudio90): unknown[] {
    return vi.mocked(chip.play).mock.calls.map((call) => call[0]);
}

/** The options each play on `chip` was given, oldest first. */
function listPlayOptions(chip: HeadlessAudio90): (Audio90PlayOptions | undefined)[] {
    // `play` is overloaded, and the mock's calls are typed by its last form, a song's, which takes no options
    const calls = vi.mocked(chip.play).mock.calls as unknown as readonly [unknown, Audio90PlayOptions?][];
    return calls.map((call) => call[1]);
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshView, updateView } from '@mvtjs/pixi';
import type { Audio90PlayOptions } from 'audio90';
import { createHeadlessAudio90, type HeadlessAudio90 } from 'audio90/headless';
import { CLASHED, RUBBED, SOLVED, STEPPED, UNDONE, WALLED } from '../data';
import { AudioView } from './audio-view';

// The view is tested by what it asks of its chip: which sounds it plays, at which notes, and where.

const TICK_MS = 1000 / 60;

afterEach(() => {
    vi.restoreAllMocks();
});

describe('AudioView', () => {
    it('plays nothing as it is made', () => {
        const { sfx } = setUp({ passagesMarked: 3, puzzlesSolved: 1 });
        expect(listPlayed(sfx)).toEqual([]);
    });

    it('ticks each passage a step higher than the last in its stroke, and starts low again with the next stroke', () => {
        const { sfx, state, tick } = setUp();
        for (let i = 1; i <= 3; i++) {
            state.passagesMarked = i;
            state.strokePassages = i;
            tick();
        }
        state.passagesMarked = 4;
        state.strokePassages = 1;
        tick();
        const notes = listPlayOptions(sfx).map((options) => Number(options?.note));
        expect(listPlayed(sfx)).toEqual([STEPPED, STEPPED, STEPPED, STEPPED]);
        expect(notes[1]).toBeGreaterThan(notes[0]);
        expect(notes[2]).toBeGreaterThan(notes[1]);
        expect(notes[3]).toBe(notes[0]);
    });

    it('knocks for a wall and brushes for a mark rubbed out, from the side of the maze the mark is on', () => {
        const { sfx, state, tick } = setUp();
        state.wallsMarked = 1;
        state.markPan = -1;
        tick();
        state.marksCleared = 1;
        state.markPan = 1;
        tick();
        const [left, right] = listPlayOptions(sfx);
        expect(listPlayed(sfx)).toEqual([WALLED, RUBBED]);
        expect(left?.pan).toBeLessThan(0);
        expect(right?.pan).toBeGreaterThan(0);
    });

    it('knocks low, in place of the mark\'s own sound, for a mark that breaks a rule', () => {
        const { sfx, state, tick } = setUp();
        state.passagesMarked = 1;
        state.clashesMade = 1;
        tick();
        expect(listPlayed(sfx)).toEqual([CLASHED]);
    });

    it('blips for an undo, and chimes as a maze is solved', () => {
        const { sfx, state, tick } = setUp();
        state.undosDone = 1;
        tick();
        state.puzzlesSolved = 1;
        tick();
        expect(listPlayed(sfx)).toEqual([UNDONE, SOLVED]);
    });
});

interface State {
    passagesMarked: number;
    wallsMarked: number;
    marksCleared: number;
    clashesMade: number;
    undosDone: number;
    strokePassages: number;
    markPan: number;
    puzzlesSolved: number;
}

function setUp(initial: Partial<State> = {}) {
    const state: State = {
        passagesMarked: 0, wallsMarked: 0, marksCleared: 0, clashesMade: 0, undosDone: 0, strokePassages: 0, markPan: 0, puzzlesSolved: 0, ...initial,
    };
    const sfx = createSpiedChip();
    const view = AudioView({
        sfx,
        passagesMarked: () => state.passagesMarked,
        wallsMarked: () => state.wallsMarked,
        marksCleared: () => state.marksCleared,
        clashesMade: () => state.clashesMade,
        undosDone: () => state.undosDone,
        strokePassages: () => state.strokePassages,
        markPan: () => state.markPan,
        puzzlesSolved: () => state.puzzlesSolved,
    });
    // One tick as the page runs it: the chip's clock, then the view's update and refresh
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

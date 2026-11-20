import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshView, updateView } from '@mvtjs/pixi';
import { createHeadlessAudio90, type HeadlessAudio90 } from 'audio90/headless';
import { SOLVED } from '../data';
import { AudioView } from './audio-view';

// The view is tested by what it asks of its chip: which sounds it plays.

const TICK_MS = 1000 / 60;

afterEach(() => {
    vi.restoreAllMocks();
});

describe('AudioView', () => {
    it('stays silent as the puzzle shown changes and its counts jump, but still chimes a puzzle solved', () => {
        const { sfx, state, tick } = setUp({ starsPlaced: 1, crossesMarked: 1, undosDone: 1 });
        // The walkthrough ends, and the puzzle open shows again, with its own, higher counts
        state.starsPlaced = 5;
        state.crossesMarked = 9;
        state.undosDone = 3;
        state.puzzlesOpened = 1;
        state.puzzlesSolved = 1;
        tick();
        expect(listPlayed(sfx)).toEqual([SOLVED]);
    });
});

interface State {
    starsPlaced: number;
    crossesMarked: number;
    marksCleared: number;
    clashesMade: number;
    groupsNoted: number;
    groupsCleared: number;
    undosDone: number;
    puzzlesOpened: number;
    puzzlesSolved: number;
}

function setUp(initial: Partial<State> = {}) {
    const state: State = {
        starsPlaced: 0, crossesMarked: 0, marksCleared: 0, clashesMade: 0, groupsNoted: 0, groupsCleared: 0, undosDone: 0, puzzlesOpened: 0,
        puzzlesSolved: 0, ...initial,
    };
    const sfx = createSpiedChip();
    const view = AudioView({
        sfx,
        starsPlaced: () => state.starsPlaced,
        crossesMarked: () => state.crossesMarked,
        marksCleared: () => state.marksCleared,
        clashesMade: () => state.clashesMade,
        groupsNoted: () => state.groupsNoted,
        groupsCleared: () => state.groupsCleared,
        undosDone: () => state.undosDone,
        markPan: () => 0,
        puzzlesOpened: () => state.puzzlesOpened,
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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshView, updateView } from '@mvtjs/pixi';
import type { Audio90PlayOptions, Audio90Sound } from 'audio90';
import { createHeadlessAudio90, type HeadlessAudio90 } from 'audio90/headless';
import {
    CHOSEN, DEAD_END, DUG, FILLED, FINISHED, GAVE_UP, HELD, MARKED, NEEDED, PLACED, RUBBED_OUT, SEED, SHUFFLE, STUCK, TRIED, TRY,
} from '../data';
import type { CellEvent, DiggerPhase } from '../models';
import { DiggerAudioView } from './digger-audio-view';

// The view is tested by what it asks of its chip: which sounds it plays, at which notes, and where.

const TICK_MS = 1000 / 60;

afterEach(() => {
    vi.restoreAllMocks();
});

describe('DiggerAudioView', () => {
    it('plays nothing as it is made', () => {
        const { sfx } = setUp();
        expect(listPlayed(sfx)).toEqual([]);
    });

    it('tocks for each puzzle tried, and chimes instead for the one chosen', () => {
        const { sfx, state, tick } = setUp({ phase: 'trying' });
        state.gridsTried = 1;
        tick();
        state.gridsTried = 2;
        state.isGridChosen = true;
        tick();
        expect(listPlayed(sfx)).toEqual([TRIED, CHOSEN]);
    });

    it('rings each seed at its digit\'s note, where its cell is', () => {
        const { sfx, state, tick } = setUp();
        state.seedsPlaced = 1;
        state.seedCell = 8;
        state.seedDigit = 1;
        tick();
        state.seedsPlaced = 2;
        state.seedCell = 0;
        state.seedDigit = 4;
        tick();
        const plays = listPlayOptionsOf(sfx, SEED);
        expect(plays).toHaveLength(2);
        // The 4th note of the scale is a fifth above the 1st, and the right edge is panned right of the left
        expect(Number(plays[1]?.note) - Number(plays[0]?.note)).toBe(7);
        expect(plays[0]?.pan).toBeGreaterThan(0);
        expect(plays[1]?.pan).toBeLessThan(0);
    });

    it('blips the search\'s tries no more than a few times a second, however many it makes', () => {
        const { sfx, state, tick } = setUp();
        for (let i = 0; i < 60; i++) {
            state.searchTries += 50;
            tick();
        }
        const blips = listPlayedOf(sfx, TRY).length;
        expect(blips).toBeGreaterThan(5);
        expect(blips).toBeLessThan(25);
    });

    it('thumps at the search\'s dead ends, fewer times than it blips', () => {
        const { sfx, state, tick } = setUp();
        for (let i = 0; i < 60; i++) {
            state.searchTries++;
            state.searchRetreats++;
            tick();
        }
        expect(listPlayedOf(sfx, DEAD_END).length).toBeGreaterThan(2);
        expect(listPlayedOf(sfx, DEAD_END).length).toBeLessThan(listPlayedOf(sfx, TRY).length);
    });

    it('sweeps down as the search gives up, and rises as the grid is full', () => {
        const { sfx, state, tick } = setUp({ phase: 'filling' });
        state.restarts = 1;
        tick();
        state.phase = 'digging';
        tick();
        expect(listPlayed(sfx)).toEqual([GAVE_UP, FILLED]);
    });

    it('chimes a dug cell at its digit\'s note, knocks for a needed cell, and ticks for a held one', () => {
        const { sfx, state, tick } = setUp({ phase: 'digging' });
        state.cellsDug = 1;
        state.dugDigit = 9;
        tick();
        state.cellsNeeded = 1;
        tick();
        state.cellsHeld = 1;
        tick();
        expect(listPlayed(sfx)).toEqual([DUG, NEEDED, HELD]);
        expect(listPlayOptionsOf(sfx, DUG)[0]?.note).toBe(84 + 19);
    });

    it('brushes out each rival digit that leads nowhere, but not the last, as the cell is dug with a chime', () => {
        const { sfx, state, tick } = setUp({ phase: 'digging' });
        state.testsFailed = 1;
        tick();
        state.testsFailed = 2;
        state.cellsDug = 1;
        tick();
        expect(listPlayed(sfx)).toEqual([RUBBED_OUT, DUG]);
    });

    it('breathes with each shuffle, and shimmers as the pencil marks go in', () => {
        const { sfx, state, tick } = setUp({ phase: 'shuffling' });
        state.shufflesDone = 1;
        tick();
        state.phase = 'grading';
        tick();
        expect(listPlayed(sfx)).toEqual([SHUFFLE, MARKED]);
    });

    it('plays a note for each digit reasoned out, a brush for marks rubbed out, a warning when stuck, and a flourish when done', () => {
        const { sfx, state, tick } = setUp({ phase: 'grading' });
        state.logicPlacements = 1;
        tick();
        state.logicReductions = 1;
        tick();
        state.needsGuessing = true;
        tick();
        state.puzzlesFinished = 1;
        tick();
        expect(listPlayed(sfx)).toEqual([PLACED, RUBBED_OUT, STUCK, FINISHED]);
    });

    it('plays nothing as a new puzzle sets the counts back to nothing', () => {
        const { sfx, state, tick } = setUp({
            phase: 'finished', seedsPlaced: 11, cellsDug: 40, logicPlacements: 40, shufflesDone: 4, gridsTried: 9, isGridChosen: true,
        });
        Object.assign(state, { phase: 'trying', seedsPlaced: 0, cellsDug: 0, logicPlacements: 0, shufflesDone: 0, gridsTried: 0, isGridChosen: false });
        tick();
        expect(listPlayed(sfx)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface State {
    phase: DiggerPhase;
    seedsPlaced: number;
    seedCell: number;
    seedDigit: number;
    searchTries: number;
    searchRetreats: number;
    searchCell: number;
    searchDigit: number;
    restarts: number;
    cellsDug: number;
    dugCell: number;
    dugDigit: number;
    cellsNeeded: number;
    testsFailed: number;
    cellsHeld: number;
    focusCell: number;
    shufflesDone: number;
    logicPlacements: number;
    placedCell: number;
    placedDigit: number;
    logicReductions: number;
    needsGuessing: boolean;
    puzzlesFinished: number;
    gridsTried: number;
    isGridChosen: boolean;
}

function setUp(initial: Partial<State> = {}) {
    const state: State = {
        phase: 'seeding', seedsPlaced: 0, seedCell: 0, seedDigit: 1, searchTries: 0, searchRetreats: 0, searchCell: 0,
        searchDigit: 1, restarts: 0, cellsDug: 0, dugCell: 0, dugDigit: 1, cellsNeeded: 0, testsFailed: 0, cellsHeld: 0, focusCell: 0,
        shufflesDone: 0, logicPlacements: 0, placedCell: 0, placedDigit: 1, logicReductions: 0, needsGuessing: false,
        puzzlesFinished: 0, gridsTried: 0, isGridChosen: false, ...initial,
    };
    const sfx = createSpiedChip();
    const view = DiggerAudioView({
        sfx,
        phase: () => state.phase,
        seeds: readEvent(() => state.seedsPlaced, () => state.seedCell, () => state.seedDigit),
        tries: readEvent(() => state.searchTries, () => state.searchCell, () => state.searchDigit),
        retreats: readEvent(() => state.searchRetreats, () => state.searchCell, () => state.searchDigit),
        restarts: () => state.restarts,
        dug: readEvent(() => state.cellsDug, () => state.dugCell, () => state.dugDigit),
        needed: readEvent(() => state.cellsNeeded, () => state.focusCell, () => 0),
        failedTests: readEvent(() => state.testsFailed, () => state.focusCell, () => 0),
        held: readEvent(() => state.cellsHeld, () => state.focusCell, () => 0),
        shufflesDone: () => state.shufflesDone,
        placements: readEvent(() => state.logicPlacements, () => state.placedCell, () => state.placedDigit),
        logicReductions: () => state.logicReductions,
        needsGuessing: () => state.needsGuessing,
        puzzlesFinished: () => state.puzzlesFinished,
        gridsTried: () => state.gridsTried,
        isGridChosen: () => state.isGridChosen,
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

/** A `CellEvent` that reads the test's state, so a test can raise its count by changing the state. */
function readEvent(count: () => number, cell: () => number, digit: () => number): CellEvent {
    return {
        get count() { return count(); },
        get cell() { return cell(); },
        get digit() { return digit(); },
    };
}

/** Creates a headless chip whose `play` and `stop` are spied on, so a test can read what the view asked of it. */
function createSpiedChip(): HeadlessAudio90 {
    const chip = createHeadlessAudio90();
    vi.spyOn(chip, 'play');
    vi.spyOn(chip, 'stop');
    return chip;
}

/** The sounds played on `chip`, oldest first. */
function listPlayed(chip: HeadlessAudio90): unknown[] {
    return vi.mocked(chip.play).mock.calls.map((call) => call[0]);
}

/** Each play of `sound` on `chip`. */
function listPlayedOf(chip: HeadlessAudio90, sound: Audio90Sound): unknown[] {
    return listPlayed(chip).filter((played) => played === sound);
}

/** The options each play of `sound` on `chip` was given, oldest first. */
function listPlayOptionsOf(chip: HeadlessAudio90, sound: Audio90Sound): (Audio90PlayOptions | undefined)[] {
    // `play` is overloaded, and the mock's calls are typed by its last form, a song's, which takes no options
    const calls = vi.mocked(chip.play).mock.calls as unknown as readonly [unknown, Audio90PlayOptions?][];
    return calls.filter((call) => call[0] === sound).map((call) => call[1]);
}

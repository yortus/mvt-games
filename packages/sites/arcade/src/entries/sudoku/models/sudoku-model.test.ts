import { describe, expect, it } from 'vitest';
import { createMemoryStore, type LocalStore } from '../../../storage';
import { LEVELS, loadSudokuGenerator } from '#sudoku-digger';
import { CALENDAR_SLOTS } from '../data';
import { toDayNumber } from './day-numbers';
import { FIRST_DAY, STARTING_LEVEL } from './model-constants';
import type { PuzzleModel } from './puzzle-model';
import { createSudokuModel } from './sudoku-model';
import { createSudokuRecords } from './sudoku-records';

// Today is Friday 30 October 2026 in every test, unless a test says otherwise.

const TODAY = toDayNumber({ year: 2026, month: 10, day: 30 });
const generate = await loadSudokuGenerator();

describe('SudokuModel', () => {
    it('starts on the calendar at this month, with October 2026 laid out from Monday the 28th of September', () => {
        const model = createSudokuModel({ today: TODAY, store: createMemoryStore(), generate, offersTutorial: false });
        expect(model.phase).toBe('calendar');
        expect([model.shownYear, model.shownMonth]).toEqual([2026, 10]);
        expect(model.level).toBe(STARTING_LEVEL);
        // October 2026 starts on a Thursday, the fourth slot
        expect(model.dayInSlot(2)).toBe(-1);
        expect(model.dayInSlot(3)).toBe(toDayNumber({ year: 2026, month: 10, day: 1 }));
        expect(model.dayInSlot(3 + 30)).toBe(toDayNumber({ year: 2026, month: 10, day: 31 }));
        expect(model.dayInSlot(3 + 31)).toBe(-1);
        expect(model.dayInSlot(CALENDAR_SLOTS - 1)).toBe(-1);
    });

    it('goes back no earlier than the first day\'s month, and on no later than this month', () => {
        const model = createSudokuModel({ today: TODAY, store: createMemoryStore(), generate, offersTutorial: false });
        expect(model.canShowLaterMonth).toBe(false);
        model.showLaterMonth();
        expect(model.shownMonth).toBe(10);
        for (let i = 0; i < 20; i++) model.showEarlierMonth();
        expect([model.shownYear, model.shownMonth]).toEqual([2026, 1]);
        expect(model.canShowEarlierMonth).toBe(false);
        model.showLaterMonth();
        expect(model.shownMonth).toBe(2);
    });

    it('crosses into a new year, a month at a time', () => {
        const today = toDayNumber({ year: 2027, month: 1, day: 3 });
        const model = createSudokuModel({ today, store: createMemoryStore(), generate, offersTutorial: false });
        model.showEarlierMonth();
        expect([model.shownYear, model.shownMonth]).toEqual([2026, 12]);
        model.showLaterMonth();
        expect([model.shownYear, model.shownMonth]).toEqual([2027, 1]);
    });

    it('opens the puzzles from the first day to today, but none from before or after', () => {
        const model = createSudokuModel({ today: TODAY, store: createMemoryStore(), generate, offersTutorial: false });
        for (const day of [FIRST_DAY - 1, TODAY + 1]) {
            expect(model.isPlayable(day)).toBe(false);
            model.openPuzzle(day);
            expect(model.phase).toBe('calendar');
        }
        for (const day of [FIRST_DAY, TODAY]) {
            expect(model.isPlayable(day)).toBe(true);
            model.openPuzzle(day);
            expect(model.phase).toBe('playing');
            expect(model.puzzleDay).toBe(day);
            model.closePuzzle();
        }
    });

    it('gives every player the same puzzle for a day and level, and a different one for each level and day', () => {
        const givensOf = (day: number, level: (typeof LEVELS)[number]): string => {
            const model = createSudokuModel({ today: TODAY, store: createMemoryStore(), generate, offersTutorial: false });
            model.chooseLevel(level);
            model.openPuzzle(day);
            return listDigits(model.puzzle);
        };
        expect(givensOf(TODAY, 'easy')).toBe(givensOf(TODAY, 'easy'));
        expect(givensOf(TODAY, 'easy')).not.toBe(givensOf(TODAY, 'medium'));
        expect(givensOf(TODAY, 'easy')).not.toBe(givensOf(TODAY - 1, 'easy'));
    });

    it('keeps a puzzle\'s progress, for the next visit', () => {
        const store = createMemoryStore();
        const model = createSudokuModel({ today: TODAY, store, generate, offersTutorial: false });
        model.openPuzzle(TODAY - 3);
        const puzzle = openedPuzzle(model.puzzle);
        const cell = findEmptyCell(puzzle);
        puzzle.select([cell]);
        puzzle.toggleNote(4);
        model.update(16);
        expect(model.isStarted(TODAY - 3)).toBe(true);
        expect(model.isSolved(TODAY - 3)).toBe(false);

        const next = createSudokuModel({ today: TODAY + 1, store, generate, offersTutorial: false });
        expect(next.isStarted(TODAY - 3)).toBe(true);
        next.openPuzzle(TODAY - 3);
        expect(openedPuzzle(next.puzzle).marksAt(cell)).toBe(1 << 4);
    });

    it('ticks off a puzzle once it is solved, at its level only, and remembers it', () => {
        const store = createMemoryStore();
        const model = createSudokuModel({ today: TODAY, store, generate, offersTutorial: false });
        model.chooseLevel('medium');
        model.openPuzzle(TODAY);
        solve(model);
        model.update(16);
        expect(model.puzzlesSolved).toBe(1);
        model.closePuzzle();
        expect(model.isSolved(TODAY)).toBe(true);
        expect(model.solvedCount).toBe(1);
        model.chooseLevel('hard');
        expect(model.isSolved(TODAY)).toBe(false);
        expect(model.solvedCount).toBe(0);

        const next = createSudokuModel({ today: TODAY, store, generate, offersTutorial: false });
        expect(next.level).toBe('hard');
        next.chooseLevel('medium');
        expect(next.isSolved(TODAY)).toBe(true);
        // Opened again, it is still solved, and is not counted again
        next.openPuzzle(TODAY);
        expect(next.puzzle?.isSolved).toBe(true);
        next.update(16);
        expect(next.puzzlesSolved).toBe(0);
    });

    it('chooses no level while a puzzle is being played', () => {
        const model = createSudokuModel({ today: TODAY, store: createMemoryStore(), generate, offersTutorial: false });
        model.openPuzzle(TODAY);
        model.chooseLevel('hardest');
        expect(model.level).toBe(STARTING_LEVEL);
    });
});

describe('the tutorial', () => {
    it('plays on a practice puzzle the first time a puzzle opens, and gives way to that puzzle as it ends', () => {
        const store = createMemoryStore();
        const model = createSudokuModel({ today: TODAY, store, generate, offersTutorial: true });
        model.openPuzzle(TODAY);
        expect(model.tutorial?.step).toBe('select');
        const practice = openedPuzzle(model.puzzle);
        model.endTutorial();
        expect(model.tutorial).toBeUndefined();
        const real = openedPuzzle(model.puzzle);
        expect(real).not.toBe(practice);
        expect(listDigits(real)).toBe(listDigits(openedPuzzle(openDay(TODAY))));

        // Seen once, it doesn't play by itself again, on this visit or the next
        model.closePuzzle();
        model.openPuzzle(TODAY - 1);
        expect(model.tutorial).toBeUndefined();
        const next = createSudokuModel({ today: TODAY, store, generate, offersTutorial: true });
        next.openPuzzle(TODAY);
        expect(next.tutorial).toBeUndefined();
    });

    it('plays again when asked, and keeps nothing done in the practice puzzle', () => {
        const store = createMemoryStore();
        const model = createSudokuModel({ today: TODAY, store, generate, offersTutorial: false });
        model.openPuzzle(TODAY);
        model.startTutorial();
        const practice = openedPuzzle(model.puzzle);
        const cell = findEmptyCell(practice);
        practice.select([cell]);
        practice.toggleNote(5);
        model.update(16);
        expect(model.isStarted(TODAY)).toBe(false);
        model.endTutorial();
        expect(openedPuzzle(model.puzzle).marksAt(cell)).toBe(0);
    });

    it('moves on a step as each is done, and ends as the puzzle closes', () => {
        const model = createSudokuModel({ today: TODAY, store: createMemoryStore(), generate, offersTutorial: true });
        model.openPuzzle(TODAY);
        const practice = openedPuzzle(model.puzzle);
        const steps: string[] = [];
        const step = (act: () => void): void => {
            act();
            model.update(16);
            steps.push(model.tutorial?.step ?? 'ended');
        };
        const pair = Array.from({ length: 81 }, (_, cell) => cell)
            .find((cell) => cell % 9 < 8 && practice.digitAt(cell) === 0 && practice.digitAt(cell + 1) === 0) ?? -1;
        step(() => practice.select([pair]));
        step(() => {
            practice.toggleNote(1);
            practice.toggleNote(2);
        });
        step(() => practice.select([pair, pair + 1]));
        step(() => {
            practice.toggleNote(3);
            practice.toggleNote(4);
        });
        step(() => practice.fillCell(pair, 3));
        step(() => undefined);
        expect(steps).toEqual(['mark', 'link', 'group', 'fill', 'done', 'done']);

        model.closePuzzle();
        expect(model.tutorial).toBeUndefined();
        expect(model.phase).toBe('calendar');
    });
});

describe('SudokuRecords', () => {
    it('keeps puzzles by date and level, in names a person can read', () => {
        const store = createMemoryStore();
        const records = createSudokuRecords({ store });
        records.markSolved(TODAY, 'hardest');
        expect(readIndex(store)).toEqual({ solved: ['2026-10-30/hardest'], started: [] });
    });

    it('skips names it cannot read, as an older version might have left', () => {
        const store = createMemoryStore();
        store.writeJson('mvt-arcade:sudoku:records', { solved: ['2026-10-30/hardest', 'yesterday', 3, '2026-10-29/fiendish'], started: 'all' });
        store.write('mvt-arcade:sudoku:level', 'fiendish');
        const records = createSudokuRecords({ store });
        expect(records.isSolved(TODAY, 'hardest')).toBe(true);
        expect(records.isStarted(TODAY, 'hardest')).toBe(true);
        expect(records.countSolved('hardest')).toBe(1);
        expect(records.chosenLevel).toBeUndefined();
    });
});

function openedPuzzle(puzzle: PuzzleModel | undefined): PuzzleModel {
    if (puzzle === undefined) throw new Error('No puzzle is open');
    return puzzle;
}

function listDigits(puzzle: PuzzleModel | undefined): string {
    const opened = openedPuzzle(puzzle);
    return Array.from({ length: 81 }, (_, cell) => opened.digitAt(cell)).join('');
}

/** Opens `day`'s puzzle in a game of its own, at the level the tests start on. */
function openDay(day: number): PuzzleModel | undefined {
    const model = createSudokuModel({ today: TODAY, store: createMemoryStore(), generate, offersTutorial: false });
    model.openPuzzle(day);
    return model.puzzle;
}

function findEmptyCell(puzzle: PuzzleModel): number {
    return Array.from({ length: 81 }, (_, cell) => cell).find((cell) => puzzle.digitAt(cell) === 0) ?? -1;
}

/** Solves the open puzzle: works out its one solution with a plain search, and fills it in, cell by cell. */
function solve(model: ReturnType<typeof createSudokuModel>): void {
    const puzzle = openedPuzzle(model.puzzle);
    const empty = Array.from({ length: 81 }, (_, cell) => cell).filter((cell) => puzzle.digitAt(cell) === 0);
    const solution = findSolution(Array.from({ length: 81 }, (_, cell) => puzzle.digitAt(cell)));
    for (const cell of empty) {
        puzzle.openPicker(cell);
        puzzle.fillIn(solution[cell]);
    }
}

function findSolution(grid: number[]): number[] {
    const cell = grid.indexOf(0);
    if (cell < 0) return grid;
    for (let digit = 1; digit <= 9; digit++) {
        if (!fits(grid, cell, digit)) continue;
        grid[cell] = digit;
        const solved = findSolution(grid);
        if (solved.indexOf(0) < 0) return solved;
        grid[cell] = 0;
    }
    return grid;
}

function fits(grid: number[], cell: number, digit: number): boolean {
    const row = Math.floor(cell / 9);
    const column = cell % 9;
    for (let i = 0; i < 9; i++) {
        if (grid[row * 9 + i] === digit || grid[i * 9 + column] === digit) return false;
        const boxCell = (Math.floor(row / 3) * 3 + Math.floor(i / 3)) * 9 + Math.floor(column / 3) * 3 + (i % 3);
        if (grid[boxCell] === digit) return false;
    }
    return true;
}

function readIndex(store: LocalStore): unknown {
    return store.readJson('mvt-arcade:sudoku:records');
}

import { describe, expect, it } from 'vitest';
import { createMemoryStore, type LocalStore } from '@mvtjs/site-kit/storage';
import { PUZZLE_LEVELS, toDayNumber } from '../../../shared';
import { loadSudokuGenerator } from '../generator';
import { FIRST_DAY, STARTING_LEVEL } from './model-constants';
import type { PuzzleModel } from './puzzle-model';
import { createGameModel } from './game-model';

// Today is Friday 30 October 2026 in every test, unless a test says otherwise.

const TODAY = toDayNumber({ year: 2026, month: 10, day: 30 });
const generate = await loadSudokuGenerator();

describe('GameModel', () => {
    it('starts on the calendar, at the level a new player starts on', () => {
        const model = createGameModel({ today: TODAY, store: createMemoryStore(), generate, offersIntro: false });
        expect(model.phase).toBe('calendar');
        expect(model.calendar.level).toBe(STARTING_LEVEL);
        expect(model.calendar.today).toBe(TODAY);
    });

    it('opens the puzzles from the first day to today, but none from before or after', () => {
        const model = createGameModel({ today: TODAY, store: createMemoryStore(), generate, offersIntro: false });
        for (const day of [FIRST_DAY - 1, TODAY + 1]) {
            expect(model.calendar.isPlayable(day)).toBe(false);
            model.openPuzzle(day);
            expect(model.phase).toBe('calendar');
        }
        for (const day of [FIRST_DAY, TODAY]) {
            expect(model.calendar.isPlayable(day)).toBe(true);
            model.openPuzzle(day);
            expect(model.phase).toBe('playing');
            expect(model.puzzleDay).toBe(day);
            model.closePuzzle();
        }
    });

    it('gives every player the same puzzle for a day and level, and a different one for each level and day', () => {
        const givensOf = (day: number, level: (typeof PUZZLE_LEVELS)[number]): string => {
            const model = createGameModel({ today: TODAY, store: createMemoryStore(), generate, offersIntro: false });
            model.calendar.chooseLevel(level);
            model.openPuzzle(day);
            return listDigits(model.puzzle);
        };
        expect(givensOf(TODAY, 'easy')).toBe(givensOf(TODAY, 'easy'));
        expect(givensOf(TODAY, 'easy')).not.toBe(givensOf(TODAY, 'medium'));
        expect(givensOf(TODAY, 'easy')).not.toBe(givensOf(TODAY - 1, 'easy'));
    });

    it('keeps a puzzle\'s progress, for the next visit', () => {
        const store = createMemoryStore();
        const model = createGameModel({ today: TODAY, store, generate, offersIntro: false });
        model.openPuzzle(TODAY - 3);
        const puzzle = openedPuzzle(model.puzzle);
        const cell = findEmptyCell(puzzle);
        puzzle.select([cell]);
        puzzle.toggleNote(4);
        model.update(16);
        expect(model.calendar.isStarted(TODAY - 3)).toBe(true);
        expect(model.calendar.isSolved(TODAY - 3)).toBe(false);

        const next = createGameModel({ today: TODAY + 1, store, generate, offersIntro: false });
        expect(next.calendar.isStarted(TODAY - 3)).toBe(true);
        next.openPuzzle(TODAY - 3);
        expect(openedPuzzle(next.puzzle).marksAt(cell)).toBe(1 << 4);
    });

    it('ticks off a puzzle once it is solved, at its level only, and remembers it', () => {
        const store = createMemoryStore();
        const model = createGameModel({ today: TODAY, store, generate, offersIntro: false });
        model.calendar.chooseLevel('medium');
        model.openPuzzle(TODAY);
        solve(model);
        model.update(16);
        expect(model.puzzlesSolved).toBe(1);
        model.closePuzzle();
        expect(model.calendar.isSolved(TODAY)).toBe(true);
        expect(model.calendar.solvedCount).toBe(1);
        model.calendar.chooseLevel('hard');
        expect(model.calendar.isSolved(TODAY)).toBe(false);
        expect(model.calendar.solvedCount).toBe(0);

        const next = createGameModel({ today: TODAY, store, generate, offersIntro: false });
        expect(next.calendar.level).toBe('hard');
        next.calendar.chooseLevel('medium');
        expect(next.calendar.isSolved(TODAY)).toBe(true);
        // Opened again, it is still solved, and is not counted again
        next.openPuzzle(TODAY);
        expect(next.puzzle?.isSolved).toBe(true);
        next.update(16);
        expect(next.puzzlesSolved).toBe(0);
    });

    it('starts a puzzle again, kept cleared and no longer started, but still ticked off if it was solved, and not the practice puzzle', () => {
        const store = createMemoryStore();
        const model = createGameModel({ today: TODAY, store, generate, offersIntro: false });
        expect(model.canRestartPuzzle).toBe(false);
        model.openPuzzle(TODAY - 3);
        const givens = listDigits(model.puzzle);
        solve(model);
        model.update(16);
        const opened = model.puzzlesOpened;
        model.restartPuzzle();
        expect(listDigits(model.puzzle)).toBe(givens);
        expect(model.puzzle?.isSolved).toBe(false);
        expect(model.puzzle?.undoCount).toBe(0);
        expect(model.puzzlesOpened).toBe(opened + 1);
        expect(model.calendar.isSolved(TODAY - 3)).toBe(true);
        // One not solved, started again and left, is no longer started
        model.closePuzzle();
        model.openPuzzle(TODAY - 4);
        const puzzle = openedPuzzle(model.puzzle);
        puzzle.select([findEmptyCell(puzzle)]);
        puzzle.toggleNote(4);
        model.update(16);
        model.restartPuzzle();
        model.closePuzzle();
        expect(model.calendar.isStarted(TODAY - 4)).toBe(false);

        const next = createGameModel({ today: TODAY, store, generate, offersIntro: false });
        expect(next.calendar.isStarted(TODAY - 4)).toBe(false);
        next.openPuzzle(TODAY - 3);
        expect(listDigits(next.puzzle)).toBe(givens);
        next.intro.showCard();
        next.intro.startWalkthrough();
        expect(next.canRestartPuzzle).toBe(false);
    });

    it('keeps a puzzle\'s progress at the puzzle\'s own level, whatever level the calendar comes to show', () => {
        const store = createMemoryStore();
        const model = createGameModel({ today: TODAY, store, generate, offersIntro: false });
        model.openPuzzle(TODAY);
        expect(model.puzzleLevel).toBe(STARTING_LEVEL);
        model.calendar.chooseLevel('expert');
        solve(model);
        model.closePuzzle();
        expect(model.calendar.isSolved(TODAY)).toBe(false);
        model.calendar.chooseLevel(STARTING_LEVEL);
        expect(model.calendar.isSolved(TODAY)).toBe(true);
    });

    it('finds the records kept by earlier versions, where they kept them, with Hardest now Expert', () => {
        const store = createMemoryStore();
        store.writeJson('mvt-arcade:sudoku:records', { solved: ['2026-10-30/hardest'], started: [] });
        store.write('mvt-arcade:sudoku:level', 'hardest');
        const model = createGameModel({ today: TODAY, store, generate, offersIntro: false });
        expect(model.calendar.level).toBe('expert');
        expect(model.calendar.isSolved(TODAY)).toBe(true);
        expect(readIndex(store)).toEqual({ solved: ['2026-10-30/hardest'], started: [] });
    });
});

describe('the way in', () => {
    it('shows the card that says how to play as the game first opens, over the calendar, and not by itself again once put away', () => {
        const store = createMemoryStore();
        const model = createGameModel({ today: TODAY, store: store, generate, offersIntro: true });
        expect([model.phase, model.intro.phase]).toEqual(['calendar', 'card']);
        model.intro.close();
        model.openPuzzle(TODAY);
        expect(model.intro.phase).toBe('hidden');
        const next = createGameModel({ today: TODAY, store: store, generate, offersIntro: true });
        expect(next.intro.phase).toBe('hidden');
    });

    it('plays a walkthrough from the calendar on the puzzle screen, and goes back to the calendar as it ends', () => {
        const model = createGameModel({ today: TODAY, store: createMemoryStore(), generate, offersIntro: true });
        model.intro.startWalkthrough();
        expect(model.phase).toBe('playing');
        expect(model.puzzle).toBeDefined();
        model.intro.close();
        expect(model.phase).toBe('calendar');
        expect(model.puzzle).toBeUndefined();
        // The way back from the puzzle's screen ends it too
        model.intro.showCard();
        model.intro.startWalkthrough();
        model.closePuzzle();
        expect([model.phase, model.intro.phase]).toEqual(['calendar', 'hidden']);
    });

    it('walks through making notes on a practice puzzle, which gives way to the puzzle open as it ends, and is never kept', () => {
        const store = createMemoryStore();
        const model = createGameModel({ today: TODAY, store, generate, offersIntro: true });
        model.openPuzzle(TODAY);
        const real = openedPuzzle(model.puzzle);
        const opened = model.puzzlesOpened;
        model.intro.startWalkthrough();
        expect(model.intro.walkthrough?.stepName).toBe('select');
        const practice = openedPuzzle(model.puzzle);
        expect(practice).not.toBe(real);
        expect(model.puzzlesOpened).toBe(opened + 1);
        const cell = findEmptyCell(practice);
        practice.select([cell]);
        practice.toggleNote(5);
        model.update(16);
        expect(model.calendar.isStarted(TODAY)).toBe(false);
        model.intro.close();
        expect(model.puzzle).toBe(real);
        expect(model.puzzlesOpened).toBe(opened + 2);
        expect(real.marksAt(cell)).toBe(0);
    });

    it('moves on a step as each is done, and ends as the puzzle closes', () => {
        const model = createGameModel({ today: TODAY, store: createMemoryStore(), generate, offersIntro: true });
        model.openPuzzle(TODAY);
        model.intro.startWalkthrough();
        const practice = openedPuzzle(model.puzzle);
        const steps: string[] = [];
        const step = (act: () => void): void => {
            act();
            model.update(16);
            steps.push(model.intro.walkthrough?.stepName ?? 'ended');
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
        expect(model.intro.phase).toBe('hidden');
        expect(model.phase).toBe('calendar');
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

function findEmptyCell(puzzle: PuzzleModel): number {
    return Array.from({ length: 81 }, (_, cell) => cell).find((cell) => puzzle.digitAt(cell) === 0) ?? -1;
}

/** Solves the open puzzle: works out its one solution with a plain search, and fills it in, cell by cell. */
function solve(model: ReturnType<typeof createGameModel>): void {
    const puzzle = openedPuzzle(model.puzzle);
    const empty = Array.from({ length: 81 }, (_, cell) => cell).filter((cell) => puzzle.digitAt(cell) === 0);
    const solution = findSolution(Array.from({ length: 81 }, (_, cell) => puzzle.digitAt(cell)));
    for (const cell of empty) {
        puzzle.fillCell(cell, solution[cell]);
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

import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '@mvtjs/site-kit/storage';
import { toDayNumber } from '../../../shared';
import { PASSAGE } from './edge-states';
import { describeMaze } from './puzzle-save';
import { createMinotaurModel, type MinotaurModel } from './minotaur-model';
import { STARTING_LEVEL } from './model-constants';
import { playShowcase } from './play-showcase';

// Today is Friday 30 October 2026 in every test.

const TODAY = toDayNumber({ year: 2026, month: 10, day: 30 });

describe('MinotaurModel', () => {
    it('starts on the calendar, at the level a new player starts on', () => {
        const model = createModel();
        expect(model.phase).toBe('calendar');
        expect(model.calendar.level).toBe(STARTING_LEVEL);
    });

    it('opens a day\'s puzzle at the calendar\'s level, but none after today', () => {
        const model = createModel();
        model.openPuzzle(TODAY + 1);
        expect(model.phase).toBe('calendar');
        model.calendar.chooseLevel('hard');
        model.openPuzzle(TODAY);
        expect(model.phase).toBe('playing');
        expect(model.puzzleLevel).toBe('hard');
        expect(model.puzzle?.maze.grid.rows).toBe(9);
    });

    it('gives every player the same puzzle for a day and level, and a different one for each level and day', () => {
        const mazeOf = (day: number, level: 'easy' | 'medium'): string => {
            const model = createModel();
            model.calendar.chooseLevel(level);
            model.openPuzzle(day);
            return model.puzzle === undefined ? '' : describeMaze(model.puzzle.maze);
        };
        expect(mazeOf(TODAY, 'easy')).toBe(mazeOf(TODAY, 'easy'));
        expect(mazeOf(TODAY, 'easy')).not.toBe(mazeOf(TODAY, 'medium'));
        expect(mazeOf(TODAY, 'easy')).not.toBe(mazeOf(TODAY - 1, 'easy'));
    });

    it('keeps a puzzle\'s progress, for the next visit, and ticks it off once solved', () => {
        const store = createMemoryStore();
        const model = createModel(store);
        model.openPuzzle(TODAY - 2);
        const puzzle = model.puzzle!;
        puzzle.mark(0, 'wall');
        model.update(16);
        expect(model.calendar.isStarted(TODAY - 2)).toBe(true);

        const next = createModel(store);
        next.openPuzzle(TODAY - 2);
        expect(next.puzzle?.markAt(0)).toBe('wall');
        solve(next);
        next.closePuzzle();
        expect(next.puzzlesSolved).toBe(1);
        expect(next.calendar.isSolved(TODAY - 2)).toBe(true);
        expect(next.calendar.solvedCount).toBe(1);
    });

    it('shows the card that says how to play as the game first opens, over the calendar, and not by itself again once put away', () => {
        const store = createMemoryStore();
        const model = createModel(store, true);
        expect([model.phase, model.intro.phase]).toEqual(['calendar', 'card']);
        model.intro.close();
        model.openPuzzle(TODAY);
        expect(model.intro.phase).toBe('hidden');
        const next = createModel(store, true);
        expect(next.intro.phase).toBe('hidden');
    });

    it('plays a walkthrough from the calendar on the puzzle screen, and goes back to the calendar as it ends', () => {
        const model = createModel(createMemoryStore(), true);
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

    it('walks through drawing on a practice maze, which gives way to the puzzle open as it ends, and is never kept', () => {
        const model = createModel();
        model.openPuzzle(TODAY);
        const real = model.puzzle;
        model.intro.showCard();
        model.intro.startWalkthrough();
        const practice = model.puzzle!;
        expect(practice).not.toBe(real);
        expect(model.intro.walkthrough?.stepName).toBe('path');
        practice.mark(0, 'wall');
        model.update(16);
        expect(model.calendar.isStarted(TODAY)).toBe(false);
        model.intro.close();
        expect(model.puzzle).toBe(real);
        expect(real?.markAt(0)).toBe('unknown');
    });

    it('has a small solved maze for the card to show', () => {
        const model = createModel();
        expect(model.example.grid.rows).toBe(4);
    });

    it('plays a showcase: today\'s medium puzzle, part drawn', () => {
        const model = createModel();
        playShowcase(model);
        expect(model.puzzleLevel).toBe('medium');
        expect(model.puzzle?.passagesMarked).toBeGreaterThan(10);
        expect(model.puzzle?.isSolved).toBe(false);
    });
});

function createModel(store = createMemoryStore(), offersIntro = false): MinotaurModel {
    return createMinotaurModel({ today: TODAY, store, offersIntro });
}

/** Marks every passage of the open puzzle's solution. */
function solve(model: MinotaurModel): void {
    const puzzle = model.puzzle!;
    const { solution } = puzzle.maze;
    for (let edge = 0; edge < solution.length; edge++) {
        if (solution[edge] === PASSAGE) puzzle.mark(edge, 'passage');
    }
}

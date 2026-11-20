import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '@mvtjs/site-kit/storage';
import { toDayNumber } from '../../../shared';
import { RIVER } from './river-states';
import { createGameModel, type GameModel } from './game-model';
import type { PuzzleModel } from './puzzle-model';

// Today is Friday 30 October 2026 in every test. Puzzles open at the starting
// level, Easy, which is the quickest to make.

const TODAY = toDayNumber({ year: 2026, month: 10, day: 30 });

describe('GameModel', () => {
    it('keeps a puzzle\'s progress for the next visit, and ticks it off once, as it is solved', () => {
        const store = createMemoryStore();
        const model = createModel(store);
        model.openPuzzle(TODAY - 3);
        const cell = findOpenCell(model.puzzle!);
        model.puzzle!.setMeadow(cell, true);
        model.update(16);
        expect([model.calendar.isStarted(TODAY - 3), model.calendar.isSolved(TODAY - 3)]).toEqual([true, false]);

        const next = createModel(store);
        next.openPuzzle(TODAY - 3);
        expect(next.puzzle!.isMeadowAt(cell)).toBe(true);
        solve(next);
        next.update(16);
        next.update(16);
        expect([next.puzzlesSolved, next.calendar.isSolved(TODAY - 3)]).toEqual([1, true]);
        // Opened again, it is still solved, and isn't counted again
        next.closePuzzle();
        next.openPuzzle(TODAY - 3);
        next.update(16);
        expect([next.puzzle!.isSolved, next.puzzlesSolved]).toEqual([true, 1]);
    });

    it('clears a puzzle started again, and keeps it ticked off if it was solved', () => {
        const model = createModel(createMemoryStore());
        expect(model.canRestartPuzzle).toBe(false);
        model.openPuzzle(TODAY - 3);
        solve(model);
        model.update(16);
        model.restartPuzzle();
        expect([model.puzzle!.isSolved, model.puzzle!.riverDrawn, model.puzzle!.undoCount]).toEqual([false, 0, 0]);
        expect(model.calendar.isSolved(TODAY - 3)).toBe(true);
    });

    it('forgets the progress of a puzzle started again, so the calendar no longer shows it started', () => {
        const store = createMemoryStore();
        const model = createModel(store);
        model.openPuzzle(TODAY - 4);
        model.puzzle!.setMeadow(findOpenCell(model.puzzle!), true);
        model.update(16);
        model.restartPuzzle();
        model.closePuzzle();
        expect(createModel(store).calendar.isStarted(TODAY - 4)).toBe(false);
    });

    it('can\'t start the walkthrough\'s practice puzzle again', () => {
        const model = createModel(createMemoryStore());
        model.openPuzzle(TODAY);
        model.intro.showCard();
        model.intro.startWalkthrough();
        expect(model.canRestartPuzzle).toBe(false);
    });

    it('plays the walkthrough on a practice puzzle, which stands in for the open puzzle and is never kept', () => {
        const model = createModel(createMemoryStore());
        model.openPuzzle(TODAY);
        const real = model.puzzle;
        model.intro.showCard();
        model.intro.startWalkthrough();
        const practice = model.puzzle!;
        expect(practice === real).toBe(false);
        practice.setMeadow(findOpenCell(practice), true);
        model.update(16);
        expect(model.calendar.isStarted(TODAY)).toBe(false);
        model.intro.close();
        expect([model.puzzle === real, real?.changes]).toEqual([true, 0]);
    });

    it('counts a puzzle opened as the walkthrough starts, and again as it ends', () => {
        const model = createModel(createMemoryStore());
        model.openPuzzle(TODAY);
        const opened = model.puzzlesOpened;
        model.intro.showCard();
        model.intro.startWalkthrough();
        expect(model.puzzlesOpened).toBe(opened + 1);
        model.intro.close();
        expect(model.puzzlesOpened).toBe(opened + 2);
    });
});

function createModel(store: ReturnType<typeof createMemoryStore>): GameModel {
    return createGameModel({ today: TODAY, store, offersIntro: false });
}

/** Returns the first cell of `puzzle` that isn't a given, so the player can mark it. */
function findOpenCell(puzzle: PuzzleModel): number {
    let cell = 0;
    while (puzzle.isGivenAt(cell)) cell++;
    return cell;
}

/** Draws the river of the open puzzle's solution. */
function solve(model: GameModel): void {
    const puzzle = model.puzzle!;
    const { solutionEdges } = puzzle.puzzle;
    for (let edge = 0; edge < solutionEdges.length; edge++) {
        if (solutionEdges[edge] === RIVER) puzzle.setRiver(edge, true);
    }
}

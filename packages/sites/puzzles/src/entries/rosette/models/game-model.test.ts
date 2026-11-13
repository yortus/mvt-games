import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '@mvtjs/site-kit/storage';
import { type Demo, toDayNumber } from '../../../shared';
import { findDayFrame } from './find-day-frame';
import { findPuzzleSeed } from './find-puzzle-seed';
import { createGameModel } from './game-model';
import { LEVEL_SETTINGS } from './levels';
import { createGlassWindow } from './glass-window';
import type { PuzzleModel } from './puzzle-model';
import type { RosetteTarget } from './rosette-walkthrough';

const TODAY = toDayNumber({ year: 2026, month: 11, day: 7 });

describe('the game', () => {
    it('opens today\'s puzzle at the level chosen, with that level\'s pieces', () => {
        const model = createGameModel({ today: TODAY, store: createMemoryStore(), offersIntro: false });
        model.calendar.chooseLevel('hard');
        model.openPuzzle(TODAY);
        expect(model.phase).toBe('playing');
        const expected = createGlassWindow({ seed: findPuzzleSeed(TODAY, 'hard'), settings: LEVEL_SETTINGS.hard, frame: findDayFrame(TODAY) });
        expect(model.puzzle?.puzzle.description).toBe(expected.description);
    });

    it('keeps a puzzle as it was left, and ticks it off once solved', () => {
        const store = createMemoryStore();
        const model = createGameModel({ today: TODAY, store, offersIntro: false });
        model.openPuzzle(TODAY);
        // Takes the piece on the first free tile to its own tile
        const piece = model.puzzle!.pieceAt(findFreeTile(model.puzzle!));
        model.puzzle!.swap(findFreeTile(model.puzzle!), piece);
        model.closePuzzle();

        const again = createGameModel({ today: TODAY, store, offersIntro: false });
        again.openPuzzle(TODAY);
        expect(again.puzzle!.pieceAt(piece)).toBe(piece);
        expect(again.puzzle!.swapCount).toBe(1);
        solve(again.puzzle!);
        again.update(0);
        expect(again.calendar.isSolved(TODAY)).toBe(true);
        expect(again.puzzlesSolved).toBe(1);
    });

    it('finds a demo for every step of the walkthrough, as it is played', () => {
        const model = createGameModel({ today: TODAY, store: createMemoryStore(), offersIntro: false });
        model.intro.showCard();
        model.intro.startWalkthrough();
        const practice = model.puzzle!;
        const walkthrough = model.intro.walkthrough!;
        expect(walkthrough.demo.length).toBeGreaterThan(0);
        playDemoSwap(practice, walkthrough.demo);
        model.update(16);
        expect(walkthrough.stepNumber).toBe(2);
        expect(walkthrough.demo.length).toBe(2);
        playDemoSwap(practice, walkthrough.demo);
        model.update(16);
        expect(walkthrough.stepNumber).toBe(3);
        practice.undo();
        model.update(16);
        expect(walkthrough.stepNumber).toBe(4);
    });
});

function findFreeTile(puzzle: PuzzleModel): number {
    for (let t = 0; t < puzzle.puzzle.patch.count; t++) if (!puzzle.isLockedAt(t)) return t;
    return -1;
}

/** Plays a demo's swap: a drag's two targets, or two taps', as one swap. */
function playDemoSwap(puzzle: PuzzleModel, demo: Demo<RosetteTarget>): void {
    const tiles: number[] = [];
    for (const touch of demo) for (const target of touch.targets) if (target.on === 'tile') tiles.push(target.tile);
    puzzle.swap(tiles[0], tiles[1]);
}

function solve(puzzle: PuzzleModel): void {
    const count = puzzle.puzzle.patch.count;
    for (let tile = 0; tile < count; tile++) {
        if (puzzle.pieceAt(tile) === tile) continue;
        for (let other = 0; other < count; other++) {
            if (puzzle.pieceAt(other) !== tile) continue;
            puzzle.swap(tile, other);
            break;
        }
    }
}

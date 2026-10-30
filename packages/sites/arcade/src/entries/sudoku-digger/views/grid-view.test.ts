import { describe, expect, it } from 'vitest';
import type { Container } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { GridView } from './grid-view';
import { GRID_SIZE } from './view-constants';

// The shake is tested by where the grid's board sits: off its place while it shakes, and back once it is done.

describe('GridView', () => {
    it('shakes the grid at a dead end, and settles it again', () => {
        const { board, state, tick } = setUp();
        state.deadEnds = 1;
        tick(16);
        expect(isOffItsPlace(board)).toBe(true);
        tick(400);
        expect(isOffItsPlace(board)).toBe(false);
    });

    it('starts no new shake for dead ends that come close behind the last one', () => {
        const { board, state, tick } = setUp();
        state.deadEnds = 1;
        tick(16);
        tick(250);
        expect(isOffItsPlace(board)).toBe(false);
        state.deadEnds = 2;
        tick(16);
        expect(isOffItsPlace(board)).toBe(false);
        // Once the gap has passed, the next dead end shakes it again
        tick(200);
        state.deadEnds = 3;
        tick(16);
        expect(isOffItsPlace(board)).toBe(true);
    });
});

function setUp() {
    const state = { deadEnds: 0 };
    const view = GridView({
        digitAt: () => 0,
        cellKindAt: () => 'empty',
        digMarkAt: () => 'none',
        areDigMarksShown: () => false,
        candidatesAt: () => 0,
        eliminatedAt: () => 0,
        isHighlightedAt: () => false,
        isDifferentAt: () => false,
        fullGridDigitAt: () => 0,
        cellsNeeded: () => 0,
        neededCell: () => 0,
        focusCell: () => -1,
        testedCell: () => -1,
        ownDigit: () => 0,
        rivalDigits: () => 0,
        ruledOutDigits: () => 0,
        testDigit: () => 0,
        deadEnds: () => state.deadEnds,
        deadEndCell: () => 0,
        cellsDug: () => 0,
        dugCell: () => 0,
        dugDigit: () => 0,
        seedsPlaced: () => 0,
        seedCell: () => 0,
        placements: () => 0,
        placedCell: () => -1,
        shuffleKind: () => undefined,
        shuffleFirst: () => 0,
        shuffleSecond: () => 0,
        shuffleProgress: () => 1,
    });
    const board = view.children[0] as Container;
    const tick = (deltaMs: number): void => {
        updateView(view, deltaMs);
        refreshView(view);
    };
    tick(16);
    return { board, state, tick };
}

function isOffItsPlace(board: Container): boolean {
    return Math.abs(board.x - GRID_SIZE / 2) > 0.01 || Math.abs(board.y - GRID_SIZE / 2) > 0.01;
}

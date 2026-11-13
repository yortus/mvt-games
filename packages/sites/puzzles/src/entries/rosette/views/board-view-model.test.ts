import { describe, expect, it } from 'vitest';
import { createGlassWindow, createPuzzleModel, LEVEL_SETTINGS, type PuzzleModel } from '../models';
import { type BoardViewModel, createBoardViewModel, type PiecePose } from './board-view-model';
import type { SwapGesturesViewModel } from './swap-gestures-view-model';
import { FLY_MS, LIFT_RAISE, SETTLE_MS } from './view-constants';

const made = createGlassWindow({ seed: 99, settings: LEVEL_SETTINGS.easy, frame: 'rectangle' });

describe('the board\'s presentation state', () => {
    it('locks a piece swapped home beside a locked one only once both pieces have landed, then lifts its group', () => {
        const { puzzle, viewModel } = setUp();
        const tile = findTileBesideALock(puzzle);
        puzzle.swap(tile, findTileOf(puzzle, tile));
        viewModel.update(0);
        viewModel.update(FLY_MS - 1);
        expect([viewModel.flightCount, viewModel.lockShareAt(tile)]).toEqual([2, 0]);

        viewModel.update(1);
        expect(viewModel.flightCount).toBe(0);
        expect(viewModel.lockShareAt(tile)).toBeGreaterThan(0);
        expect(viewModel.groups.length).toBe(1);
        expect(viewModel.groups[0].tiles).toContain(tile);

        viewModel.update(SETTLE_MS);
        expect([viewModel.lockShareAt(tile), viewModel.groups.length]).toEqual([1, 0]);
    });

    it('celebrates a window mended while it shows, once its last pieces land, and not one opened mended', () => {
        const { puzzle, viewModel } = setUp();
        const last = mendAllButOne(puzzle);
        viewModel.update(0);
        puzzle.swap(last, findTileOf(puzzle, last));
        viewModel.update(FLY_MS - 1);
        expect([viewModel.isCelebrating, viewModel.celebrationMs]).toEqual([true, 0]);
        for (let ms = 0; ms < 10_000 && viewModel.sunShare < 1; ms += 16) viewModel.update(16);
        expect(viewModel.sunShare).toBe(1);

        // The same window, opened again, is shown whole
        const reopened = createBoardViewModel(optionsFor(puzzle, 1, () => undefined));
        reopened.update(16);
        expect([reopened.isCelebrating, reopened.sunShare]).toEqual([false, 0]);
    });

    it('settles a piece let go where it can\'t swap back home, from where it was let go', () => {
        const { puzzle } = setUp();
        const gestures = { dragsEnded: 0, endedTile: -1, endedX: 0, endedY: 0, draggedTile: -1 };
        const viewModel = createBoardViewModel(optionsFor(puzzle, 0, () => gestures as unknown as SwapGesturesViewModel));
        const tile = findTileBesideALock(puzzle);
        Object.assign(gestures, { dragsEnded: 1, endedTile: tile, endedX: 2, endedY: 3 });
        viewModel.update(0);
        const pose: PiecePose = { x: 0, y: 0, raise: 0, turn: 0, scale: 1, lift: 0 };
        viewModel.findPose(tile, pose);
        expect([viewModel.flightKindAt(tile), pose.x, pose.y, pose.raise]).toEqual(['drop', 2, 3, LIFT_RAISE]);

        // No flight takes longer than a swap's
        viewModel.update(FLY_MS);
        viewModel.findPose(tile, pose);
        expect([viewModel.flightKindAt(tile), pose.x, pose.y]).toEqual(['none', made.patch.middleXs[tile], made.patch.middleYs[tile]]);
    });
});

function setUp(): { puzzle: PuzzleModel; viewModel: BoardViewModel } {
    const puzzle = createPuzzleModel({ puzzle: made });
    return { puzzle, viewModel: createBoardViewModel(optionsFor(puzzle, 0, () => undefined)) };
}

function optionsFor(puzzle: PuzzleModel, opened: number, gestures: () => SwapGesturesViewModel | undefined): Parameters<typeof createBoardViewModel>[0] {
    return {
        puzzle: () => puzzle.puzzle,
        puzzlesOpened: () => opened,
        pieceAt: (tile) => puzzle.pieceAt(tile),
        isLockedAt: (tile) => puzzle.isLockedAt(tile),
        isSolved: () => puzzle.isSolved,
        lastSwappedTile: () => puzzle.lastTileB,
        changes: () => puzzle.changes,
        gestures,
    };
}

/** A tile whose piece is elsewhere, beside a locked tile, so its piece locks as it comes home. */
function findTileBesideALock(puzzle: PuzzleModel): number {
    const { patch } = made;
    for (let tile = 0; tile < patch.count; tile++) {
        if (puzzle.pieceAt(tile) !== tile && patch.neighboursOf(tile).some((t) => puzzle.isLockedAt(t))) return tile;
    }
    throw new Error('No free tile beside a locked one');
}

/** Swaps every piece home but the last two, and returns the tile of one of them. */
function mendAllButOne(puzzle: PuzzleModel): number {
    let last = -1;
    for (let tile = 0; tile < made.patch.count; tile++) {
        if (puzzle.pieceAt(tile) === tile) continue;
        const from = findTileOf(puzzle, tile);
        if (puzzle.pieceAt(from) === tile && puzzle.pieceAt(tile) === from && isLastSwap(puzzle, tile, from)) {
            last = tile;
            continue;
        }
        puzzle.swap(tile, from);
    }
    return last;
}

/** Whether swapping `a` and `b` would mend the window: every other piece is home. */
function isLastSwap(puzzle: PuzzleModel, a: number, b: number): boolean {
    for (let t = 0; t < made.patch.count; t++) if (t !== a && t !== b && puzzle.pieceAt(t) !== t) return false;
    return true;
}

function findTileOf(puzzle: PuzzleModel, piece: number): number {
    for (let t = 0; t < made.patch.count; t++) if (puzzle.pieceAt(t) === piece) return t;
    return -1;
}

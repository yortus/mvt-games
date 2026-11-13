import { describe, expect, it } from 'vitest';
import { LEVEL_SETTINGS } from './levels';
import { createGlassWindow } from './glass-window';
import { createPuzzleModel, type PuzzleModel } from './puzzle-model';

const made = createGlassWindow({ seed: 99, settings: LEVEL_SETTINGS.easy, frame: 'rectangle' });

describe('a puzzle being put back together', () => {
    it('starts jumbled, with nothing to undo', () => {
        const puzzle = createPuzzleModel({ puzzle: made });
        expect(puzzle.isSolved).toBe(false);
        expect(puzzle.swapCount).toBe(0);
        expect(puzzle.undoCount).toBe(0);
        expect(listTiles((t) => puzzle.colourAt(t))).toEqual(listTiles((t) => made.colours[made.jumble[t]]));
    });

    it('swaps two free pieces of the same shape, and undoes the swap', () => {
        const puzzle = createPuzzleModel({ puzzle: made });
        const [a, b] = findSwappableTiles(true);
        const pieceA = puzzle.pieceAt(a);
        const pieceB = puzzle.pieceAt(b);
        puzzle.swap(a, b);
        expect([puzzle.pieceAt(a), puzzle.pieceAt(b)]).toEqual([pieceB, pieceA]);
        expect(puzzle.swapCount).toBe(1);
        expect(puzzle.swapsMade).toBe(1);
        puzzle.undo();
        expect([puzzle.pieceAt(a), puzzle.pieceAt(b)]).toEqual([pieceA, pieceB]);
        expect(puzzle.swapCount).toBe(0);
        expect(puzzle.undosDone).toBe(1);
    });

    it('never moves a locked piece, swaps a tile with itself, or swaps pieces of different shapes', () => {
        const puzzle = createPuzzleModel({ puzzle: made });
        const lockedTile = made.locked.indexOf(1);
        const [free] = findSwappableTiles(true);
        const [one, other] = findSwappableTiles(false);
        expect(puzzle.canSwap(lockedTile, free)).toBe(false);
        expect(puzzle.canSwap(one, other)).toBe(false);
        puzzle.swap(lockedTile, free);
        puzzle.swap(free, free);
        puzzle.swap(one, other);
        expect(puzzle.pieceAt(lockedTile)).toBe(lockedTile);
        expect(puzzle.swapsMade).toBe(0);
    });

    it('is solved in the fewest swaps by taking each piece home, and then takes no more', () => {
        const puzzle = createPuzzleModel({ puzzle: made });
        solve(puzzle);
        expect(puzzle.isSolved).toBe(true);
        expect(puzzle.swapCount).toBe(made.fewestSwaps);
        expect(puzzle.lockedCount).toBe(made.patch.count);
        const [a, b] = [0, 1];
        puzzle.swap(a, b);
        puzzle.undo();
        expect(puzzle.isSolved).toBe(true);
    });

    it('locks a piece put in its place next to a locked one, and unlocks it as the swap is undone', () => {
        const puzzle = createPuzzleModel({ puzzle: made });
        const startingLocks = puzzle.lockedCount;
        const tile = findFreeTileNextTo(puzzle, (t) => made.locked[t] === 1);
        putHome(puzzle, tile);
        expect(puzzle.isLockedAt(tile)).toBe(true);
        expect(puzzle.lockedCount).toBeGreaterThan(startingLocks);
        expect(puzzle.locksGained).toBe(1);
        expect(puzzle.canSwap(tile, findSameShapeFreeTile(puzzle, tile))).toBe(false);

        // A save holds no locks: they follow from where the pieces are
        const restored = createPuzzleModel({ puzzle: made, saved: JSON.parse(JSON.stringify(puzzle.save())) });
        expect(restored.isLockedAt(tile)).toBe(true);

        puzzle.undo();
        expect(puzzle.isLockedAt(tile)).toBe(false);
        expect(puzzle.lockedCount).toBe(startingLocks);
        expect(puzzle.locksGained).toBe(1);
    });

    it('leaves a piece in its place away from the locked ones free, until the locked ones reach it', () => {
        let isTried = false;
        for (let far = 0; far < made.patch.count && !isTried; far++) {
            const puzzle = createPuzzleModel({ puzzle: made });
            if (puzzle.isLockedAt(far) || isNextTo(far, (t) => made.locked[t] === 1)) continue;
            putHome(puzzle, far);
            if (puzzle.isLockedAt(far)) continue;
            // A neighbour of it, next to a lock, still out of place
            const near = made.patch.neighboursOf(far).find((t) => puzzle.pieceAt(t) !== t && isNextTo(t, (n) => made.locked[n] === 1));
            if (near === undefined) continue;
            expect(puzzle.canSwap(far, findSameShapeFreeTile(puzzle, far))).toBe(true);
            putHome(puzzle, near);
            expect(puzzle.isLockedAt(near)).toBe(true);
            expect(puzzle.isLockedAt(far)).toBe(true);
            isTried = true;
        }
        expect(isTried).toBe(true);
    });

    it('is restored from its save, and ignores a save of another puzzle', () => {
        const puzzle = createPuzzleModel({ puzzle: made });
        const [a, b] = findSwappableTiles(true);
        puzzle.swap(a, b);
        const restored = createPuzzleModel({ puzzle: made, saved: JSON.parse(JSON.stringify(puzzle.save())) });
        expect(listTiles((t) => restored.pieceAt(t))).toEqual(listTiles((t) => puzzle.pieceAt(t)));
        expect(restored.swapCount).toBe(1);

        const other = createGlassWindow({ seed: 100, settings: LEVEL_SETTINGS.easy, frame: 'rectangle' });
        const fresh = createPuzzleModel({ puzzle: other, saved: puzzle.save() });
        expect(Array.from({ length: other.patch.count }, (_, t) => fresh.pieceAt(t))).toEqual([...other.jumble]);
    });
});

/** Each of the made puzzle's tiles' values, in order. */
function listTiles<T>(valueAt: (tile: number) => T): T[] {
    return Array.from({ length: made.patch.count }, (_, t) => valueAt(t));
}

/** Two free tiles of the same shape, or of different shapes. */
function findSwappableTiles(isSameShape: boolean): [number, number] {
    const { count, shapes } = made.patch;
    for (let a = 0; a < count; a++) {
        for (let b = a + 1; b < count; b++) {
            if (made.locked[a] === 0 && made.locked[b] === 0 && (shapes[a] === shapes[b]) === isSameShape) return [a, b];
        }
    }
    throw new Error('no such tiles');
}

/** Swaps the piece that belongs on `tile` onto it. */
function putHome(puzzle: PuzzleModel, tile: number): void {
    for (let other = 0; other < made.patch.count; other++) {
        if (puzzle.pieceAt(other) !== tile) continue;
        puzzle.swap(tile, other);
        return;
    }
}

/** Whether any neighbour of `tile` passes `test`. */
function isNextTo(tile: number, test: (neighbour: number) => boolean): boolean {
    return made.patch.neighboursOf(tile).some(test);
}

/** A free tile, out of place, next to a tile that passes `test`. */
function findFreeTileNextTo(puzzle: PuzzleModel, test: (neighbour: number) => boolean): number {
    for (let t = 0; t < made.patch.count; t++) if (!puzzle.isLockedAt(t) && puzzle.pieceAt(t) !== t && isNextTo(t, test)) return t;
    throw new Error('no such tile');
}

/** Another free tile of the same shape as `tile`. */
function findSameShapeFreeTile(puzzle: PuzzleModel, tile: number): number {
    for (let t = 0; t < made.patch.count; t++) {
        if (t !== tile && !puzzle.isLockedAt(t) && made.patch.shapes[t] === made.patch.shapes[tile]) return t;
    }
    throw new Error('no such tile');
}

/** Takes each piece home in turn, which takes the fewest swaps. */
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

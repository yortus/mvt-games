import { describe, expect, it } from 'vitest';
import { PASSAGE } from './edge-states';
import { LEVEL_SETTINGS } from './levels';
import { makeMazePuzzle, type MazePuzzle } from './make-maze-puzzle';
import { MOST_UNDOS } from './model-constants';
import { createPuzzleModel } from './puzzle-model';

const maze = makeMazePuzzle({ seed: 1, settings: LEVEL_SETTINGS.easy });
const { grid } = maze;

describe('PuzzleModel', () => {
    it('is solved once the passages marked are the solution\'s, walls or not, and then takes no more marks', () => {
        const puzzle = createPuzzleModel({ maze });
        const passages = listPassages(maze);
        for (let i = 0; i < passages.length; i++) {
            expect(puzzle.isSolved).toBe(false);
            puzzle.mark(passages[i], 'passage');
        }
        expect(puzzle.isSolved).toBe(true);
        const wall = solutionWall(maze);
        puzzle.mark(wall, 'wall');
        expect(puzzle.markAt(wall)).toBe('unknown');
        puzzle.undo();
        expect(puzzle.isSolved).toBe(true);
    });

    it('undoes a whole stroke at once, and a mark made outside a stroke on its own', () => {
        const puzzle = createPuzzleModel({ maze });
        const [first, second, third] = listPassages(maze);
        puzzle.startStroke();
        puzzle.mark(first, 'passage');
        puzzle.mark(second, 'passage');
        puzzle.finishStroke();
        puzzle.mark(third, 'wall');
        expect(puzzle.undoCount).toBe(2);
        puzzle.undo();
        expect([puzzle.markAt(first), puzzle.markAt(second), puzzle.markAt(third)]).toEqual(['passage', 'passage', 'unknown']);
        puzzle.undo();
        expect([puzzle.markAt(first), puzzle.markAt(second)]).toEqual(['unknown', 'unknown']);
        expect(puzzle.undosDone).toBe(2);
    });

    it('counts the passages marked in the stroke being made, from none as each stroke starts', () => {
        const puzzle = createPuzzleModel({ maze });
        const [first, second, third] = listPassages(maze);
        puzzle.startStroke();
        puzzle.mark(first, 'passage');
        puzzle.mark(second, 'passage');
        expect(puzzle.strokePassages).toBe(2);
        puzzle.finishStroke();
        puzzle.mark(third, 'passage');
        expect(puzzle.strokePassages).toBe(1);
    });

    it('keeps no undo for a stroke that ends as it began', () => {
        const puzzle = createPuzzleModel({ maze });
        const [edge] = listPassages(maze);
        puzzle.startStroke();
        puzzle.mark(edge, 'passage');
        puzzle.mark(edge, 'unknown');
        puzzle.finishStroke();
        expect(puzzle.undoCount).toBe(0);
    });

    it('keeps no more undos than it may', () => {
        const puzzle = createPuzzleModel({ maze });
        for (let i = 0; i <= MOST_UNDOS; i++) puzzle.mark(0, i % 2 === 0 ? 'wall' : 'unknown');
        expect(puzzle.undoCount).toBe(MOST_UNDOS);
    });

    it('counts marks, and takes a cell with too many passages as a clash', () => {
        const puzzle = createPuzzleModel({ maze });
        // A middle cell, away from the start and the end, with three passages
        const cell = findCellAwayFromEnds(maze);
        for (let side = 0; side < 3; side++) puzzle.mark(grid.cellEdges[cell * 4 + side], 'passage');
        expect(puzzle.isClashAt(cell)).toBe(true);
        expect(puzzle.clashesMade).toBe(1);
        expect(puzzle.passagesMarked).toBe(3);
        puzzle.undo();
        expect(puzzle.isClashAt(cell)).toBe(false);
    });

    it('takes a cell walled in, and the cells of a loop, as clashes', () => {
        const puzzle = createPuzzleModel({ maze });
        const cell = findCellAwayFromEnds(maze);
        for (let side = 0; side < 3; side++) puzzle.mark(grid.cellEdges[cell * 4 + side], 'wall');
        expect(puzzle.isClashAt(cell)).toBe(true);

        const loop = createPuzzleModel({ maze });
        // The four cells in the top left corner, joined in a ring
        const ring = [0, 1, grid.cols + 1, grid.cols];
        for (let i = 0; i < 4; i++) loop.mark(grid.edgeBetween(ring[i], ring[(i + 1) % 4]), 'passage');
        for (const each of ring) expect(loop.isClashAt(each)).toBe(true);
        expect(loop.isClashAt(2)).toBe(false);
    });

    it('meets a clue when the walls marked on its line are exactly it, and breaks it when they can\'t fit', () => {
        const puzzle = createPuzzleModel({ maze });
        const line = 0;
        const edges = grid.lineEdges[line];
        expect(puzzle.clueStateAt(line)).toBe('open');
        for (let i = 0; i < edges.length; i++) {
            if (maze.solution[edges[i]] !== PASSAGE) puzzle.mark(edges[i], 'wall');
        }
        expect(puzzle.clueStateAt(line)).toBe('met');
        for (let i = 0; i < edges.length; i++) puzzle.mark(edges[i], 'wall');
        expect(puzzle.clueStateAt(line)).toBe('broken');
    });

    it('restores a save of the same maze, and ignores any other', () => {
        const puzzle = createPuzzleModel({ maze });
        const [first, second] = listPassages(maze);
        puzzle.mark(first, 'passage');
        puzzle.mark(second, 'wall');
        const saved = JSON.parse(JSON.stringify(puzzle.save())) as unknown;
        const restored = createPuzzleModel({ maze, saved });
        expect([restored.markAt(first), restored.markAt(second)]).toEqual(['passage', 'wall']);
        expect(restored.undoCount).toBe(0);

        const other = makeMazePuzzle({ seed: 2, settings: LEVEL_SETTINGS.easy });
        expect(createPuzzleModel({ maze: other, saved }).markAt(first)).toBe('unknown');
        for (const bad of [undefined, 'text', { maze: 'x', marks: '' }, { ...puzzle.save(), marks: '3'.repeat(grid.edgeCount) }]) {
            expect(createPuzzleModel({ maze, saved: bad }).markAt(first)).toBe('unknown');
        }
    });
});

/** The solution's passages, in the order of their edges. */
function listPassages(puzzle: MazePuzzle): number[] {
    const passages: number[] = [];
    for (let edge = 0; edge < puzzle.grid.edgeCount; edge++) {
        if (puzzle.solution[edge] === PASSAGE) passages.push(edge);
    }
    return passages;
}

function solutionWall(puzzle: MazePuzzle): number {
    return Array.from(puzzle.solution).findIndex((state) => state !== PASSAGE);
}

/** A cell inside the grid that is neither the start nor the end. */
function findCellAwayFromEnds(puzzle: MazePuzzle): number {
    const { cols, rows } = puzzle.grid;
    for (let row = 1; row < rows - 1; row++) {
        for (let col = 1; col < cols - 1; col++) {
            const cell = row * cols + col;
            if (cell !== puzzle.start && cell !== puzzle.end) return cell;
        }
    }
    return -1;
}

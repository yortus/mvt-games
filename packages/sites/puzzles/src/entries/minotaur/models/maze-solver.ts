import { PASSAGE, UNKNOWN, WALL } from './edge-states';
import { createLinePattern, type LinePattern } from './line-pattern';
import type { MazeGrid } from './maze-grid';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What it takes to solve a maze from its clues: the rules alone, edge by
 * edge; trying edges, to see which way breaks a rule; or guessing, which a
 * good puzzle never needs.
 */
export type MazeReasoning = 'rules' | 'tries' | 'guessing';

/**
 * Solves a maze from its clues, as a person might, and counts its solutions.
 * It knows each edge as unknown, a wall or a passage, and applies three
 * rules until none tells it anything more:
 *
 * - **Lines.** Each line's edges must follow its clue. An edge that is a
 *   wall in every way the clue fits is a wall, and the same for a passage.
 * - **Cells.** The start and the end have one passage each, and every
 *   other cell two. A cell with all it needs has walls on its other sides;
 *   a cell with just enough sides left has passages on all of them.
 * - **No loops.** An edge that would close a loop is a wall. So is an edge
 *   that would join the start's piece of the path to the end's before every
 *   cell is on it.
 *
 * Trying an edge means setting it one way and applying the rules: if they
 * find a contradiction, the edge must be the other way.
 */
export interface MazeSolver {
    /** What the maze takes to solve: `rules` or `tries` if it can be solved without guessing, which means it has one solution. */
    readonly grade: () => MazeReasoning;
    /** How many solutions the maze has, counting no further than `limit`. */
    readonly countSolutions: (limit: number) => number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface MazeSolverOptions {
    readonly grid: MazeGrid;
    /** Each line's clue: the lengths of its stretches of wall, in order. */
    readonly clues: readonly (readonly number[])[];
    /** The cells the path starts and ends in. */
    readonly start: number;
    readonly end: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a solver for the maze with `clues`, from `start` to `end`. */
export function createMazeSolver(options: MazeSolverOptions): MazeSolver {
    const { grid, clues, start, end } = options;
    const { cellCount, edgeCount, edgeCellA, edgeCellB, cellEdges, lineEdges } = grid;
    const patterns: LinePattern[] = [];
    for (let line = 0; line < grid.lineCount; line++) {
        patterns.push(createLinePattern({ clue: clues[line], length: lineEdges[line].length }));
    }
    const passagesNeeded = new Uint8Array(cellCount).fill(2);
    passagesNeeded[start] = 1;
    passagesNeeded[end] = 1;
    // Which piece of the path each cell is in, by the passages known
    const piece = new Int32Array(cellCount);

    return {
        grade() {
            const states = new Uint8Array(edgeCount);
            if (!applyRules(states)) return 'guessing';
            if (isSolved(states)) return 'rules';
            return applyTries(states) && isSolved(states) ? 'tries' : 'guessing';
        },
        countSolutions: (limit) => countFrom(new Uint8Array(edgeCount), limit),
    };

    /** Applies the rules to `states` until none tells it more. Returns false if they find a contradiction. */
    function applyRules(states: Uint8Array): boolean {
        let isChanging = true;
        while (isChanging) {
            isChanging = false;
            for (let line = 0; line < patterns.length; line++) {
                const changed = patterns[line].narrow(states, lineEdges[line]);
                if (changed < 0) return false;
                if (changed > 0) isChanging = true;
            }
            for (let cell = 0; cell < cellCount; cell++) {
                const changed = applyCellRule(states, cell);
                if (changed < 0) return false;
                if (changed > 0) isChanging = true;
            }
            const changed = applyLoopRule(states);
            if (changed < 0) return false;
            if (changed > 0) isChanging = true;
        }
        return true;
    }

    /** Fills in `cell`'s sides if its passages so far force them. Returns how many it set, or -1 if the cell can't be right. */
    function applyCellRule(states: Uint8Array, cell: number): number {
        let passages = 0;
        let unknowns = 0;
        for (let side = 0; side < 4; side++) {
            const edge = cellEdges[cell * 4 + side];
            if (edge < 0) continue;
            if (states[edge] === PASSAGE) passages++;
            else if (states[edge] === UNKNOWN) unknowns++;
        }
        const needed = passagesNeeded[cell];
        if (passages > needed || passages + unknowns < needed) return -1;
        if (unknowns === 0) return 0;
        // Full, so its other sides are walls; or every side left is needed, so they are all passages
        const fill = passages === needed ? WALL : passages + unknowns === needed ? PASSAGE : UNKNOWN;
        if (fill === UNKNOWN) return 0;
        for (let side = 0; side < 4; side++) {
            const edge = cellEdges[cell * 4 + side];
            if (edge >= 0 && states[edge] === UNKNOWN) states[edge] = fill;
        }
        return unknowns;
    }

    /** Walls up the edges that would close a loop, or finish the path too soon. Returns how many it set, or -1 if there is a loop already. */
    function applyLoopRule(states: Uint8Array): number {
        for (let cell = 0; cell < cellCount; cell++) piece[cell] = cell;
        let passageCount = 0;
        for (let edge = 0; edge < edgeCount; edge++) {
            if (states[edge] !== PASSAGE) continue;
            passageCount++;
            const a = findPiece(edgeCellA[edge]);
            const b = findPiece(edgeCellB[edge]);
            if (a === b) return -1;
            piece[a] = b;
        }
        const startPiece = findPiece(start);
        const endPiece = findPiece(end);
        const isLastPassage = passageCount + 1 === cellCount - 1;
        if (startPiece === endPiece && passageCount !== cellCount - 1) return -1;
        let changed = 0;
        for (let edge = 0; edge < edgeCount; edge++) {
            if (states[edge] !== UNKNOWN) continue;
            const a = findPiece(edgeCellA[edge]);
            const b = findPiece(edgeCellB[edge]);
            const isEndToEnd = (a === startPiece && b === endPiece) || (a === endPiece && b === startPiece);
            if (a === b || (isEndToEnd && !isLastPassage)) {
                states[edge] = WALL;
                changed++;
            }
        }
        return changed;
    }

    function findPiece(cell: number): number {
        let root = cell;
        while (piece[root] !== root) root = piece[root];
        while (piece[cell] !== root) {
            const next = piece[cell];
            piece[cell] = root;
            cell = next;
        }
        return root;
    }

    /** Tries each unknown edge both ways, keeping what a contradiction proves, until no try proves anything. Returns false on a contradiction. */
    function applyTries(states: Uint8Array): boolean {
        const tried = new Uint8Array(edgeCount);
        let isProving = true;
        while (isProving) {
            isProving = false;
            for (let edge = 0; edge < edgeCount; edge++) {
                if (states[edge] !== UNKNOWN) continue;
                for (let way = PASSAGE; way <= WALL; way++) {
                    tried.set(states);
                    tried[edge] = way;
                    if (applyRules(tried)) continue;
                    states[edge] = way === PASSAGE ? WALL : PASSAGE;
                    if (!applyRules(states)) return false;
                    isProving = true;
                    break;
                }
            }
        }
        return true;
    }

    function isSolved(states: Readonly<Uint8Array>): boolean {
        return states.indexOf(UNKNOWN) < 0;
    }

    /** Counts the solutions that follow from `states`, up to `limit`, by the rules and then by search. */
    function countFrom(states: Uint8Array, limit: number): number {
        if (!applyRules(states)) return 0;
        const edge = chooseEdge(states);
        if (edge < 0) return 1;
        let count = 0;
        for (let way = PASSAGE; way <= WALL && count < limit; way++) {
            const next = states.slice();
            next[edge] = way;
            count += countFrom(next, limit - count);
        }
        return count;
    }

    /** An unknown edge of the cell with the fewest unknown sides, the likeliest to settle quickly, or -1 if none is unknown. */
    function chooseEdge(states: Readonly<Uint8Array>): number {
        let chosen = -1;
        let fewest = 5;
        for (let cell = 0; cell < cellCount; cell++) {
            let unknowns = 0;
            let unknown = -1;
            for (let side = 0; side < 4; side++) {
                const edge = cellEdges[cell * 4 + side];
                if (edge >= 0 && states[edge] === UNKNOWN) {
                    unknowns++;
                    unknown = edge;
                }
            }
            if (unknowns > 0 && unknowns < fewest) {
                fewest = unknowns;
                chosen = unknown;
            }
        }
        return chosen;
    }
}

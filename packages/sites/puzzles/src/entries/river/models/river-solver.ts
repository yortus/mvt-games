import { findPiece } from './find-piece';
import { GIVEN_DRY, isGivenRiver } from './given-pieces';
import { DRY, RIVER, UNKNOWN } from './river-states';
import type { ValleyGrid } from './valley-grid';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A way a person works out the river by reading the valley as it stands,
 * without guessing, or following where a guess leads. These are the
 * techniques, from easiest to hardest.
 *
 * - `rules`: the river runs into a cell and out again, so a river cell has
 *   two river sides, and each end of the river one, besides the side it
 *   runs off the valley by. A cell with both its river sides found is dry
 *   on its others, and one with only as many open sides as it needs uses
 *   them all. A cell with fewer than two open sides is a dead end, so it is
 *   dry. A row or column with all its river cells found is dry elsewhere,
 *   and one with only as many open cells as river cells still needed is
 *   river in all of them.
 * - `loops`: the river never runs in a circle, so a side that would join a
 *   stretch of river to itself is dry. And a side that would join the
 *   stretch from the spring to the stretch from the sea, finishing the
 *   river, is dry unless that river would meet every number.
 * - `crossings`: the river crosses the line between two columns an odd
 *   number of times if the spring and the sea are on opposite sides of it,
 *   and an even number if they are on the same side. So when every crossing
 *   of a line but one is known, that one is too. The same for rows.
 */
export type RiverTechnique = 'rules' | 'loops' | 'crossings';

/** The techniques, from easiest to hardest. */
export const RIVER_TECHNIQUES: readonly RiverTechnique[] = ['rules', 'loops', 'crossings'];

/** How far the techniques got with a puzzle. */
export interface SolverProgress {
    /** Each cell, as `RIVER`, `DRY`, or `UNKNOWN` where the techniques got no further. */
    readonly cells: Uint8Array;
    /** Each edge, as `RIVER`, `DRY`, or `UNKNOWN`. */
    readonly edges: Uint8Array;
    /** Whether every edge is known. A puzzle the techniques finish has one solution, since every step was forced. */
    readonly isFinished: boolean;
    /** The hardest technique it needed. */
    readonly hardest: RiverTechnique;
}

/**
 * Works out a river from its ends and its numbers, the way a person would,
 * without guessing. When the rules get stuck, it goes on only if the harder
 * techniques, between them, find at least two cells or edges. That way a
 * player never has to search the whole valley for a single deduction.
 */
export interface RiverSolver {
    /**
     * Works out as much of the river as the techniques up to `most` can, from
     * `givens`. Each given is what a cell printed on the valley shows, as a
     * number from `given-pieces`, or `NO_GIVEN` for a cell not printed. Each
     * time, it uses the easiest technique that finds something.
     */
    solve: (givens: Readonly<Uint8Array>, most: RiverTechnique) => SolverProgress;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What a solver is created with. */
export interface RiverSolverOptions {
    /** The puzzle's valley. */
    readonly grid: ValleyGrid;
    /** The cell the river rises in, on the left edge. */
    readonly spring: number;
    /** The cell the river reaches the sea from, on the bottom edge. */
    readonly sea: number;
    /** How many river cells each row holds, from the top. */
    readonly rowCounts: Readonly<Uint8Array>;
    /** How many river cells each column holds, from the left. */
    readonly colCounts: Readonly<Uint8Array>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a solver for the puzzle with these ends and numbers. */
export function createRiverSolver(options: RiverSolverOptions): RiverSolver {
    const { grid, spring, sea, rowCounts, colCounts } = options;
    const { size, cellCount, edgeCount, edgeCellA, edgeCellB, cellEdges } = grid;
    const acrossCount = size * (size - 1);

    // Scratch space. `piece` holds the stretches of river, as a parent for each cell, for `findPiece`. The board arrays hold the board as a technique found it
    const piece = new Int32Array(cellCount);
    const pieceRowCells = new Int32Array(size);
    const pieceColCells = new Int32Array(size);
    const boardCells = new Uint8Array(cellCount);
    const boardEdges = new Uint8Array(edgeCount);
    // Where the rules are stuck, these hold the board after each technique, by its place in the list
    const triedCells = RIVER_TECHNIQUES.map(() => new Uint8Array(cellCount));
    const triedEdges = RIVER_TECHNIQUES.map(() => new Uint8Array(edgeCount));
    const isCellFound = new Uint8Array(cellCount);
    const isEdgeFound = new Uint8Array(edgeCount);

    return {
        solve(givens, most) {
            const cells = new Uint8Array(cellCount);
            const edges = new Uint8Array(edgeCount);
            cells[spring] = RIVER;
            cells[sea] = RIVER;
            for (let cell = 0; cell < cellCount; cell++) {
                const given = givens[cell];
                if (given === GIVEN_DRY) cells[cell] = DRY;
                if (!isGivenRiver(given)) continue;
                cells[cell] = RIVER;
                for (let side = 0; side < 4; side++) {
                    const edge = cellEdges[cell * 4 + side];
                    if (edge >= 0) edges[edge] = (given >> side) & 1 ? RIVER : DRY;
                }
            }
            const mostLevel = RIVER_TECHNIQUES.indexOf(most);
            let hardest = 0;
            for (;;) {
                applyRules(cells, edges);
                if (!edges.includes(UNKNOWN) && !cells.includes(UNKNOWN)) break;
                // Try each technique from the same board, easiest first, until they find enough between them
                isCellFound.fill(0);
                isEdgeFound.fill(0);
                let foundCount = 0;
                let easiest = 0;
                for (let level = 1; level <= mostLevel && foundCount < FEWEST_FOUND; level++) {
                    triedCells[level].set(cells);
                    triedEdges[level].set(edges);
                    if (!applyTechnique(RIVER_TECHNIQUES[level], triedCells[level], triedEdges[level])) continue;
                    if (easiest === 0) easiest = level;
                    for (let cell = 0; cell < cellCount; cell++) {
                        if (triedCells[level][cell] === cells[cell] || isCellFound[cell] === 1) continue;
                        isCellFound[cell] = 1;
                        foundCount++;
                    }
                    for (let edge = 0; edge < edgeCount; edge++) {
                        if (triedEdges[level][edge] === edges[edge] || isEdgeFound[edge] === 1) continue;
                        isEdgeFound[edge] = 1;
                        foundCount++;
                    }
                }
                if (foundCount < FEWEST_FOUND) break;
                cells.set(triedCells[easiest]);
                edges.set(triedEdges[easiest]);
                hardest = Math.max(hardest, easiest);
            }
            return { cells, edges, isFinished: !edges.includes(UNKNOWN) && !cells.includes(UNKNOWN), hardest: RIVER_TECHNIQUES[hardest] };
        },
    };

    /** Applies `technique` once. Returns whether it changed anything. */
    function applyTechnique(technique: RiverTechnique, cells: Uint8Array, edges: Uint8Array): boolean {
        switch (technique) {
            // `applyRules` has already run until nothing changed, so the rules can't change any more here
            case 'rules': return false;
            case 'loops': return blockLoops(cells, edges);
            case 'crossings': return countCrossings(edges);
        }
    }

    /** Applies the rules until nothing changes. */
    function applyRules(cells: Uint8Array, edges: Uint8Array): void {
        let isChanged = true;
        while (isChanged) {
            isChanged = false;
            for (let cell = 0; cell < cellCount; cell++) {
                let rivers = 0;
                let open = 0;
                for (let side = 0; side < 4; side++) {
                    const edge = cellEdges[cell * 4 + side];
                    if (edge < 0) continue;
                    if (edges[edge] === RIVER) rivers++;
                    else if (edges[edge] === UNKNOWN) open++;
                }
                const need = cell === spring || cell === sea ? 1 : 2;
                if (rivers > 0 && cells[cell] === UNKNOWN) {
                    cells[cell] = RIVER;
                    isChanged = true;
                }
                // A cell with too few open sides for the river to run through is a dead end
                if (cells[cell] === UNKNOWN && rivers + open < need) {
                    cells[cell] = DRY;
                    isChanged = true;
                }
                if (open === 0) continue;
                let fill = UNKNOWN;
                if (cells[cell] === DRY || (cells[cell] === RIVER && rivers >= need)) fill = DRY;
                else if (cells[cell] === RIVER && rivers + open === need) fill = RIVER;
                if (fill === UNKNOWN) continue;
                for (let side = 0; side < 4; side++) {
                    const edge = cellEdges[cell * 4 + side];
                    if (edge >= 0 && edges[edge] === UNKNOWN) edges[edge] = fill;
                }
                isChanged = true;
            }
            for (let line = 0; line < size * 2; line++) {
                const isColumn = line >= size;
                const index = isColumn ? line - size : line;
                const count = isColumn ? colCounts[index] : rowCounts[index];
                let rivers = 0;
                let open = 0;
                for (let i = 0; i < size; i++) {
                    const known = cells[isColumn ? i * size + index : index * size + i];
                    if (known === RIVER) rivers++;
                    else if (known === UNKNOWN) open++;
                }
                if (open === 0 || (rivers < count && rivers + open > count)) continue;
                const fill = rivers >= count ? DRY : RIVER;
                for (let i = 0; i < size; i++) {
                    const cell = isColumn ? i * size + index : index * size + i;
                    if (cells[cell] === UNKNOWN) cells[cell] = fill;
                }
                isChanged = true;
            }
        }
    }

    /** Makes dry every open side that would close a loop, or finish the river too soon. Returns whether it changed anything. */
    function blockLoops(cells: Uint8Array, edges: Uint8Array): boolean {
        boardCells.set(cells);
        boardEdges.set(edges);
        for (let cell = 0; cell < cellCount; cell++) piece[cell] = cell;
        for (let edge = 0; edge < edgeCount; edge++) {
            if (boardEdges[edge] === RIVER) piece[findPiece(piece, edgeCellA[edge])] = findPiece(piece, edgeCellB[edge]);
        }
        const springPiece = findPiece(piece, spring);
        const seaPiece = findPiece(piece, sea);
        let isChanged = false;
        for (let edge = 0; edge < edgeCount; edge++) {
            if (boardEdges[edge] !== UNKNOWN) continue;
            const a = findPiece(piece, edgeCellA[edge]);
            const b = findPiece(piece, edgeCellB[edge]);
            const isLoop = a === b;
            const isFinishing = springPiece !== seaPiece && ((a === springPiece && b === seaPiece) || (a === seaPiece && b === springPiece));
            if (isLoop || (isFinishing && !isFinishedRiverRight(springPiece, seaPiece))) {
                edges[edge] = DRY;
                isChanged = true;
            }
        }
        return isChanged;
    }

    /**
     * Returns whether joining the stretches from the spring and from the sea
     * would make the whole river. It would if every river cell is in one of
     * them, and their cells meet every number.
     */
    function isFinishedRiverRight(springPiece: number, seaPiece: number): boolean {
        pieceRowCells.fill(0);
        pieceColCells.fill(0);
        for (let cell = 0; cell < cellCount; cell++) {
            const root = findPiece(piece, cell);
            const isInRiver = root === springPiece || root === seaPiece;
            if (boardCells[cell] === RIVER && !isInRiver) return false;
            if (!isInRiver) continue;
            pieceRowCells[Math.floor(cell / size)]++;
            pieceColCells[cell % size]++;
        }
        for (let i = 0; i < size; i++) {
            if (pieceRowCells[i] !== rowCounts[i] || pieceColCells[i] !== colCounts[i]) return false;
        }
        return true;
    }

    /**
     * Settles the last open crossing of each line between two columns or two
     * rows. The river must cross each line an odd or an even number of times,
     * which decides it. Returns whether it changed anything.
     */
    function countCrossings(edges: Uint8Array): boolean {
        boardEdges.set(edges);
        let isChanged = false;
        const springRow = Math.floor(spring / size);
        const seaCol = sea % size;
        // The lines between columns come first, then the lines between rows
        for (let axis = 0; axis < 2; axis++) {
            const isBetweenRows = axis === 1;
            for (let line = 0; line < size - 1; line++) {
                // The spring is on the left edge, and the sea is on the bottom edge. So the river
                // crosses a line between columns an odd number of times if the sea is right of it.
                // It crosses a line between rows an odd number of times if the spring is above it.
                const isOdd = isBetweenRows ? springRow <= line : seaCol > line;
                let rivers = 0;
                let open = 0;
                let last = -1;
                for (let i = 0; i < size; i++) {
                    const edge = isBetweenRows ? acrossCount + line * size + i : i * (size - 1) + line;
                    if (boardEdges[edge] === RIVER) rivers++;
                    else if (boardEdges[edge] === UNKNOWN) {
                        open++;
                        last = edge;
                    }
                }
                if (open !== 1) continue;
                edges[last] = (rivers % 2 === 1) === isOdd ? DRY : RIVER;
                isChanged = true;
            }
        }
        return isChanged;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many cells and edges, at least, the techniques must find between them wherever the rules are stuck. */
const FEWEST_FOUND = 2;

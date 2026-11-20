import { GIVEN_DRY, isGivenRiver, NO_GIVEN } from './given-pieces';
import type { RiverPuzzle } from './river-puzzle';
import { DRY, RIVER, UNKNOWN } from './river-states';
import { DOWN, RIGHT } from './valley-grid';

/**
 * Counts the rivers that fit `puzzle`'s ends, numbers and givens, up to
 * `most`. It uses a plain search that shares no code with the solver. It
 * takes the edges in order, and tries each as river and as dry. It backs up
 * as soon as a choice can't lead to a river that fits. That happens when a
 * cell has more river sides than it can, or too few open ones left. It also
 * happens when a row or column has more river cells than its number, or too
 * few cells left that could still be river. Once every edge is chosen, it
 * checks that the river is one path from the spring to the sea, and fits
 * the givens.
 */
export function countSolutions(puzzle: RiverPuzzle, most: number): number {
    const { grid, spring, sea, rowCounts, colCounts, givens } = puzzle;
    const { size, cellCount, edgeCount, edgeCellA, edgeCellB, cellEdges, cellAcross } = grid;
    const edges = new Uint8Array(edgeCount);
    // The edges in the order they are chosen. Each cell's right and lower edges come cell by cell, so each cell is settled soon
    const order: number[] = [];
    for (let cell = 0; cell < cellCount; cell++) {
        if (cellEdges[cell * 4 + RIGHT] >= 0) order.push(cellEdges[cell * 4 + RIGHT]);
        if (cellEdges[cell * 4 + DOWN] >= 0) order.push(cellEdges[cell * 4 + DOWN]);
    }
    const seen = new Uint8Array(cellCount);
    const queue = new Int32Array(cellCount);
    let count = 0;
    search(0);
    return count;

    function search(index: number): void {
        if (count >= most) return;
        if (index === order.length) {
            if (isWhole()) count++;
            return;
        }
        const edge = order[index];
        for (let choice = RIVER; choice <= DRY; choice++) {
            // A river edge between two cells already joined by river would close a loop
            if (choice === RIVER && isJoined(edgeCellA[edge], edgeCellB[edge])) continue;
            edges[edge] = choice;
            if (isStillPossible(edgeCellA[edge]) && isStillPossible(edgeCellB[edge])) search(index + 1);
        }
        edges[edge] = UNKNOWN;
    }

    /** Whether `from` and `to` are joined by river edges chosen so far. */
    function isJoined(from: number, to: number): boolean {
        seen.fill(0);
        let head = 0;
        let tail = 0;
        queue[tail++] = from;
        seen[from] = 1;
        while (head < tail) {
            const cell = queue[head++];
            if (cell === to) return true;
            for (let side = 0; side < 4; side++) {
                const edge = cellEdges[cell * 4 + side];
                if (edge < 0 || edges[edge] !== RIVER) continue;
                const other = cellAcross(edge, cell);
                if (seen[other] === 1) continue;
                seen[other] = 1;
                queue[tail++] = other;
            }
        }
        return false;
    }

    /** Whether `cell`, its row and its column can still be completed, from the edges chosen so far. */
    function isStillPossible(cell: number): boolean {
        if (!isCellPossible(cell)) return false;
        const row = Math.floor(cell / size);
        const col = cell % size;
        let rowRiver = 0;
        let rowMaybe = 0;
        let colRiver = 0;
        let colMaybe = 0;
        for (let i = 0; i < size; i++) {
            const inRow = findCellMark(row * size + i);
            const inCol = findCellMark(i * size + col);
            if (inRow === RIVER) rowRiver++;
            else if (inRow === UNKNOWN) rowMaybe++;
            if (inCol === RIVER) colRiver++;
            else if (inCol === UNKNOWN) colMaybe++;
        }
        return rowRiver <= rowCounts[row] && rowRiver + rowMaybe >= rowCounts[row] && colRiver <= colCounts[col] && colRiver + colMaybe >= colCounts[col];
    }

    /** Whether `cell`'s sides chosen so far still allow it the river sides it needs, as its given says, if it has one. */
    function isCellPossible(cell: number): boolean {
        const need = cell === spring || cell === sea ? 1 : 2;
        let rivers = 0;
        let open = 0;
        for (let side = 0; side < 4; side++) {
            const edge = cellEdges[cell * 4 + side];
            if (edge < 0) continue;
            if (edges[edge] === RIVER) rivers++;
            else if (edges[edge] === UNKNOWN) open++;
            const given = givens[cell];
            if (isGivenRiver(given) && edges[edge] !== UNKNOWN && ((given >> side) & 1) !== (edges[edge] === RIVER ? 1 : 0)) return false;
        }
        if (givens[cell] === GIVEN_DRY && rivers > 0) return false;
        const mustFlow = need === 1 || isGivenRiver(givens[cell]);
        if (rivers > need || (rivers > 0 && rivers + open < need) || (mustFlow && rivers + open < need)) return false;
        return true;
    }

    /** Whether `cell` is river, dry, or can't yet be told, from the edges chosen so far. */
    function findCellMark(cell: number): number {
        if (cell === spring || cell === sea) return RIVER;
        let open = 0;
        for (let side = 0; side < 4; side++) {
            const edge = cellEdges[cell * 4 + side];
            if (edge < 0) continue;
            if (edges[edge] === RIVER) return RIVER;
            if (edges[edge] === UNKNOWN) open++;
        }
        return open > 0 ? UNKNOWN : DRY;
    }

    /** Whether the river edges chosen are one path from the spring to the sea, through every river cell, with each cell given as it is. */
    function isWhole(): boolean {
        for (let cell = 0; cell < cellCount; cell++) {
            if (!isCellPossible(cell)) return false;
            if (givens[cell] !== NO_GIVEN && givens[cell] !== GIVEN_DRY && findCellMark(cell) !== RIVER) return false;
        }
        // Follow the river from the spring, and see that it reaches the sea having passed through every river cell
        let riverCells = 0;
        for (let cell = 0; cell < cellCount; cell++) {
            if (findCellMark(cell) === RIVER) riverCells++;
        }
        let cell = spring;
        let from = -1;
        let steps = 1;
        while (cell !== sea) {
            let next = -1;
            for (let side = 0; side < 4 && next < 0; side++) {
                const edge = cellEdges[cell * 4 + side];
                if (edge < 0 || edges[edge] !== RIVER) continue;
                const other = cellAcross(edge, cell);
                if (other !== from) next = other;
            }
            if (next < 0) return false;
            from = cell;
            cell = next;
            steps++;
        }
        return steps === riverCells;
    }
}

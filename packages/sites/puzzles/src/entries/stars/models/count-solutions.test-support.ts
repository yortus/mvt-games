import { EMPTY, STAR, UNKNOWN } from './cell-states';
import { type StarGrid, STARS_PER_LINE } from './star-grid';

/**
 * Counts the solutions of the puzzle with `regions` and `givens`, stopping
 * at `most`, by searching: it applies the plain rules until they settle,
 * then tries a cell both ways. It shares nothing with the solver the
 * puzzle maker uses, so tests can check that solver's claim of one solution
 * against it.
 */
export function countSolutions(grid: StarGrid, regions: Readonly<Uint8Array>, givens: Readonly<Uint8Array>, most: number): number {
    const { size, cellCount, neighbours } = grid;
    const lines: number[][] = [];
    for (let row = 0; row < size; row++) lines.push(Array.from({ length: size }, (_, col) => row * size + col));
    for (let col = 0; col < size; col++) lines.push(Array.from({ length: size }, (_, row) => row * size + col));
    for (let region = 0; region < size; region++) lines.push([]);
    for (let cell = 0; cell < cellCount; cell++) lines[size * 2 + regions[cell]].push(cell);
    let count = 0;
    search(givens.slice());
    return count;

    function search(cells: Uint8Array): void {
        if (!settle(cells)) return;
        let best: number[] | undefined;
        let bestOpen = Infinity;
        for (const line of lines) {
            const stars = line.filter((cell) => cells[cell] === STAR).length;
            const open = line.filter((cell) => cells[cell] === UNKNOWN).length;
            if (stars < STARS_PER_LINE && open < bestOpen) {
                best = line;
                bestOpen = open;
            }
        }
        if (best === undefined) {
            count++;
            return;
        }
        const cell = best.find((c) => cells[c] === UNKNOWN)!;
        for (const state of [STAR, EMPTY]) {
            if (count >= most) return;
            const next = cells.slice();
            next[cell] = state;
            search(next);
        }
    }

    /** Applies the rules until nothing changes. Returns false if the cells break one. */
    function settle(cells: Uint8Array): boolean {
        let isChanged = true;
        while (isChanged) {
            isChanged = false;
            for (let cell = 0; cell < cellCount; cell++) {
                if (cells[cell] !== STAR) continue;
                for (let k = 0; k < 8; k++) {
                    const next = neighbours[cell * 8 + k];
                    if (next < 0) continue;
                    if (cells[next] === STAR) return false;
                    if (cells[next] === UNKNOWN) {
                        cells[next] = EMPTY;
                        isChanged = true;
                    }
                }
            }
            for (const line of lines) {
                const stars = line.filter((cell) => cells[cell] === STAR).length;
                const open = line.filter((cell) => cells[cell] === UNKNOWN);
                if (stars > STARS_PER_LINE || stars + open.length < STARS_PER_LINE) return false;
                if (open.length === 0) continue;
                if (stars === STARS_PER_LINE || stars + open.length === STARS_PER_LINE) {
                    for (const cell of open) cells[cell] = stars === STARS_PER_LINE ? EMPTY : STAR;
                    isChanged = true;
                }
            }
        }
        return true;
    }
}

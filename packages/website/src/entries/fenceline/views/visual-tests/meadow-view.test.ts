import { canvasTest } from 'v-snap';
import type { CellKind } from '../../data';
import { MeadowView } from '../meadow-view';
import { FARM_LOOKS } from '../view-constants';

const ROWS = 20;
const COLS = 30;
const CELL_SIZE = 8;
const IMAGE = { width: COLS * CELL_SIZE, height: ROWS * CELL_SIZE };

/** A meadow with its bottom left corner fenced off, and a pond. */
function poseMeadow(farmIndex: number): ReturnType<typeof MeadowView> {
    return MeadowView({
        rows: ROWS,
        cols: COLS,
        cellSize: CELL_SIZE,
        cellKindAt: findCellKind,
        closureAt: () => 0,
        closureCount: () => 0,
        round: () => 1,
        grass: () => FARM_LOOKS[farmIndex].grass,
    });
}

function findCellKind(row: number, col: number): CellKind {
    if (row >= 12 && col < 12) return 'pasture';
    if ((row - 6) ** 2 / 9 + (col - 20) ** 2 / 25 <= 1) return 'pond';
    return 'meadow';
}

for (let i = 0; i < FARM_LOOKS.length; i++) {
    canvasTest(`on farm ${i + 1}, ${FARM_LOOKS[i].name.toLowerCase()}`, IMAGE, () => poseMeadow(i));
}

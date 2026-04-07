import { Graphics } from 'pixi.js';
import { GRID_ROWS, GRID_COLS } from '../../data';
import { CELL_WIDTH_PX, CELL_HEIGHT_PX } from '../view-constants';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBackgroundView(): Graphics {
    const bg = new Graphics();
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            const shade = (r + c) % 2 === 0 ? 0x3A2A4A : 0x2E1E3E;
            bg.rect(c * CELL_WIDTH_PX, r * CELL_HEIGHT_PX, CELL_WIDTH_PX, CELL_HEIGHT_PX).fill(shade);
        }
    }
    return bg;
}

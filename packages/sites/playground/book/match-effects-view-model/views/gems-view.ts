import { Container, Graphics, Rectangle } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { GemKind } from '../models';
import { BOARD_X, BOARD_Y, CELL_PX, GEM_COLORS, toCellX, toCellY } from './board-layout';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GemsViewBindings {
    /** The board's size, read once. */
    readonly rows: number;
    readonly cols: number;
    readonly gemAt: (row: number, col: number) => GemKind;
    readonly onCellPressed?: (row: number, col: number) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The board's gems. Each gem is drawn once, in white, and tinted with its
 * kind's colour on each refresh.
 */
export function GemsView(bindings: GemsViewBindings): Container {
    const { rows, cols } = bindings;
    const view = new Container();

    const gems: Graphics[] = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const gem = new Graphics();
            gem.poly([0, -18, 16, -4, 10, 16, -10, 16, -16, -4]).fill(0xffffff);
            gem.poly([0, -18, 6, -4, -6, -4]).fill({ color: 0xffffff, alpha: 0.5 });
            gem.position.set(toCellX(col), toCellY(row));
            view.addChild(gem);
            gems.push(gem);
        }
    }

    // A press on the board picks the cell under the pointer
    view.eventMode = 'static';
    view.cursor = 'pointer';
    view.hitArea = new Rectangle(BOARD_X, BOARD_Y, cols * CELL_PX, rows * CELL_PX);
    view.on('pointerdown', (e) => {
        const local = view.toLocal(e.global);
        const row = Math.floor((local.y - BOARD_Y) / CELL_PX);
        const col = Math.floor((local.x - BOARD_X) / CELL_PX);
        if (row >= 0 && row < rows && col >= 0 && col < cols) bindings.onCellPressed?.(row, col);
    });

    setRefresh(view, () => {
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                gems[row * cols + col].tint = GEM_COLORS[bindings.gemAt(row, col)];
            }
        }
    });
    return view;
}

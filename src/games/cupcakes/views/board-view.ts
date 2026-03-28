import { Container, Graphics } from 'pixi.js';
import { watch } from '#common';
import type { BoardModel } from '../models';
import { CELL_SIZE } from '../data';
import { createCupcakeView } from './cupcake-view';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBoardView(board: BoardModel): Container {
    const view = new Container();
    const watcher = watch({ cellCount: () => board.cells.length });
    let cupcakeContainers: Container[] = [];

    initialiseView();
    view.onRender = refresh;
    return view;

    function initialiseView(): void {
        // Grid background
        const bg = new Graphics();
        for (let r = 0; r < board.rows; r++) {
            for (let c = 0; c < board.cols; c++) {
                const shade = (r + c) % 2 === 0 ? 0x3A2A4A : 0x2E1E3E;
                bg.rect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE).fill(shade);
            }
        }
        view.addChild(bg);

        // Build cupcake views
        buildCupcakes();
    }

    function refresh(): void {
        const watched = watcher.poll();
        if (watched.cellCount.changed) {
            buildCupcakes();
        }
    }

    function buildCupcakes(): void {
        for (let i = 0; i < cupcakeContainers.length; i++) {
            cupcakeContainers[i].destroy({ children: true });
        }
        cupcakeContainers = [];

        const count = board.cells.length;
        for (let i = 0; i < count; i++) {
            const idx = i;
            const c = createCupcakeView({
                getKind: () => board.cells[idx].kind,
                getX: () => board.cells[idx].col * CELL_SIZE + CELL_SIZE * 0.5,
                getY: () => board.cells[idx].row * CELL_SIZE + CELL_SIZE * 0.5,
                getAlpha: () => board.cells[idx].alpha,
                isSelected: () => board.cells[idx].isSelected,
            });
            view.addChild(c);
            cupcakeContainers.push(c);
        }
    }
}

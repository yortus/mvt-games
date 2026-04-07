import { Container } from 'pixi.js';
import { watch, type StatefulPixiView } from '#common';
import type { CactusCell } from '../../models';
import { createCactusView } from '../cactus-view';
import { CELL_WIDTH_PX, CELL_HEIGHT_PX } from '../view-constants';
import { GRID_COLS, GRID_ROWS } from '../../data';
import { createPiecesViewModel, type PiecesViewModelOptions } from './pieces-view-model';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export type PiecesViewBindings = PiecesViewModelOptions;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPiecesView(bindings: PiecesViewBindings): StatefulPixiView {
    const vm = createPiecesViewModel(bindings);
    const watcher = watch({
        gridSize: () => bindings.getCells().length,
    });
    let cactusContainers: Container[] = [];
    let prevDragCell: CactusCell | undefined;

    const view = new Container();
    initialiseView();
    view.onRender = refresh;
    return Object.assign(view, { update: vm.update });

    function initialiseView(): void {
        view.sortableChildren = true;
        buildCactii();

        // Input listeners
        view.eventMode = 'static';
        view.hitArea = { contains: (x: number, y: number) => x >= 0 && x < GRID_COLS * CELL_WIDTH_PX && y >= 0 && y < GRID_ROWS * CELL_HEIGHT_PX };
        view.on('pointerdown', onPointerDown);
        view.on('globalpointermove', onPointerMove);
        view.on('pointerup', onPointerUp);
        view.on('pointerupoutside', onPointerUp);
    }

    function refresh(): void {
        const watched = watcher.poll();
        if (watched.gridSize.changed) buildCactii();

        // Sync drag zIndex from view model
        const dragCell = vm.dragOriginCell;
        if (dragCell !== prevDragCell) {
            if (prevDragCell) {
                cactusContainers[prevDragCell.row * GRID_COLS + prevDragCell.col].zIndex = 0;
            }
            if (dragCell) {
                cactusContainers[dragCell.row * GRID_COLS + dragCell.col].zIndex = DRAG_Z_INDEX;
            }
            prevDragCell = dragCell;
        }
    }

    function buildCactii(): void {
        for (let i = 0; i < cactusContainers.length; i++) {
            cactusContainers[i].destroy({ children: true });
        }
        cactusContainers = [];

        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                const row = r, col = c;
                const cactus = createCactusView({
                    getKind: () => bindings.getCells()[row][col].kind,
                    getX: () => vm.getCellX(bindings.getCells()[row][col]),
                    getY: () => vm.getCellY(bindings.getCells()[row][col]),
                    getAlpha: () => vm.getCellAlpha(bindings.getCells()[row][col]),
                });
                view.addChild(cactus);
                cactusContainers.push(cactus);
            }
        }
    }

    // ---- Input handlers ----------------------------------------------------

    function onPointerDown(e: { global: { x: number; y: number } }): void {
        const local = view.toLocal(e.global);
        vm.startDrag(local.x, local.y);
    }

    function onPointerMove(e: { global: { x: number; y: number } }): void {
        const local = view.toLocal(e.global);
        vm.dragTo(local.x, local.y);
    }

    function onPointerUp(): void {
        vm.endDrag();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** zIndex applied to the dragged cactus so it renders above its neighbours. */
const DRAG_Z_INDEX = 10;

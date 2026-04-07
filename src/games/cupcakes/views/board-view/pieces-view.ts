import { Container } from 'pixi.js';
import { watch, type StatefulPixiView } from '#common';
import type { CupcakeCell } from '../../models';
import { createCupcakeView } from '../cupcake-view';
import { CELL_SIZE_PX } from '../view-constants';
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
    let cupcakeContainers: Container[] = [];
    let prevDragCell: CupcakeCell | undefined;

    const view = new Container();
    initialseView();
    view.onRender = refresh;
    return Object.assign(view, { update: vm.update });

    function initialseView(): void {
        view.sortableChildren = true;
        buildCupcakes();

        // Input listeners
        view.eventMode = 'static';
        view.hitArea = { contains: (x: number, y: number) => x >= 0 && x < GRID_COLS * CELL_SIZE_PX && y >= 0 && y < GRID_ROWS * CELL_SIZE_PX };
        view.on('pointerdown', onPointerDown);
        view.on('globalpointermove', onPointerMove);
        view.on('pointerup', onPointerUp);
        view.on('pointerupoutside', onPointerUp);
    }

    function refresh(): void {
        const watched = watcher.poll();
        if (watched.gridSize.changed) buildCupcakes();

        // Sync drag zIndex from view model
        const dragCell = vm.dragOriginCell;
        if (dragCell !== prevDragCell) {
            if (prevDragCell) {
                cupcakeContainers[prevDragCell.row * GRID_COLS + prevDragCell.col].zIndex = 0;
            }
            if (dragCell) {
                cupcakeContainers[dragCell.row * GRID_COLS + dragCell.col].zIndex = DRAG_Z_INDEX;
            }
            prevDragCell = dragCell;
        }
    }

    function buildCupcakes(): void {
        for (let i = 0; i < cupcakeContainers.length; i++) {
            cupcakeContainers[i].destroy({ children: true });
        }
        cupcakeContainers = [];

        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                const row = r, col = c;
                const cupcake = createCupcakeView({
                    getKind: () => bindings.getCells()[row][col].kind,
                    getX: () => vm.getCellX(bindings.getCells()[row][col]),
                    getY: () => vm.getCellY(bindings.getCells()[row][col]),
                    getAlpha: () => vm.getCellAlpha(bindings.getCells()[row][col]),
                });
                view.addChild(cupcake);
                cupcakeContainers.push(cupcake);
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

/** zIndex applied to the dragged cupcake so it renders above its neighbours. */
const DRAG_Z_INDEX = 10;

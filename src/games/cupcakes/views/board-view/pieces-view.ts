import { Container } from 'pixi.js';
import { watch, type StatefulPixiView } from '#common';
import { GRID_COLS, GRID_ROWS } from '../../data';
import { createCupcakeView } from '../cupcake-view';
import { CELL_SIZE_PX } from '../view-constants';
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
        cellCount: () => bindings.getCells().length,
        dragIndex: () => vm.dragOriginIndex,
    });
    let cupcakeContainers: Container[] = [];

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
        if (watched.cellCount.changed) buildCupcakes();

        // Sync drag zIndex from view model
        if (watched.dragIndex.changed) {
            const { value, previous = -1 } = watched.dragIndex;
            if (previous !== -1) cupcakeContainers[previous].zIndex = 0;
            if (value !== -1) cupcakeContainers[value].zIndex = DRAG_Z_INDEX;
        }
    }

    function buildCupcakes(): void {
        for (let i = 0; i < cupcakeContainers.length; i++) {
            cupcakeContainers[i].destroy({ children: true });
        }
        cupcakeContainers = [];

        const count = bindings.getCells().length;
        for (let i = 0; i < count; i++) {
            const index = i;
            const c = createCupcakeView({
                getKind: () => bindings.getCells()[index].kind,
                getX: () => vm.getCellX(index),
                getY: () => vm.getCellY(index),
                getAlpha: () => vm.getCellAlpha(index),
            });
            view.addChild(c);
            cupcakeContainers.push(c);
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

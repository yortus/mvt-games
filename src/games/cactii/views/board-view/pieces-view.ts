import { Container } from 'pixi.js';
import { watch } from '#mvt-utils';
import type { CactusCell } from '../../models';
import { CactusView } from '../cactus-view';
import { CELL_WIDTH_PX, CELL_HEIGHT_PX } from '../view-constants';
import { GRID_COLS, GRID_ROWS } from '../../data';
import { createPiecesViewModel, type PiecesViewModelOptions } from './pieces-view-model';
import { setTickMethods } from '../../../../pixi-mvt';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export type PiecesViewBindings = PiecesViewModelOptions;

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function PiecesView(bindings: PiecesViewBindings): Container {
    const vm = createPiecesViewModel(bindings);
    const watcher = watch({
        gridSize: () => bindings.cells().length,
    });
    let cactusContainers: Container[] = [];
    let prevDragCell: CactusCell | undefined;

    const view = new Container();
    initialiseView();
    setTickMethods(view, { update: vm.update, refresh });
    return view;

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
                const cactus = CactusView({
                    kind: () => bindings.cells()[row][col].kind,
                    x: () => vm.xFor(bindings.cells()[row][col]),
                    y: () => vm.yFor(bindings.cells()[row][col]),
                    alpha: () => vm.alphaFor(bindings.cells()[row][col]),
                    scale: () => vm.scaleFor(bindings.cells()[row][col]),
                    rotation: () => vm.rotationFor(bindings.cells()[row][col]),
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

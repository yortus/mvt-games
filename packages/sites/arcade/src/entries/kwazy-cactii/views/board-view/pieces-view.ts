import { Container } from 'pixi.js';
import { listenToPointer } from '@mvtjs/site-kit/input/pixi';
import { watch } from '@mvtjs/utils';
import type { CactusCell } from '../../models';
import { CactusView } from '../cactus-view';
import { CELL_WIDTH_PX, CELL_HEIGHT_PX } from '../view-constants';
import { GRID_COLS, GRID_ROWS } from '../../data';
import { createPiecesViewModel, type PiecesViewModelOptions } from './pieces-view-model';
import { setRefresh, setUpdate } from '@mvtjs/pixi';

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
    setUpdate(view, vm.update);
    setRefresh(view, refresh);
    return view;

    function initialiseView(): void {
        view.sortableChildren = true;
        buildCactii();

        // Input, passed to the view model's gestures in cells
        view.hitArea = { contains: (x: number, y: number) => x >= 0 && x < GRID_COLS * CELL_WIDTH_PX && y >= 0 && y < GRID_ROWS * CELL_HEIGHT_PX };
        listenToPointer({
            target: view,
            onPressed: (x, y) => vm.gestures.press(x / CELL_WIDTH_PX, y / CELL_HEIGHT_PX),
            onMoved: (x, y) => vm.gestures.move(x / CELL_WIDTH_PX, y / CELL_HEIGHT_PX),
            onReleased: () => vm.gestures.release(),
            onCancelled: () => vm.gestures.cancel(),
        });
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
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** zIndex applied to the dragged cactus so it renders above its neighbours. */
const DRAG_Z_INDEX = 10;

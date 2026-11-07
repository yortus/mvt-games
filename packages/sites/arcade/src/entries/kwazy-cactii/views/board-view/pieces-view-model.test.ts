import { describe, it, expect, vi } from 'vitest';
import { createSequence } from '@mvtjs/utils';
import { type BoardPhase, EMPTY_CELL, type CactusCell } from '../../models';
import { createPiecesViewModel, type PiecesViewModel, type PiecesViewModelOptions } from './pieces-view-model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CELL_WIDTH = 200;
const CELL_HEIGHT = 250;
const COLS = 8;

/** Centre pixel position for a grid cell. */
function gridX(col: number): number {
    return col * CELL_WIDTH + CELL_WIDTH * 0.5;
}

function gridY(row: number): number {
    return row * CELL_HEIGHT + CELL_HEIGHT * 0.5;
}

/** A single cell at the given position. */
function cell(row: number, col: number): CactusCell {
    return { kind: 'astrophytum', row, col };
}

/** Build a full 8x8 grid of alive cells. */
function fullGrid(): CactusCell[][] {
    const cells: CactusCell[][] = [];
    for (let r = 0; r < 8; r++) {
        cells[r] = [];
        for (let c = 0; c < COLS; c++) {
            cells[r][c] = cell(r, c);
        }
    }
    return cells;
}

/** Build a 2D NaN-filled settleOriginRows array matching a fullGrid. */
function emptySettleOrigins(): number[][] {
    const origins: number[][] = [];
    for (let r = 0; r < 8; r++) {
        origins[r] = new Array(COLS).fill(NaN);
    }
    return origins;
}

/** A fade-only match sequence for test use. */
function makeFadeSequence() {
    return createSequence([{ name: 'fade', startMs: 0, durationMs: 250 }] as const);
}

/** A drag on the board: pressed at, moved to and let go over pixel positions, as the view passes them on in cells. */
function press(vm: PiecesViewModel, x: number, y: number): void {
    vm.gestures.press(x / CELL_WIDTH, y / CELL_HEIGHT);
}

function moveTo(vm: PiecesViewModel, x: number, y: number): void {
    vm.gestures.move(x / CELL_WIDTH, y / CELL_HEIGHT);
}

/** The model's side of a swap, as stand-in options: it takes up every swap asked for, until `finishSwap`. */
function takeUpSwaps() {
    let swap: readonly [CactusCell, CactusCell] | undefined;
    return {
        phase: (): BoardPhase => (swap === undefined ? 'idle' : 'swapping'),
        swapCell1: () => swap?.[0],
        swapCell2: () => swap?.[1],
        onSwapRequested: (origin: CactusCell, target: CactusCell) => {
            swap = [origin, target];
        },
        finishSwap: () => {
            swap = undefined;
        },
    };
}

/** Build options with sensible defaults and controlled overrides. */
function makeOptions(overrides?: Partial<PiecesViewModelOptions>): PiecesViewModelOptions {
    const cells = fullGrid();
    return {
        phase: () => 'idle',
        cells: () => cells,
        swapCell1: () => undefined,
        swapCell2: () => undefined,
        swapProgress: () => 0,
        settleProgress: () => 0,
        settleOriginRows: emptySettleOrigins,
        matchedCells: () => [],
        matchSequence: makeFadeSequence,
        canSwap: (origin, target) => Math.abs(origin.row - target.row) + Math.abs(origin.col - target.col) === 1,
        onSwapRequested: () => undefined,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PiecesViewModel', () => {
    describe('idle grid positions', () => {
        it('returns grid-centred positions for each cell', () => {
            const cells = fullGrid();
            const vm = createPiecesViewModel(makeOptions({ cells: () => cells }));
            vm.update(0);

            expect(vm.xFor(cells[0][0])).toBe(gridX(0));
            expect(vm.yFor(cells[0][0])).toBe(gridY(0));
            expect(vm.xFor(cells[3][5])).toBe(gridX(5));
            expect(vm.yFor(cells[3][5])).toBe(gridY(3));
        });

        it('returns full alpha for alive, non-matched cells', () => {
            const cells = fullGrid();
            const vm = createPiecesViewModel(makeOptions({ cells: () => cells }));
            expect(vm.alphaFor(cells[0][0])).toBe(1);
        });
    });

    describe('drag interaction', () => {
        it('dragOriginCell is undefined when no drag is active', () => {
            const vm = createPiecesViewModel(makeOptions());
            vm.update(0);
            expect(vm.dragOriginCell).toBeUndefined();
        });

        it('tracks drag origin cell during an active drag', () => {
            const cells = fullGrid();
            const vm = createPiecesViewModel(makeOptions({ cells: () => cells }));
            vm.update(0);

            press(vm, gridX(2), gridY(3));
            vm.update(0);

            expect(vm.dragOriginCell).toBe(cells[3][2]);
        });

        it('moves the dragged cell to the pointer position', () => {
            const cells = fullGrid();
            const vm = createPiecesViewModel(makeOptions({ cells: () => cells }));
            vm.update(0);

            press(vm, gridX(2), gridY(3));
            moveTo(vm, 100, 150);
            vm.update(0);

            const originCell = cells[3][2];
            expect(vm.xFor(originCell)).toBeCloseTo(100);
            expect(vm.yFor(originCell)).toBeCloseTo(150);
        });

        it('ignores pointer down when not idle', () => {
            const vm = createPiecesViewModel(makeOptions({
                phase: () => 'matching',
            }));
            vm.update(0);

            press(vm, gridX(2), gridY(3));
            vm.update(0);

            expect(vm.dragOriginCell).toBeUndefined();
        });

        it('clears drag origin after pointer up', () => {
            const cells = fullGrid();
            const vm = createPiecesViewModel(makeOptions({ cells: () => cells }));
            vm.update(0);

            press(vm, gridX(2), gridY(3));
            vm.update(0);
            expect(vm.dragOriginCell).toBe(cells[3][2]);

            vm.gestures.release();
            vm.update(0);
            expect(vm.dragOriginCell).toBeUndefined();
        });

        it('calls onSwapRequested when drag commits to a neighbour', () => {
            let capturedOrigin: CactusCell | undefined;
            let capturedTarget: CactusCell | undefined;
            const onSwapRequested = vi.fn((origin: CactusCell, target: CactusCell) => {
                capturedOrigin = origin;
                capturedTarget = target;
            });
            const vm = createPiecesViewModel(makeOptions({ onSwapRequested }));
            vm.update(0);

            // Drag from (3,2) to neighbour (3,3)
            press(vm, gridX(2), gridY(3));
            moveTo(vm, gridX(3), gridY(3));
            vm.gestures.release();

            expect(onSwapRequested).toHaveBeenCalledOnce();
            expect(capturedOrigin).toMatchObject({ col: 2, row: 3 });
            expect(capturedTarget).toMatchObject({ col: 3, row: 3 });
        });

        it('asks for no swap when a drag is cancelled, or let go over a cell the model could not swap with', () => {
            const onSwapRequested = vi.fn();
            const cells = fullGrid();
            const blocked = cells[3][3];
            const vm = createPiecesViewModel(makeOptions({
                cells: () => cells,
                canSwap: (_origin, target) => target !== blocked,
                onSwapRequested,
            }));
            vm.update(0);

            press(vm, gridX(2), gridY(3));
            moveTo(vm, gridX(2), gridY(4));
            vm.gestures.cancel();
            press(vm, gridX(2), gridY(3));
            moveTo(vm, gridX(3), gridY(3));
            vm.update(0);
            // The cell blocked stays where it is, rather than sliding towards the one dragged
            expect(vm.xFor(blocked)).toBe(gridX(3));
            vm.gestures.release();

            expect(onSwapRequested).not.toHaveBeenCalled();
        });

        it('lets the pieces go back when the model turns down the swap asked for', () => {
            const cells = fullGrid();
            const vm = createPiecesViewModel(makeOptions({ cells: () => cells }));
            vm.update(0);

            press(vm, gridX(2), gridY(3));
            moveTo(vm, gridX(3), gridY(3));
            vm.update(0);
            vm.gestures.release();
            vm.update(0);

            expect(vm.dragOriginCell).toBeUndefined();
            expect(vm.xFor(cells[3][2])).toBe(gridX(2));
        });
    });

    describe('committed swap', () => {
        it('holds cells at swapped visual positions during swapping phase', () => {
            const cells = fullGrid();
            const vm = createPiecesViewModel(makeOptions({ cells: () => cells, ...takeUpSwaps() }));
            vm.update(0);

            // Commit a swap from (3,2) to (3,3)
            press(vm, gridX(2), gridY(3));
            moveTo(vm, gridX(3), gridY(3));
            vm.gestures.release();
            vm.update(0);

            // During 'swapping', origin cell renders at target position
            const originCell = cells[3][2];
            expect(vm.xFor(originCell)).toBe(gridX(3));
            expect(vm.yFor(originCell)).toBe(gridY(3));
        });

        it('clears committed swap when phase leaves swapping', () => {
            const cells = fullGrid();
            const swaps = takeUpSwaps();
            const vm = createPiecesViewModel(makeOptions({ cells: () => cells, ...swaps }));
            vm.update(0);

            press(vm, gridX(2), gridY(3));
            moveTo(vm, gridX(3), gridY(3));
            vm.gestures.release();
            vm.update(0);
            expect(vm.dragOriginCell).toBe(cells[3][2]);

            // Phase transitions away from swapping
            swaps.finishSwap();
            vm.update(0);
            expect(vm.dragOriginCell).toBeUndefined();
        });
    });

    describe('swap/reverse interpolation', () => {
        it('interpolates cell X between swap positions during swapping', () => {
            let progress = 0;
            const cells = fullGrid();
            const c1 = cells[3][2];
            const c2 = cells[3][3];
            const vm = createPiecesViewModel(makeOptions({
                cells: () => cells,
                phase: () => 'swapping',
                swapCell1: () => c1,
                swapCell2: () => c2,
                swapProgress: () => progress,
            }));
            vm.update(0);

            // At progress 0, cell 1 is at its own position
            expect(vm.xFor(c1)).toBe(gridX(2));
            expect(vm.xFor(c2)).toBe(gridX(3));

            // At progress 1, cell 1 is at cell 2's position
            progress = 1;
            expect(vm.xFor(c1)).toBeCloseTo(gridX(3), 0);
            expect(vm.xFor(c2)).toBeCloseTo(gridX(2), 0);
        });

        it('interpolates in reverse during reversing phase', () => {
            let progress = 0;
            const cells = fullGrid();
            const c1 = cells[3][2];
            const c2 = cells[3][3];
            const vm = createPiecesViewModel(makeOptions({
                cells: () => cells,
                phase: () => 'reversing',
                swapCell1: () => c1,
                swapCell2: () => c2,
                swapProgress: () => progress,
            }));
            vm.update(0);

            // At progress 0, cell 1 starts at the swapped position (cell 2's spot)
            expect(vm.xFor(c1)).toBeCloseTo(gridX(3), 0);

            // At progress 1, cell 1 returns to its own position
            progress = 1;
            expect(vm.xFor(c1)).toBeCloseTo(gridX(2), 0);
        });
    });

    describe('match fade alpha', () => {
        it('returns 0 for empty cells', () => {
            const cells = fullGrid();
            cells[0][0] = EMPTY_CELL;
            const vm = createPiecesViewModel(makeOptions({ cells: () => cells }));

            expect(vm.alphaFor(cells[0][0])).toBe(0);
        });

        it('fades matched cells based on sequence progress', () => {
            const cells = fullGrid();
            const seq = makeFadeSequence();
            const vm = createPiecesViewModel(makeOptions({
                cells: () => cells,
                matchedCells: () => [cells[0][0]],
                matchSequence: () => seq,
            }));

            seq.start();
            // Half-way through the 250ms fade
            seq.update(125);
            vm.update(0);

            const alpha = vm.alphaFor(cells[0][0]);
            expect(alpha).toBeGreaterThan(0);
            expect(alpha).toBeLessThan(1);
        });

        it('returns 0 for matched cells after sequence completes', () => {
            const cells = fullGrid();
            const seq = makeFadeSequence();
            const vm = createPiecesViewModel(makeOptions({
                cells: () => cells,
                matchedCells: () => [cells[0][0]],
                matchSequence: () => seq,
            }));

            seq.start();
            seq.update(300); // past 250ms duration
            vm.update(0);

            expect(vm.alphaFor(cells[0][0])).toBe(0);
        });

        it('returns 1 for non-matched alive cells', () => {
            const cells = fullGrid();
            const seq = makeFadeSequence();
            seq.start();
            seq.update(125);

            const vm = createPiecesViewModel(makeOptions({
                cells: () => cells,
                matchedCells: () => [cells[0][0]],
                matchSequence: () => seq,
            }));
            vm.update(0);

            // Cell 1 is not matched
            expect(vm.alphaFor(cells[0][1])).toBe(1);
        });
    });

    describe('settling interpolation', () => {
        it('interpolates falling cells toward their target row', () => {
            const cells = fullGrid();
            const settleOrigins = emptySettleOrigins();
            // Cell at (2,0) fell from row 0
            settleOrigins[2][0] = 0;
            const targetCell = cells[2][0];

            let progress = 0;
            const vm = createPiecesViewModel(makeOptions({
                phase: () => 'settling',
                cells: () => cells,
                settleProgress: () => progress,
                settleOriginRows: () => settleOrigins,
            }));

            vm.update(0); // caches settleMaxDist

            // At progress 0, cell is at its origin row
            expect(vm.yFor(targetCell)).toBe(gridY(0));

            // At progress 1, cell reaches its target row (with bounce easing)
            progress = 1;
            vm.update(0);
            expect(vm.yFor(targetCell)).toBeCloseTo(gridY(2), 0);
        });
    });
});

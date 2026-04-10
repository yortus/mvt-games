import { describe, it, expect, vi } from 'vitest';
import { createSequence } from '#common';
import { EMPTY_CELL, type CactusCell } from '../../models';
import { createPiecesViewModel, type PiecesViewModelOptions } from './pieces-view-model';

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

/** Build options with sensible defaults and controlled overrides. */
function makeOptions(overrides?: Partial<PiecesViewModelOptions>): PiecesViewModelOptions {
    const cells = fullGrid();
    return {
        getPhase: () => 'idle',
        getCells: () => cells,
        getSwapCell1: () => undefined,
        getSwapCell2: () => undefined,
        getSwapProgress: () => 0,
        getSettleProgress: () => 0,
        getSettleOriginRows: emptySettleOrigins,
        getMatchedCells: () => [],
        getMatchSequence: makeFadeSequence,
        onSwapRequested: () => true,
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
            const vm = createPiecesViewModel(makeOptions({ getCells: () => cells }));
            vm.update(0);

            expect(vm.getCellX(cells[0][0])).toBe(gridX(0));
            expect(vm.getCellY(cells[0][0])).toBe(gridY(0));
            expect(vm.getCellX(cells[3][5])).toBe(gridX(5));
            expect(vm.getCellY(cells[3][5])).toBe(gridY(3));
        });

        it('returns full alpha for alive, non-matched cells', () => {
            const cells = fullGrid();
            const vm = createPiecesViewModel(makeOptions({ getCells: () => cells }));
            expect(vm.getCellAlpha(cells[0][0])).toBe(1);
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
            const vm = createPiecesViewModel(makeOptions({ getCells: () => cells }));
            vm.update(0);

            vm.startDrag(gridX(2), gridY(3));
            vm.update(0);

            expect(vm.dragOriginCell).toBe(cells[3][2]);
        });

        it('moves the dragged cell to the pointer position', () => {
            const cells = fullGrid();
            const vm = createPiecesViewModel(makeOptions({ getCells: () => cells }));
            vm.update(0);

            vm.startDrag(gridX(2), gridY(3));
            vm.dragTo(100, 150);
            vm.update(0);

            const originCell = cells[3][2];
            expect(vm.getCellX(originCell)).toBe(100);
            expect(vm.getCellY(originCell)).toBe(150);
        });

        it('ignores pointer down when not idle', () => {
            const vm = createPiecesViewModel(makeOptions({
                getPhase: () => 'matching',
            }));
            vm.update(0);

            vm.startDrag(gridX(2), gridY(3));
            vm.update(0);

            expect(vm.dragOriginCell).toBeUndefined();
        });

        it('clears drag origin after pointer up', () => {
            const cells = fullGrid();
            const vm = createPiecesViewModel(makeOptions({ getCells: () => cells }));
            vm.update(0);

            vm.startDrag(gridX(2), gridY(3));
            vm.update(0);
            expect(vm.dragOriginCell).toBe(cells[3][2]);

            vm.endDrag();
            vm.update(0);
            expect(vm.dragOriginCell).toBeUndefined();
        });

        it('calls onSwapRequested when drag commits to a neighbour', () => {
            let capturedOrigin: CactusCell | undefined;
            let capturedTarget: CactusCell | undefined;
            const onSwapRequested = vi.fn((origin: CactusCell, target: CactusCell) => {
                capturedOrigin = origin;
                capturedTarget = target;
                return true;
            });
            const vm = createPiecesViewModel(makeOptions({ onSwapRequested }));
            vm.update(0);

            // Drag from (3,2) to neighbour (3,3)
            vm.startDrag(gridX(2), gridY(3));
            vm.dragTo(gridX(3), gridY(3));
            vm.endDrag();

            expect(onSwapRequested).toHaveBeenCalledOnce();
            expect(capturedOrigin).toMatchObject({ col: 2, row: 3 });
            expect(capturedTarget).toMatchObject({ col: 3, row: 3 });
        });
    });

    describe('committed swap', () => {
        it('holds cells at swapped visual positions during swapping phase', () => {
            let phase: 'idle' | 'swapping' = 'idle';
            const onSwapRequested = vi.fn(() => {
                phase = 'swapping';
                return true;
            });
            const cells = fullGrid();

            const vm = createPiecesViewModel(makeOptions({
                getCells: () => cells,
                getPhase: () => phase,
                onSwapRequested,
            }));
            vm.update(0);

            // Commit a swap from (3,2) to (3,3)
            vm.startDrag(gridX(2), gridY(3));
            vm.dragTo(gridX(3), gridY(3));
            vm.endDrag();
            vm.update(0);

            // During 'swapping', origin cell renders at target position
            const originCell = cells[3][2];
            expect(vm.getCellX(originCell)).toBe(gridX(3));
            expect(vm.getCellY(originCell)).toBe(gridY(3));
        });

        it('clears committed swap when phase leaves swapping', () => {
            let phase: 'idle' | 'swapping' = 'idle';
            const onSwapRequested = vi.fn(() => {
                phase = 'swapping';
                return true;
            });
            const cells = fullGrid();

            const vm = createPiecesViewModel(makeOptions({
                getCells: () => cells,
                getPhase: () => phase,
                onSwapRequested,
            }));
            vm.update(0);

            vm.startDrag(gridX(2), gridY(3));
            vm.dragTo(gridX(3), gridY(3));
            vm.endDrag();
            vm.update(0);
            expect(vm.dragOriginCell).toBe(cells[3][2]);

            // Phase transitions away from swapping
            phase = 'idle';
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
                getCells: () => cells,
                getPhase: () => 'swapping',
                getSwapCell1: () => c1,
                getSwapCell2: () => c2,
                getSwapProgress: () => progress,
            }));
            vm.update(0);

            // At progress 0, cell 1 is at its own position
            expect(vm.getCellX(c1)).toBe(gridX(2));
            expect(vm.getCellX(c2)).toBe(gridX(3));

            // At progress 1, cell 1 is at cell 2's position
            progress = 1;
            expect(vm.getCellX(c1)).toBeCloseTo(gridX(3), 0);
            expect(vm.getCellX(c2)).toBeCloseTo(gridX(2), 0);
        });

        it('interpolates in reverse during reversing phase', () => {
            let progress = 0;
            const cells = fullGrid();
            const c1 = cells[3][2];
            const c2 = cells[3][3];
            const vm = createPiecesViewModel(makeOptions({
                getCells: () => cells,
                getPhase: () => 'reversing',
                getSwapCell1: () => c1,
                getSwapCell2: () => c2,
                getSwapProgress: () => progress,
            }));
            vm.update(0);

            // At progress 0, cell 1 starts at the swapped position (cell 2's spot)
            expect(vm.getCellX(c1)).toBeCloseTo(gridX(3), 0);

            // At progress 1, cell 1 returns to its own position
            progress = 1;
            expect(vm.getCellX(c1)).toBeCloseTo(gridX(2), 0);
        });
    });

    describe('match fade alpha', () => {
        it('returns 0 for empty cells', () => {
            const cells = fullGrid();
            cells[0][0] = EMPTY_CELL;
            const vm = createPiecesViewModel(makeOptions({ getCells: () => cells }));

            expect(vm.getCellAlpha(cells[0][0])).toBe(0);
        });

        it('fades matched cells based on sequence progress', () => {
            const cells = fullGrid();
            const seq = makeFadeSequence();
            const vm = createPiecesViewModel(makeOptions({
                getCells: () => cells,
                getMatchedCells: () => [cells[0][0]],
                getMatchSequence: () => seq,
            }));

            seq.start();
            // Half-way through the 250ms fade
            seq.update(125);
            vm.update(0);

            const alpha = vm.getCellAlpha(cells[0][0]);
            expect(alpha).toBeGreaterThan(0);
            expect(alpha).toBeLessThan(1);
        });

        it('returns 0 for matched cells after sequence completes', () => {
            const cells = fullGrid();
            const seq = makeFadeSequence();
            const vm = createPiecesViewModel(makeOptions({
                getCells: () => cells,
                getMatchedCells: () => [cells[0][0]],
                getMatchSequence: () => seq,
            }));

            seq.start();
            seq.update(300); // past 250ms duration
            vm.update(0);

            expect(vm.getCellAlpha(cells[0][0])).toBe(0);
        });

        it('returns 1 for non-matched alive cells', () => {
            const cells = fullGrid();
            const seq = makeFadeSequence();
            seq.start();
            seq.update(125);

            const vm = createPiecesViewModel(makeOptions({
                getCells: () => cells,
                getMatchedCells: () => [cells[0][0]],
                getMatchSequence: () => seq,
            }));
            vm.update(0);

            // Cell 1 is not matched
            expect(vm.getCellAlpha(cells[0][1])).toBe(1);
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
                getPhase: () => 'settling',
                getCells: () => cells,
                getSettleProgress: () => progress,
                getSettleOriginRows: () => settleOrigins,
            }));

            vm.update(0); // caches settleMaxDist

            // At progress 0, cell is at its origin row
            expect(vm.getCellY(targetCell)).toBe(gridY(0));

            // At progress 1, cell reaches its target row (with bounce easing)
            progress = 1;
            vm.update(0);
            expect(vm.getCellY(targetCell)).toBeCloseTo(gridY(2), 0);
        });
    });
});

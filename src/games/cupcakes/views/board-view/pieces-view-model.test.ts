import { describe, it, expect, vi } from 'vitest';
import { createSequence } from '#common';
import { createPiecesViewModel, type PiecesViewModelOptions } from './pieces-view-model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CELL_SIZE = 40;
const COLS = 8;

/** Centre pixel position for a grid cell. */
function gridX(col: number): number {
    return col * CELL_SIZE + CELL_SIZE * 0.5;
}

function gridY(row: number): number {
    return row * CELL_SIZE + CELL_SIZE * 0.5;
}

/** Flat index for (row, col). */
function cellIndex(row: number, col: number): number {
    return row * COLS + col;
}

/** A single cell at the given position. */
function cell(row: number, col: number, isAlive = true) {
    return { kind: 'strawberry' as const, pos: { row, col }, isAlive };
}

/** Build a full 8x8 grid of alive cells. */
function fullGrid() {
    const cells = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < COLS; c++) {
            cells.push(cell(r, c));
        }
    }
    return cells;
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
        getSwapPos1: () => ({ col: 0, row: 0 }),
        getSwapPos2: () => ({ col: 1, row: 0 }),
        getSwapProgress: () => 0,
        getSettleOrigins: () => [],
        getSettleProgress: () => 0,
        getMatchedIndices: () => [],
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
            const vm = createPiecesViewModel(makeOptions());
            vm.update(0);

            expect(vm.getCellX(cellIndex(0, 0))).toBe(gridX(0));
            expect(vm.getCellY(cellIndex(0, 0))).toBe(gridY(0));
            expect(vm.getCellX(cellIndex(3, 5))).toBe(gridX(5));
            expect(vm.getCellY(cellIndex(3, 5))).toBe(gridY(3));
        });

        it('returns full alpha for alive, non-matched cells', () => {
            const vm = createPiecesViewModel(makeOptions());
            expect(vm.getCellAlpha(cellIndex(0, 0))).toBe(1);
        });
    });

    describe('drag interaction', () => {
        it('dragOriginIndex is -1 when no drag is active', () => {
            const vm = createPiecesViewModel(makeOptions());
            vm.update(0);
            expect(vm.dragOriginIndex).toBe(-1);
        });

        it('tracks drag origin index during an active drag', () => {
            const vm = createPiecesViewModel(makeOptions());
            vm.update(0);

            vm.startDrag(gridX(2), gridY(3));
            vm.update(0);

            expect(vm.dragOriginIndex).toBe(cellIndex(3, 2));
        });

        it('moves the dragged cell to the pointer position', () => {
            const vm = createPiecesViewModel(makeOptions());
            vm.update(0);

            vm.startDrag(gridX(2), gridY(3));
            vm.dragTo(100, 150);
            vm.update(0);

            const index = cellIndex(3, 2);
            expect(vm.getCellX(index)).toBe(100);
            expect(vm.getCellY(index)).toBe(150);
        });

        it('ignores pointer down when not idle', () => {
            const vm = createPiecesViewModel(makeOptions({
                getPhase: () => 'matching',
            }));
            vm.update(0);

            vm.startDrag(gridX(2), gridY(3));
            vm.update(0);

            expect(vm.dragOriginIndex).toBe(-1);
        });

        it('clears drag origin after pointer up', () => {
            const vm = createPiecesViewModel(makeOptions());
            vm.update(0);

            vm.startDrag(gridX(2), gridY(3));
            vm.update(0);
            expect(vm.dragOriginIndex).toBe(cellIndex(3, 2));

            vm.endDrag();
            vm.update(0);
            expect(vm.dragOriginIndex).toBe(-1);
        });

        it('calls onSwapRequested when drag commits to a neighbour', () => {
            let capturedOrigin: { col: number; row: number } | undefined;
            let capturedTarget: { col: number; row: number } | undefined;
            const onSwapRequested = vi.fn((origin: { col: number; row: number }, target: { col: number; row: number }) => {
                capturedOrigin = { ...origin };
                capturedTarget = { ...target };
                return true;
            });
            const vm = createPiecesViewModel(makeOptions({ onSwapRequested }));
            vm.update(0);

            // Drag from (3,2) to neighbour (3,3)
            vm.startDrag(gridX(2), gridY(3));
            vm.dragTo(gridX(3), gridY(3));
            vm.endDrag();

            expect(onSwapRequested).toHaveBeenCalledOnce();
            expect(capturedOrigin).toEqual({ col: 2, row: 3 });
            expect(capturedTarget).toEqual({ col: 3, row: 3 });
        });
    });

    describe('committed swap', () => {
        it('holds cells at swapped visual positions during swapping phase', () => {
            let phase: 'idle' | 'swapping' = 'idle';
            const onSwapRequested = vi.fn(() => {
                phase = 'swapping';
                return true;
            });

            const vm = createPiecesViewModel(makeOptions({
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
            const originIndex = cellIndex(3, 2);
            expect(vm.getCellX(originIndex)).toBe(gridX(3));
            expect(vm.getCellY(originIndex)).toBe(gridY(3));
        });

        it('clears committed swap when phase leaves swapping', () => {
            let phase: 'idle' | 'swapping' = 'idle';
            const onSwapRequested = vi.fn(() => {
                phase = 'swapping';
                return true;
            });

            const vm = createPiecesViewModel(makeOptions({
                getPhase: () => phase,
                onSwapRequested,
            }));
            vm.update(0);

            vm.startDrag(gridX(2), gridY(3));
            vm.dragTo(gridX(3), gridY(3));
            vm.endDrag();
            vm.update(0);
            expect(vm.dragOriginIndex).toBe(cellIndex(3, 2));

            // Phase transitions away from swapping
            phase = 'idle';
            vm.update(0);
            expect(vm.dragOriginIndex).toBe(-1);
        });
    });

    describe('swap/reverse interpolation', () => {
        it('interpolates cell X between swap positions during swapping', () => {
            let progress = 0;
            const vm = createPiecesViewModel(makeOptions({
                getPhase: () => 'swapping',
                getSwapPos1: () => ({ col: 2, row: 3 }),
                getSwapPos2: () => ({ col: 3, row: 3 }),
                getSwapProgress: () => progress,
            }));
            vm.update(0);

            const i1 = cellIndex(3, 2);
            const i2 = cellIndex(3, 3);

            // At progress 0, cell 1 is at its own position
            expect(vm.getCellX(i1)).toBe(gridX(2));
            expect(vm.getCellX(i2)).toBe(gridX(3));

            // At progress 1, cell 1 is at cell 2's position
            progress = 1;
            expect(vm.getCellX(i1)).toBeCloseTo(gridX(3), 0);
            expect(vm.getCellX(i2)).toBeCloseTo(gridX(2), 0);
        });

        it('interpolates in reverse during reversing phase', () => {
            let progress = 0;
            const vm = createPiecesViewModel(makeOptions({
                getPhase: () => 'reversing',
                getSwapPos1: () => ({ col: 2, row: 3 }),
                getSwapPos2: () => ({ col: 3, row: 3 }),
                getSwapProgress: () => progress,
            }));
            vm.update(0);

            const i1 = cellIndex(3, 2);

            // At progress 0, cell 1 starts at the swapped position (cell 2's spot)
            expect(vm.getCellX(i1)).toBeCloseTo(gridX(3), 0);

            // At progress 1, cell 1 returns to its own position
            progress = 1;
            expect(vm.getCellX(i1)).toBeCloseTo(gridX(2), 0);
        });
    });

    describe('match fade alpha', () => {
        it('returns 0 for dead cells', () => {
            const cells = fullGrid();
            cells[0] = cell(0, 0, false);
            const vm = createPiecesViewModel(makeOptions({ getCells: () => cells }));

            expect(vm.getCellAlpha(0)).toBe(0);
        });

        it('fades matched cells based on sequence progress', () => {
            const seq = makeFadeSequence();
            const vm = createPiecesViewModel(makeOptions({
                getMatchedIndices: () => [0],
                getMatchSequence: () => seq,
            }));

            seq.start();
            // Half-way through the 250ms fade
            seq.update(125);

            const alpha = vm.getCellAlpha(0);
            expect(alpha).toBeGreaterThan(0);
            expect(alpha).toBeLessThan(1);
        });

        it('returns 0 for matched cells after sequence completes', () => {
            const seq = makeFadeSequence();
            const vm = createPiecesViewModel(makeOptions({
                getMatchedIndices: () => [0],
                getMatchSequence: () => seq,
            }));

            seq.start();
            seq.update(300); // past 250ms duration

            expect(vm.getCellAlpha(0)).toBe(0);
        });

        it('returns 1 for non-matched alive cells', () => {
            const seq = makeFadeSequence();
            seq.start();
            seq.update(125);

            const vm = createPiecesViewModel(makeOptions({
                getMatchedIndices: () => [0],
                getMatchSequence: () => seq,
            }));

            // Cell 1 is not matched
            expect(vm.getCellAlpha(1)).toBe(1);
        });
    });

    describe('settling interpolation', () => {
        it('interpolates falling cells toward their target row', () => {
            const cells = fullGrid();
            // Cell at (2,0) fell from row 0
            const settleOrigins = new Array(64).fill(NaN);
            settleOrigins[cellIndex(2, 0)] = 0; // fell from row 0 to row 2

            let progress = 0;
            const vm = createPiecesViewModel(makeOptions({
                getPhase: () => 'settling',
                getCells: () => cells,
                getSettleOrigins: () => settleOrigins,
                getSettleProgress: () => progress,
            }));

            vm.update(0); // caches settleMaxDist

            const index = cellIndex(2, 0);

            // At progress 0, cell is at its origin row
            expect(vm.getCellY(index)).toBe(gridY(0));

            // At progress 1, cell reaches its target row (with bounce easing)
            progress = 1;
            vm.update(0);
            expect(vm.getCellY(index)).toBeCloseTo(gridY(2), 0);
        });
    });
});

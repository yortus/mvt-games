import { describe, it, expect } from 'vitest';
import { createBoardModel } from './board-model';
import type { BoardModel } from './board-model';
import type { CactusCell } from './common';
import { EMPTY_CELL } from './common';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stepMs(model: { update(deltaMs: number): void }, totalMs: number): void {
    const step = 16;
    let remaining = totalMs;
    while (remaining > 0) {
        const dt = Math.min(step, remaining);
        model.update(dt);
        remaining -= dt;
    }
}

/** Create a small 3x3 board for testing. */
function makeBoard(rowCount = 3, colCount = 3): BoardModel {
    return createBoardModel({ rowCount, colCount });
}

/** Find two adjacent cells with different kinds that can be swapped. */
function findSwappablePair(board: BoardModel): [CactusCell, CactusCell] | undefined {
    for (let r = 0; r < board.rowCount; r++) {
        for (let c = 0; c < board.colCount - 1; c++) {
            const cell1 = board.cells[r][c];
            const cell2 = board.cells[r][c + 1];
            if (cell1 !== EMPTY_CELL && cell2 !== EMPTY_CELL
                && cell1.kind !== cell2.kind) {
                return [cell1, cell2];
            }
        }
    }
    return undefined;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BoardModel', () => {
    describe('initial state', () => {
        it('starts in idle phase', () => {
            const board = makeBoard();
            expect(board.phase).toBe('idle');
        });

        it('has integer cell positions', () => {
            const board = makeBoard();
            for (let r = 0; r < board.cells.length; r++) {
                for (let c = 0; c < board.cells[r].length; c++) {
                    const cell = board.cells[r][c];
                    expect(Number.isInteger(cell.row)).toBe(true);
                    expect(Number.isInteger(cell.col)).toBe(true);
                }
            }
        });

        it('all progress values are 0 when idle', () => {
            const board = makeBoard();
            expect(board.swapProgress).toBe(0);
            expect(board.matchProgress).toBe(0);
            expect(board.settleProgress).toBe(0);
        });

        it('matchedCells is empty when idle', () => {
            const board = makeBoard();
            expect(board.matchedCells).toEqual([]);
        });

        it('settleOriginRows are all NaN when idle', () => {
            const board = makeBoard();
            for (let r = 0; r < board.settleOriginRows.length; r++) {
                for (let c = 0; c < board.settleOriginRows[r].length; c++) {
                    expect(board.settleOriginRows[r][c]).toBeNaN();
                }
            }
        });

        it('has no EMPTY_CELL entries after initialisation', () => {
            const board = makeBoard();
            for (let r = 0; r < board.cells.length; r++) {
                for (let c = 0; c < board.cells[r].length; c++) {
                    expect(board.cells[r][c]).not.toBe(EMPTY_CELL);
                }
            }
        });
    });

    describe('trySwap', () => {
        it('rejects swap when not idle', () => {
            const board = makeBoard();
            const pair = findSwappablePair(board);
            expect(pair).toBeDefined();
            const [c1, c2] = pair!;
            expect(board.trySwap(c1, c2)).toBe(true);
            expect(board.phase).not.toBe('idle');

            // Second swap should be rejected (board not idle)
            expect(board.trySwap(c1, c2)).toBe(false);
        });

        it('rejects non-adjacent cells', () => {
            const board = makeBoard();
            const cell1 = board.cells[0][0];
            const cell2 = board.cells[2][2];
            expect(board.trySwap(cell1, cell2)).toBe(false);
        });

        it('rejects EMPTY_CELL', () => {
            const board = makeBoard();
            expect(board.trySwap(EMPTY_CELL, board.cells[0][0])).toBe(false);
            expect(board.trySwap(board.cells[0][0], EMPTY_CELL)).toBe(false);
        });
    });

    describe('swapping phase', () => {
        it('enters swapping phase on successful trySwap', () => {
            const board = makeBoard();
            const pair = findSwappablePair(board);
            expect(pair).toBeDefined();
            board.trySwap(pair![0], pair![1]);
            expect(board.phase).toBe('swapping');
        });

        it('exposes swapCell1 and swapCell2', () => {
            const board = makeBoard();
            const pair = findSwappablePair(board);
            expect(pair).toBeDefined();
            const [c1, c2] = pair!;
            board.trySwap(c1, c2);
            expect(board.swapCell1).toBe(c1);
            expect(board.swapCell2).toBe(c2);
        });

        it('swapProgress advances linearly from 0 toward 1', () => {
            const board = makeBoard();
            const pair = findSwappablePair(board);
            expect(pair).toBeDefined();
            board.trySwap(pair![0], pair![1]);

            expect(board.swapProgress).toBe(0);
            board.update(50); // partial step (SWAP_DURATION_MS = 200)
            expect(board.swapProgress).toBeGreaterThan(0);
            expect(board.swapProgress).toBeLessThan(1);
        });

        it('cell positions remain integer during swap', () => {
            const board = makeBoard();
            const pair = findSwappablePair(board);
            expect(pair).toBeDefined();
            board.trySwap(pair![0], pair![1]);
            board.update(50);

            for (let i = 0; i < board.cells.length; i++) {
                for (let j = 0; j < board.cells[i].length; j++) {
                    expect(Number.isInteger(board.cells[i][j].row)).toBe(true);
                    expect(Number.isInteger(board.cells[i][j].col)).toBe(true);
                }
            }
        });
    });

    describe('phase transitions', () => {
        it('transitions from swapping to matching or reversing', () => {
            const board = makeBoard();
            const pair = findSwappablePair(board);
            expect(pair).toBeDefined();
            board.trySwap(pair![0], pair![1]);
            stepMs(board, 300); // well past SWAP_DURATION_MS (200ms)

            const phase = board.phase;
            expect(['matching', 'reversing']).toContain(phase);
        });

        it('reversal returns to idle after completion', () => {
            const board = makeBoard(4, 4);
            // Try swaps until we get a reversal (no match)
            let reversed = false;
            for (let r = 0; r < board.rowCount && !reversed; r++) {
                for (let c = 0; c < board.colCount - 1 && !reversed; c++) {
                    const cell1 = board.cells[r][c];
                    const cell2 = board.cells[r][c + 1];
                    if (!board.trySwap(cell1, cell2)) continue;
                    stepMs(board, 300);
                    if (board.phase === 'reversing') {
                        reversed = true;
                        stepMs(board, 300);
                        expect(board.phase).toBe('idle');
                    }
                    else {
                        // It matched - run to idle
                        stepMs(board, 5000);
                    }
                }
            }
        });

        it('swapProgress is 0 outside swap/reverse phases', () => {
            const board = makeBoard();
            expect(board.swapProgress).toBe(0);
        });

        it('eventually returns to idle after a full cycle', () => {
            const board = makeBoard();
            const pair = findSwappablePair(board);
            expect(pair).toBeDefined();
            board.trySwap(pair![0], pair![1]);
            stepMs(board, 10000); // plenty of time for any cascade
            expect(board.phase).toBe('idle');
        });
    });

    describe('matching phase', () => {
        it('matchProgress is 0 outside matching phase', () => {
            const board = makeBoard();
            expect(board.matchProgress).toBe(0);
        });
    });

    describe('match phase', () => {
        it('matchProgress is 0 when idle', () => {
            const board = makeBoard();
            expect(board.matchProgress).toBe(0);
        });

        it('matchProgress advances during matching phase', () => {
            const board = makeBoard(4, 4);
            const pair = findSwappablePair(board);
            expect(pair).toBeDefined();
            board.trySwap(pair![0], pair![1]);
            stepMs(board, 300); // past swap duration
            if (board.phase === 'matching') {
                board.update(50);
                expect(board.matchProgress).toBeGreaterThan(0);
                expect(board.matchProgress).toBeLessThanOrEqual(1);
            }
        });

        it('matchDurationMs is a positive number', () => {
            const board = makeBoard();
            expect(board.matchDurationMs).toBeGreaterThan(0);
        });

        it('cascadeStep is 0 when idle', () => {
            const board = makeBoard();
            expect(board.cascadeStep).toBe(0);
        });

        it('cascadeStep increments on each match in a cascade', () => {
            const board = makeBoard(4, 4);
            const pair = findSwappablePair(board);
            expect(pair).toBeDefined();
            board.trySwap(pair![0], pair![1]);
            stepMs(board, 300);
            if (board.phase === 'matching') {
                expect(board.cascadeStep).toBeGreaterThanOrEqual(1);
            }
        });
    });

    describe('settling phase', () => {
        it('settleProgress is 0 outside settling phase', () => {
            const board = makeBoard();
            expect(board.settleProgress).toBe(0);
        });

        it('settleOriginRows are all NaN outside settling phase', () => {
            const board = makeBoard();
            for (let r = 0; r < board.settleOriginRows.length; r++) {
                for (let c = 0; c < board.settleOriginRows[r].length; c++) {
                    expect(board.settleOriginRows[r][c]).toBeNaN();
                }
            }
        });
    });

    describe('scoring', () => {
        it('starts at score 0', () => {
            const board = makeBoard();
            expect(board.score).toBe(0);
        });
    });

    describe('update integrity', () => {
        it('does nothing when idle', () => {
            const board = makeBoard();
            const cellsBefore: { row: number; col: number; kind: string }[][] = [];
            for (let r = 0; r < board.cells.length; r++) {
                cellsBefore[r] = board.cells[r].map((cell) => ({ row: cell.row, col: cell.col, kind: cell.kind }));
            }
            board.update(1000);
            for (let r = 0; r < board.cells.length; r++) {
                for (let c = 0; c < board.cells[r].length; c++) {
                    expect(board.cells[r][c].row).toBe(cellsBefore[r][c].row);
                    expect(board.cells[r][c].col).toBe(cellsBefore[r][c].col);
                    expect(board.cells[r][c].kind).toBe(cellsBefore[r][c].kind);
                }
            }
        });
    });
});

import { describe, it, expect } from 'vitest';
import { createBoardModel } from './board-model';
import type { BoardModel } from './board-model';
import type { Position } from './common';

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
function findSwappablePair(board: BoardModel): [Position, Position] | undefined {
    for (let r = 0; r < board.rowCount; r++) {
        for (let c = 0; c < board.colCount - 1; c++) {
            const idx1 = r * board.colCount + c;
            const idx2 = r * board.colCount + c + 1;
            if (board.cells[idx1].isAlive && board.cells[idx2].isAlive &&
                board.cells[idx1].kind !== board.cells[idx2].kind) {
                return [{ row: r, col: c }, { row: r, col: c + 1 }];
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
            for (let i = 0; i < board.cells.length; i++) {
                const cell = board.cells[i];
                expect(Number.isInteger(cell.pos.row)).toBe(true);
                expect(Number.isInteger(cell.pos.col)).toBe(true);
            }
        });

        it('all progress values are 0 when idle', () => {
            const board = makeBoard();
            expect(board.swapProgress).toBe(0);
            expect(board.matchProgress).toBe(0);
            expect(board.settleProgress).toBe(0);
        });

        it('matchedIndices is empty when idle', () => {
            const board = makeBoard();
            expect(board.matchedIndices).toEqual([]);
        });

        it('settleOrigins are all NaN when idle', () => {
            const board = makeBoard();
            for (let i = 0; i < board.settleOrigins.length; i++) {
                expect(board.settleOrigins[i]).toBeNaN();
            }
        });
    });

    describe('trySwap', () => {
        it('rejects swap when not idle', () => {
            const board = makeBoard();
            const pair = findSwappablePair(board);
            expect(pair).toBeDefined();
            const [p1, p2] = pair!;
            expect(board.trySwap(p1, p2)).toBe(true);
            expect(board.phase).not.toBe('idle');

            // Second swap should be rejected
            expect(board.trySwap(p1, p2)).toBe(false);
        });

        it('rejects non-adjacent positions', () => {
            const board = makeBoard();
            expect(board.trySwap({ row: 0, col: 0 }, { row: 2, col: 2 })).toBe(false);
        });

        it('rejects out-of-bounds positions', () => {
            const board = makeBoard();
            expect(board.trySwap({ row: -1, col: 0 }, { row: 0, col: 0 })).toBe(false);
            expect(board.trySwap({ row: 0, col: 0 }, { row: 0, col: 99 })).toBe(false);
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

        it('exposes swapPos1 and swapPos2', () => {
            const board = makeBoard();
            const pair = findSwappablePair(board);
            expect(pair).toBeDefined();
            const [p1, p2] = pair!;
            board.trySwap(p1, p2);
            expect(board.swapPos1).toEqual(p1);
            expect(board.swapPos2).toEqual(p2);
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
                expect(Number.isInteger(board.cells[i].pos.row)).toBe(true);
                expect(Number.isInteger(board.cells[i].pos.col)).toBe(true);
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
                    const p1: Position = { row: r, col: c };
                    const p2: Position = { row: r, col: c + 1 };
                    if (!board.trySwap(p1, p2)) continue;
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

        it('settleOrigins are NaN outside settling phase', () => {
            const board = makeBoard();
            for (let i = 0; i < board.settleOrigins.length; i++) {
                expect(board.settleOrigins[i]).toBeNaN();
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
            const cellsBefore = board.cells.map((c) => ({ ...c.pos, kind: c.kind }));
            board.update(1000);
            for (let i = 0; i < board.cells.length; i++) {
                expect(board.cells[i].pos.row).toBe(cellsBefore[i].row);
                expect(board.cells[i].pos.col).toBe(cellsBefore[i].col);
                expect(board.cells[i].kind).toBe(cellsBefore[i].kind);
            }
        });
    });
});

import { describe, it, expect } from 'vitest';
import { computeCellLayout } from './cell-layout';
import type { BoardSnapshot, DragSnapshot } from './cell-layout';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CELL_SIZE = 64;

function half(n: number): number {
    return n * CELL_SIZE + CELL_SIZE * 0.5;
}

/** Idle board snapshot for a cell at the given row,col. */
function idleBoard(row: number, col: number, colCount = 5): BoardSnapshot {
    return {
        colCount,
        phase: 'idle',
        cellPos: { col, row },
        cellIsAlive: true,
        swapPos1: { row: -1, col: -1 },
        swapPos2: { row: -1, col: -1 },
        swapProgress: 0,
        settleOrigin: NaN,
        settleProgress: 0,
        settleMaxDist: 0,
        matchProgress: 0,
        isMatched: false,
    };
}

/** Inactive drag snapshot (no drag in progress). */
function noDrag(): DragSnapshot {
    return {
        active: false,
        committedSwap: false,
        originIdx: -1,
        candidateIdx: -1,
        pointer: { x: 0, y: 0 },
        origin: { col: 0, row: 0 },
        candidate: { col: 0, row: 0 },
        candidateVisual: { x: 0, y: 0 },
        returningIdx: -1,
        returningVisual: { x: 0, y: 0 },
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeCellLayout', () => {
    describe('default grid position', () => {
        it('places cell at grid center when idle and no drag', () => {
            const layout = computeCellLayout(7, CELL_SIZE, idleBoard(1, 2), noDrag());
            expect(layout.x).toBe(half(2));
            expect(layout.y).toBe(half(1));
        });

        it('returns alpha 1 for alive cell', () => {
            const layout = computeCellLayout(0, CELL_SIZE, idleBoard(0, 0), noDrag());
            expect(layout.alpha).toBe(1);
        });

        it('returns alpha 0 for dead cell', () => {
            const board = idleBoard(0, 0);
            board.cellIsAlive = false;
            const layout = computeCellLayout(0, CELL_SIZE, board, noDrag());
            expect(layout.alpha).toBe(0);
        });

        it('returns zIndex 0 for normal cell', () => {
            const layout = computeCellLayout(0, CELL_SIZE, idleBoard(0, 0), noDrag());
            expect(layout.zIndex).toBe(0);
        });
    });

    describe('committed swap', () => {
        it('swaps visual positions of origin and candidate', () => {
            const colCount = 5;
            // origin at (1,2) idx=7, candidate at (1,3) idx=8
            const drag = noDrag();
            drag.committedSwap = true;
            drag.originIdx = 7;
            drag.candidateIdx = 8;
            drag.origin = { col: 2, row: 1 };
            drag.candidate = { col: 3, row: 1 };

            // Origin cell should appear at candidate's grid position
            const originLayout = computeCellLayout(7, CELL_SIZE, idleBoard(1, 2, colCount), drag);
            expect(originLayout.x).toBe(half(3));
            expect(originLayout.y).toBe(half(1));

            // Candidate cell should appear at origin's grid position
            const candidateLayout = computeCellLayout(8, CELL_SIZE, idleBoard(1, 3, colCount), drag);
            expect(candidateLayout.x).toBe(half(2));
            expect(candidateLayout.y).toBe(half(1));
        });

        it('does not affect unrelated cells', () => {
            const drag = noDrag();
            drag.committedSwap = true;
            drag.originIdx = 7;
            drag.candidateIdx = 8;
            drag.origin = { col: 2, row: 1 };
            drag.candidate = { col: 3, row: 1 };

            const layout = computeCellLayout(0, CELL_SIZE, idleBoard(0, 0), drag);
            expect(layout.x).toBe(half(0));
            expect(layout.y).toBe(half(0));
        });
    });

    describe('active drag: origin follows pointer', () => {
        it('uses pointer position for the dragged cell', () => {
            const drag = noDrag();
            drag.active = true;
            drag.originIdx = 7;
            drag.pointer = { x: 200, y: 150 };

            const layout = computeCellLayout(7, CELL_SIZE, idleBoard(1, 2), drag);
            expect(layout.x).toBe(200);
            expect(layout.y).toBe(150);
        });

        it('gives drag origin zIndex 100', () => {
            const drag = noDrag();
            drag.active = true;
            drag.originIdx = 7;
            drag.pointer = { x: 200, y: 150 };

            const layout = computeCellLayout(7, CELL_SIZE, idleBoard(1, 2), drag);
            expect(layout.zIndex).toBe(100);
        });
    });

    describe('active drag: candidate visual position', () => {
        it('uses tweened visual position for candidate cell', () => {
            const drag = noDrag();
            drag.active = true;
            drag.originIdx = 7;
            drag.candidateIdx = 8;
            drag.candidateVisual = { x: 180, y: 120 };

            const layout = computeCellLayout(8, CELL_SIZE, idleBoard(1, 3), drag);
            expect(layout.x).toBe(180);
            expect(layout.y).toBe(120);
        });
    });

    describe('returning cell', () => {
        it('uses returning visual position', () => {
            const drag = noDrag();
            drag.returningIdx = 5;
            drag.returningVisual = { x: 170, y: 95 };

            const layout = computeCellLayout(5, CELL_SIZE, idleBoard(1, 0), drag);
            expect(layout.x).toBe(170);
            expect(layout.y).toBe(95);
        });
    });

    describe('model swap interpolation', () => {
        it('interpolates x between swap positions at progress 0', () => {
            const colCount = 5;
            const board = idleBoard(1, 2, colCount);
            board.phase = 'swapping';
            board.swapPos1 = { row: 1, col: 2 };
            board.swapPos2 = { row: 1, col: 3 };
            board.swapProgress = 0;

            // idx = 1*5+2 = 7 (pos1)
            const layout = computeCellLayout(7, CELL_SIZE, board, noDrag());
            expect(layout.x).toBe(half(2)); // starts at own position
        });

        it('interpolates x between swap positions at progress 1', () => {
            const colCount = 5;
            const board = idleBoard(1, 2, colCount);
            board.phase = 'swapping';
            board.swapPos1 = { row: 1, col: 2 };
            board.swapPos2 = { row: 1, col: 3 };
            board.swapProgress = 1;

            // idx = 1*5+2 = 7 (pos1) - at progress 1, eased progress is 1
            const layout = computeCellLayout(7, CELL_SIZE, board, noDrag());
            expect(layout.x).toBe(half(3)); // ends at partner position
        });

        it('does not affect un-involved cells during swap', () => {
            const colCount = 5;
            const board = idleBoard(0, 0, colCount);
            board.phase = 'swapping';
            board.swapPos1 = { row: 1, col: 2 };
            board.swapPos2 = { row: 1, col: 3 };
            board.swapProgress = 0.5;

            const layout = computeCellLayout(0, CELL_SIZE, board, noDrag());
            expect(layout.x).toBe(half(0));
            expect(layout.y).toBe(half(0));
        });
    });

    describe('model reverse interpolation', () => {
        it('moves from partner position back toward own position', () => {
            const colCount = 5;
            const board = idleBoard(1, 2, colCount);
            board.phase = 'reversing';
            board.swapPos1 = { row: 1, col: 2 };
            board.swapPos2 = { row: 1, col: 3 };
            board.swapProgress = 0;

            // idx = 7 (pos1) at progress 0 during reverse starts at partner (pos2)
            const layout = computeCellLayout(7, CELL_SIZE, board, noDrag());
            expect(layout.x).toBe(half(3)); // at partner's position
        });

        it('arrives at own position at progress 1', () => {
            const colCount = 5;
            const board = idleBoard(1, 2, colCount);
            board.phase = 'reversing';
            board.swapPos1 = { row: 1, col: 2 };
            board.swapPos2 = { row: 1, col: 3 };
            board.swapProgress = 1;

            const layout = computeCellLayout(7, CELL_SIZE, board, noDrag());
            expect(layout.x).toBe(half(2)); // back to own position
        });
    });

    describe('settling interpolation', () => {
        it('uses settle origin at progress 0', () => {
            const board = idleBoard(3, 1);
            board.phase = 'settling';
            board.settleOrigin = 0; // fell from row 0
            board.settleProgress = 0;
            board.settleMaxDist = 3;

            const layout = computeCellLayout(16, CELL_SIZE, board, noDrag());
            expect(layout.y).toBe(half(0)); // at origin row
        });

        it('reaches target row at progress 1', () => {
            const board = idleBoard(3, 1);
            board.phase = 'settling';
            board.settleOrigin = 0;
            board.settleProgress = 1;
            board.settleMaxDist = 3;

            const layout = computeCellLayout(16, CELL_SIZE, board, noDrag());
            expect(layout.y).toBe(half(3)); // at target row
        });

        it('skips settle for stationary cells (NaN origin)', () => {
            const board = idleBoard(2, 1);
            board.phase = 'settling';
            board.settleOrigin = NaN;
            board.settleProgress = 0.5;
            board.settleMaxDist = 3;

            const layout = computeCellLayout(11, CELL_SIZE, board, noDrag());
            expect(layout.y).toBe(half(2)); // default grid position
        });

        it('x stays at grid column during settling', () => {
            const board = idleBoard(3, 1);
            board.phase = 'settling';
            board.settleOrigin = 0;
            board.settleProgress = 0.5;
            board.settleMaxDist = 3;

            const layout = computeCellLayout(16, CELL_SIZE, board, noDrag());
            expect(layout.x).toBe(half(1));
        });
    });

    describe('matching alpha', () => {
        it('fades matched cells based on matchProgress', () => {
            const board = idleBoard(0, 0);
            board.phase = 'matching';
            board.isMatched = true;
            board.matchProgress = 0.5;

            const layout = computeCellLayout(0, CELL_SIZE, board, noDrag());
            expect(layout.alpha).toBe(0.5);
        });

        it('fully fades matched cells at progress 1', () => {
            const board = idleBoard(0, 0);
            board.phase = 'matching';
            board.isMatched = true;
            board.matchProgress = 1;

            const layout = computeCellLayout(0, CELL_SIZE, board, noDrag());
            expect(layout.alpha).toBe(0);
        });

        it('does not fade unmatched cells during matching phase', () => {
            const board = idleBoard(0, 0);
            board.phase = 'matching';
            board.isMatched = false;
            board.matchProgress = 0.5;

            const layout = computeCellLayout(0, CELL_SIZE, board, noDrag());
            expect(layout.alpha).toBe(1);
        });
    });

    describe('priority ordering', () => {
        it('committed swap takes priority over model swap phase', () => {
            const colCount = 5;
            const board = idleBoard(1, 2, colCount);
            board.phase = 'swapping';
            board.swapPos1 = { row: 1, col: 2 };
            board.swapPos2 = { row: 1, col: 3 };
            board.swapProgress = 0.5;

            const drag = noDrag();
            drag.committedSwap = true;
            drag.originIdx = 7;
            drag.candidateIdx = 8;
            drag.origin = { col: 2, row: 1 };
            drag.candidate = { col: 3, row: 1 };

            // Committed swap position should win over model swap interpolation
            const layout = computeCellLayout(7, CELL_SIZE, board, drag);
            expect(layout.x).toBe(half(3));
        });

        it('active drag origin takes priority over returning cell', () => {
            const drag = noDrag();
            drag.active = true;
            drag.originIdx = 5;
            drag.pointer = { x: 200, y: 150 };
            drag.returningIdx = 5; // same cell is also "returning"
            drag.returningVisual = { x: 100, y: 80 };

            const layout = computeCellLayout(5, CELL_SIZE, idleBoard(1, 0), drag);
            expect(layout.x).toBe(200); // pointer wins
            expect(layout.y).toBe(150);
        });
    });
});

import { CLEAR_DURATION_MS, SWAP_DURATION_MS } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What a cell holds: a cactus of one colour, or nothing, once its cactus has cleared. */
export type CellKind = 'empty' | 'green' | 'pink' | 'blue' | 'gold';

/** What the board is doing. Each phase but `idle` lasts a set time. */
export type BoardPhase = 'idle' | 'swapping' | 'swapping-back' | 'clearing';

/** One cell of the board, and the cactus in it. */
export interface Cell {
    readonly row: number;
    readonly col: number;
    readonly kind: CellKind;
    /** Where the cell's cactus is now, in rows. Between two cells while it's being swapped. */
    readonly cactusRow: number;
    /** Where the cell's cactus is now, in columns. */
    readonly cactusCol: number;
}

/**
 * A small board of cactii, where the player swaps two neighbours to line up
 * three of a kind. A swap that lines up no three swaps back.
 *
 * When a phase ends, the time left over carries into the next one, which
 * starts its work on the next update. So one update ends at most one phase,
 * however long it is. Every phase lasts 300 ms or more, far longer than the
 * ticker's 100 ms cap, so a step a game gives never needs to end two.
 */
export interface BoardModel {
    readonly rows: number;
    readonly cols: number;
    /** The cells, by row, then column. */
    readonly cells: readonly (readonly Cell[])[];
    readonly phase: BoardPhase;
    /** Starts swapping two cells that are next to each other, if the board is idle. */
    readonly trySwap: (a: Cell, b: Cell) => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BoardModelOptions {
    /** What each cell holds at the start, by row, then column. */
    readonly startKinds: readonly (readonly CellKind[])[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates an idle board, with the cactii it's given. */
export function createBoardModel({ startKinds }: BoardModelOptions): BoardModel {
    const rows = startKinds.length;
    const cols = startKinds[0].length;
    const cells: MutableCell[][] = [];
    for (let row = 0; row < rows; row++) {
        const line: MutableCell[] = [];
        for (let col = 0; col < cols; col++) {
            line.push({ row, col, kind: startKinds[row][col], cactusRow: row, cactusCol: col });
        }
        cells.push(line);
    }
    // Which cells the last swap lined up, by row * cols + col
    const isMatched: boolean[] = new Array<boolean>(rows * cols).fill(false);

    let phase: BoardPhase = 'idle';
    // How long the board has been in this phase, in ms
    let phaseMs = 0;
    // The two cells being swapped. Both are set whenever the phase isn't idle.
    let swapA = cells[0][0];
    let swapB = cells[0][0];

    const model: BoardModel = {
        rows,
        cols,
        cells,
        get phase() { return phase; },

        trySwap(a, b) {
            if (phase !== 'idle') return;
            if (Math.abs(a.row - b.row) + Math.abs(a.col - b.col) !== 1) return;
            swapA = cells[a.row][a.col];
            swapB = cells[b.row][b.col];
            phase = 'swapping';
            phaseMs = 0;
        },

        update(deltaMs) {
            if (phase === 'idle') return;
            phaseMs += deltaMs;
            const durationMs = phase === 'clearing' ? CLEAR_DURATION_MS : SWAP_DURATION_MS;
            if (phaseMs < durationMs) {
                if (phase !== 'clearing') moveSwappingCacti(phaseMs / durationMs);
                return;
            }

            // This phase has ended. The time left over carries into the next
            // one, which starts its work on the next update, so a long update
            // ends this phase and no more.
            phaseMs -= durationMs;
            if (phase === 'swapping') {
                exchangeKinds();
                if (markMatches()) {
                    phase = 'clearing';
                    moveSwappingCacti(0);
                }
                else {
                    // No match, so the cactii go back where they came from
                    exchangeKinds();
                    phase = 'swapping-back';
                    moveSwappingCacti(0);
                }
            }
            else if (phase === 'swapping-back') {
                phase = 'idle';
                moveSwappingCacti(0);
            }
            else {
                clearMatches();
                phase = 'idle';
            }
        },
    };

    return model;

    /**
     * Moves the two cactii being swapped, for a share of the way through the
     * phase. A swap moves each towards the other's cell. A swap back starts
     * there, and moves each home. In any other phase, both are at home.
     */
    function moveSwappingCacti(share: number): void {
        const shift = phase === 'swapping' ? share : phase === 'swapping-back' ? 1 - share : 0;
        swapA.cactusRow = swapA.row + (swapB.row - swapA.row) * shift;
        swapA.cactusCol = swapA.col + (swapB.col - swapA.col) * shift;
        swapB.cactusRow = swapB.row + (swapA.row - swapB.row) * shift;
        swapB.cactusCol = swapB.col + (swapA.col - swapB.col) * shift;
    }

    function exchangeKinds(): void {
        const kind = swapA.kind;
        swapA.kind = swapB.kind;
        swapB.kind = kind;
    }

    /** Marks every cell in a line of three or more of a kind, and returns whether there were any. */
    function markMatches(): boolean {
        isMatched.fill(false);
        let isAnyMatched = false;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const kind = cells[row][col].kind;
                if (kind === 'empty') continue;
                if (col + 2 < cols && cells[row][col + 1].kind === kind && cells[row][col + 2].kind === kind) {
                    for (let i = 0; i < 3; i++) isMatched[row * cols + col + i] = true;
                    isAnyMatched = true;
                }
                if (row + 2 < rows && cells[row + 1][col].kind === kind && cells[row + 2][col].kind === kind) {
                    for (let i = 0; i < 3; i++) isMatched[(row + i) * cols + col] = true;
                    isAnyMatched = true;
                }
            }
        }
        return isAnyMatched;
    }

    function clearMatches(): void {
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (isMatched[row * cols + col]) cells[row][col].kind = 'empty';
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type MutableCell = { -readonly [K in keyof Cell]: Cell[K] };

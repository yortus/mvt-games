import { createRandom } from '@mvtjs/site-kit/random';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What's pencilled in a square of the grid: nothing, the reader's cross, or the other player's nought. */
export type MarginMark = 'none' | 'cross' | 'nought';

/** How a game stands: still being played, won by one side, or drawn, with every square filled and no line. */
export type MarginOutcome = 'playing' | 'reader-won' | 'opponent-won' | 'drawn';

/**
 * A game of noughts and crosses, pencilled in the margin of the paper's
 * back page, against someone the reader never sees. The reader plays
 * crosses. The other player plays noughts, after a moment's thought, as if
 * they sat across the table. They play well, but not perfectly, so the
 * reader can win now and then.
 *
 * A finished game stays on the page for a moment, with a line through a
 * win, then is rubbed out for the next. The two take turns to go first.
 */
export interface MarginGameModel {
    /** The mark in square `cell`, from 0 at the top left, across each row and down. */
    readonly markAt: (cell: number) => MarginMark;
    readonly outcome: MarginOutcome;
    /** The three squares of the winning line, in order along it, once a game is won. */
    readonly winningLine: readonly number[] | undefined;
    /** Whether it's the reader's turn, which means the game is still being played and the other player isn't thinking. */
    readonly isReadersTurn: boolean;
    /** How many marks have been pencilled, by either side, a count that rises with each. */
    readonly marksMade: number;
    /** How many games have been rubbed out, a count that rises with each. */
    readonly gamesRubbedOut: number;
    /** Pencils the reader's cross in square `cell`, if it's their turn and the square is empty. */
    readonly markCell: (cell: number) => void;
    readonly update: (deltaMs: number) => void;
}

/** The longest the other player thinks before they mark. */
export const MAX_THINK_MS = 1600;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface MarginGameModelOptions {
    /** Seeds the other player's choices and how long they think, so a game played the same way goes the same way. */
    readonly seed: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the game, with an empty grid and the reader to go first. */
export function createMarginGameModel({ seed }: MarginGameModelOptions): MarginGameModel {
    const random = createRandom({ seed });
    const marks: MarginMark[] = new Array<MarginMark>(CELL_COUNT).fill('none');
    let outcome: MarginOutcome = 'playing';
    let winningLine: readonly number[] | undefined;
    let marksMade = 0;
    let gamesRubbedOut = 0;
    /** How much longer the other player thinks before they mark, or undefined while it isn't their turn. */
    let thinkingMs: number | undefined;
    /** How long the finished game has stayed on the page. */
    let overMs = 0;

    return {
        markAt: (cell) => marks[cell],
        get outcome() {
            return outcome;
        },
        get winningLine() {
            return winningLine;
        },
        get isReadersTurn() {
            return outcome === 'playing' && thinkingMs === undefined;
        },
        get marksMade() {
            return marksMade;
        },
        get gamesRubbedOut() {
            return gamesRubbedOut;
        },

        markCell(cell) {
            if (outcome !== 'playing' || thinkingMs !== undefined || marks[cell] !== 'none') return;
            mark(cell, 'cross');
            if (outcome === 'playing') startThinking();
        },

        update(deltaMs) {
            if (outcome !== 'playing') {
                overMs += deltaMs;
                if (overMs >= OVER_MS) rubOut();
                return;
            }
            if (thinkingMs === undefined) return;
            thinkingMs -= deltaMs;
            if (thinkingMs > 0) return;
            thinkingMs = undefined;
            mark(chooseCell(), 'nought');
        },
    };

    function mark(cell: number, kind: MarginMark): void {
        marks[cell] = kind;
        marksMade++;
        winningLine = findLine(kind);
        if (winningLine !== undefined) end(kind === 'cross' ? 'reader-won' : 'opponent-won');
        else if (!marks.includes('none')) end('drawn');
    }

    function end(result: MarginOutcome): void {
        outcome = result;
        overMs = 0;
    }

    /** Rubs out the finished game. The side that didn't go first last time goes first now. */
    function rubOut(): void {
        marks.fill('none');
        outcome = 'playing';
        winningLine = undefined;
        gamesRubbedOut++;
        if (gamesRubbedOut % 2 === 1) startThinking();
    }

    function startThinking(): void {
        thinkingMs = MIN_THINK_MS + random.next() * (MAX_THINK_MS - MIN_THINK_MS);
    }

    /**
     * Where the other player marks. They take a win if there's one, and
     * block the reader's if there's one, but now and then they miss either.
     * Otherwise they like the middle, then the corners, then the edges.
     */
    function chooseCell(): number {
        const isCareless = random.next() < CARELESSNESS;
        const winning = isCareless ? -1 : findCompletingCell('nought');
        if (winning >= 0) return winning;
        const blocking = isCareless ? -1 : findCompletingCell('cross');
        if (blocking >= 0) return blocking;
        for (let group = 0; group < PREFERENCE.length; group++) {
            const free = PREFERENCE[group].filter((cell) => marks[cell] === 'none');
            if (free.length > 0) return free[random.nextIndex(free.length)];
        }
        return marks.indexOf('none');
    }

    /** A square that would complete a line of `kind`, or -1 if there isn't one. */
    function findCompletingCell(kind: MarginMark): number {
        for (const line of LINES) {
            let count = 0;
            let empty = -1;
            for (const cell of line) {
                if (marks[cell] === kind) count++;
                else if (marks[cell] === 'none') empty = cell;
            }
            if (count === 2 && empty >= 0) return empty;
        }
        return -1;
    }

    /** The line of three `kind` makes, if it makes one. */
    function findLine(kind: MarginMark): readonly number[] | undefined {
        return LINES.find((line) => line.every((cell) => marks[cell] === kind));
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const CELL_COUNT = 9;
/** The eight lines of three: the rows, the columns and the two diagonals. */
const LINES: readonly (readonly number[])[] = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
];
/** The squares the other player likes best, group by group: the middle, the corners, then the edges. */
const PREFERENCE: readonly (readonly number[])[] = [[4], [0, 2, 6, 8], [1, 3, 5, 7]];
/** How long the other player thinks before they mark, at least. */
const MIN_THINK_MS = 700;
/** How often the other player misses a win or a block, from 0 to 1. */
const CARELESSNESS = 0.2;
/** How long a finished game stays on the page before it's rubbed out. */
const OVER_MS = 2600;

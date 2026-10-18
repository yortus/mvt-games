import { COLS, ROWS } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export type GamePhase = 'playing' | 'game-over';
export type Direction = 'up' | 'down' | 'left' | 'right';

/** A cell of the garden. */
export interface Cell {
    readonly row: number;
    readonly col: number;
}

/**
 * The whole game. The snake moves one cell at a time, and grows by one for
 * each berry it eats. Hitting the fence or itself ends the game.
 */
export interface GameModel {
    readonly phase: GamePhase;
    readonly score: number;
    /** How many segments the snake has. */
    readonly length: number;
    /** Where segment `index` is, head first. A fractional row and column, as it slides between cells. */
    rowAt: (index: number) => number;
    colAt: (index: number) => number;
    readonly berry: Cell;
    /**
     * The way the player last steered. The snake finishes crossing into the
     * cell it is sliding toward, then turns, unless that would double it back.
     */
    direction: Direction;
    /** Asks for a new game. It starts at the next update, if the last game is over. */
    startNewRun: () => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Starts a game with a short snake heading right, across the middle of the garden. */
export function createGameModel(): GameModel {
    const cells: Cell[] = [];
    const berry = { row: 0, col: 0 };
    let phase: GamePhase;
    let score: number;
    let heading: Direction;
    let msIntoStep: number;
    let isNewRunRequested = false;

    const model: GameModel = {
        get phase() { return phase; },
        get score() { return score; },
        get length() { return cells.length; },
        rowAt: (index) => slide(cells[index].row, index === 0 ? cells[0].row + ROW_STEP[heading] : cells[index - 1].row),
        colAt: (index) => slide(cells[index].col, index === 0 ? cells[0].col + COL_STEP[heading] : cells[index - 1].col),
        berry,
        direction: 'right',
        startNewRun: () => { isNewRunRequested = true; },
        update(deltaMs) {
            // A new game asked for while one is under way is dropped, not kept for later
            const isNewRunDue = isNewRunRequested;
            isNewRunRequested = false;
            if (phase === 'game-over') {
                if (isNewRunDue) restart();
                return;
            }
            msIntoStep += deltaMs;
            if (msIntoStep < stepMs()) return;
            msIntoStep -= stepMs();
            step();
        },
    };
    restart();
    return model;

    /**
     * Finishes the move into the cell ahead, then turns the way the player
     * last steered, unless that would double back. Ends the game if the way
     * ahead is blocked.
     */
    function step(): void {
        const head = { row: cells[0].row + ROW_STEP[heading], col: cells[0].col + COL_STEP[heading] };
        cells.unshift(head);
        if (head.row !== berry.row || head.col !== berry.col) cells.pop();
        else {
            score++;
            placeBerry();
        }
        if (model.direction !== OPPOSITE[heading]) heading = model.direction;
        const row = head.row + ROW_STEP[heading];
        const col = head.col + COL_STEP[heading];
        // The tail moves out of the way as the head moves in. It stays only when the snake eats, and a berry is never on the snake.
        if (row < 0 || row >= ROWS || col < 0 || col >= COLS || isSnakeAt(row, col, cells.length - 1)) phase = 'game-over';
    }

    function restart(): void {
        cells.length = 0;
        for (let i = 0; i < START_LENGTH; i++) cells.push({ row: ROWS / 2, col: COLS / 4 - i });
        phase = 'playing';
        score = 0;
        heading = model.direction = 'right';
        msIntoStep = 0;
        placeBerry();
    }

    /** Moves the berry to a random cell the snake is not on. */
    function placeBerry(): void {
        do {
            berry.row = Math.floor(Math.random() * ROWS);
            berry.col = Math.floor(Math.random() * COLS);
        } while (isSnakeAt(berry.row, berry.col, cells.length));
    }

    /** Whether one of the first `count` segments is on the cell. */
    function isSnakeAt(row: number, col: number, count: number): boolean {
        for (let i = 0; i < count; i++) if (cells[i].row === row && cells[i].col === col) return true;
        return false;
    }

    /** How long each step takes: less as the score rises. */
    function stepMs(): number {
        return Math.max(FASTEST_STEP_MS, FIRST_STEP_MS - score * STEP_MS_SAVED_PER_BERRY);
    }

    /** Partway from a segment's cell to the one it is moving into. It stops where it is once the game is over. */
    function slide(from: number, to: number): number {
        return phase === 'playing' ? from + (to - from) * (msIntoStep / stepMs()) : from;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const START_LENGTH = 3;
/** How long each step takes at first, how much less after each berry, and the least. */
const FIRST_STEP_MS = 150;
const STEP_MS_SAVED_PER_BERRY = 3;
const FASTEST_STEP_MS = 70;

const ROW_STEP: Readonly<Record<Direction, number>> = { up: -1, down: 1, left: 0, right: 0 };
const COL_STEP: Readonly<Record<Direction, number>> = { up: 0, down: 0, left: -1, right: 1 };
const OPPOSITE: Readonly<Record<Direction, Direction>> = { up: 'down', down: 'up', left: 'right', right: 'left' };

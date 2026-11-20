import { CLUE_SHARE, LEAST_CLUE_SIZE, MOST_CELL_SIZE, MOST_CLUE_SIZE } from './view-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Where a maze and its clues go, in pixels, from the top left corner of the space they are fitted into. */
export interface BoardLayout {
    readonly cellSize: number;
    /** The maze's top left corner. */
    readonly gridX: number;
    readonly gridY: number;
    /** The clues' size, the room a clue number takes along the top, and the gap between the clues and the maze. */
    readonly clueSize: number;
    readonly clueStep: number;
    readonly clueGap: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BoardLayoutOptions {
    readonly rows: number;
    readonly cols: number;
    /** Each line's clue, or undefined where it's hidden. */
    readonly clues: readonly (readonly number[] | undefined)[];
    /** How many of the clues are on lines between columns, along the top. The rest are down the left. */
    readonly columnLineCount: number;
    /** The space to fit into. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Fits a maze and its clues into a space, as large as they will go, and
 * centres them. The clues on lines between columns are stacked above the
 * maze, and those on lines between rows are set out to its left, so the
 * room they need depends on the longest of them. Their size follows the
 * cells', so the fit is found a few times over, each from the last.
 */
export function layOutBoard(options: BoardLayoutOptions): BoardLayout {
    const { rows, cols, clues, columnLineCount, width, height } = options;
    let tallestClue = 1;
    let widestClue = 1;
    for (let line = 0; line < clues.length; line++) {
        const labels = toClueLabels(clues[line]);
        if (line < columnLineCount) tallestClue = Math.max(tallestClue, labels.length);
        else widestClue = Math.max(widestClue, measureClueWidth(labels, 1));
    }

    let cellSize = MOST_CELL_SIZE;
    let clueSize = 0;
    let topRoom = 0;
    let leftRoom = 0;
    for (let i = 0; i < 4; i++) {
        clueSize = Math.min(MOST_CLUE_SIZE, Math.max(LEAST_CLUE_SIZE, cellSize * CLUE_SHARE));
        topRoom = tallestClue * clueSize * STEP_SHARE + clueSize * GAP_SHARE;
        leftRoom = widestClue * clueSize + clueSize * GAP_SHARE;
        cellSize = Math.min(MOST_CELL_SIZE, (width - leftRoom) / cols, (height - topRoom) / rows);
    }
    const boardWidth = leftRoom + cols * cellSize;
    const boardHeight = topRoom + rows * cellSize;
    return {
        cellSize,
        gridX: (width - boardWidth) / 2 + leftRoom,
        gridY: (height - boardHeight) / 2 + topRoom,
        clueSize,
        clueStep: clueSize * STEP_SHARE,
        clueGap: clueSize * GAP_SHARE,
    };
}

/**
 * Returns the labels that `clue` shows, one for each stretch of wall. A line
 * without walls shows a 0, and a hidden clue shows a single `?`, so you can
 * tell the two apart.
 */
export function toClueLabels(clue: readonly number[] | undefined): readonly string[] {
    if (!clue) return HIDDEN_LABELS;
    if (clue.length === 0) return EMPTY_LABELS;
    return clue.map(String);
}

/** How wide a clue's `labels` are, set out in a row, at `clueSize`. Each character is as wide as a digit. */
export function measureClueWidth(labels: readonly string[], clueSize: number): number {
    let width = 0;
    for (let i = 0; i < labels.length; i++) width += labels[i].length * DIGIT_SHARE * clueSize + (i > 0 ? SPACE_SHARE * clueSize : 0);
    return width;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far apart the clues' numbers are stacked, the gap left before the maze, a digit's width, and the space between two numbers in a row, each as a share of the clues' size. */
const STEP_SHARE = 1.1;
const GAP_SHARE = 0.95;
const DIGIT_SHARE = 0.6;
const SPACE_SHARE = 0.55;

/** The labels of a line without walls, and of a hidden clue. */
const EMPTY_LABELS: readonly string[] = ['0'];
const HIDDEN_LABELS: readonly string[] = ['?'];

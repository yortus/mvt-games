import type { LocalStore } from '../../../storage';
import { type Level, LEVELS } from '#sudoku-digger';
import { toCalendarDate, toDayNumber } from './day-numbers';
import type { PuzzleSave } from './puzzle-save';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What the game keeps in the visitor's browser between visits: the puzzles
 * solved and started, each puzzle's progress, the level last chosen, and
 * whether the tutorial has been seen.
 * Which puzzles are solved and started is read once, and kept in memory, so
 * the calendar can ask about every day each frame.
 */
export interface SudokuRecords {
    readonly isSolved: (day: number, level: Level) => boolean;
    /** Whether the puzzle has progress kept, solved or not. */
    readonly isStarted: (day: number, level: Level) => boolean;
    /** How many days' puzzles are solved at `level`. */
    readonly countSolved: (level: Level) => number;
    readonly markSolved: (day: number, level: Level) => void;
    /** The progress kept for the puzzle, as stored, or undefined. The puzzle checks it before using it. */
    readonly readPuzzle: (day: number, level: Level) => unknown;
    /** Keeps the puzzle's progress, and counts it as started. */
    readonly writePuzzle: (day: number, level: Level, save: PuzzleSave) => void;
    /** The level the player chose last, on this visit or one before, if any. */
    readonly chosenLevel: Level | undefined;
    readonly rememberLevel: (level: Level) => void;
    /** Whether the player has seen the tutorial through, or skipped it, on this visit or one before. */
    readonly isTutorialSeen: boolean;
    readonly markTutorialSeen: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface SudokuRecordsOptions {
    /** Where the records are kept. A test passes a store in memory. */
    readonly store: LocalStore;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the records, reading what is kept in `store`. Each puzzle is
 * named in the store by its date and level, such as `2026-10-30/medium`, so
 * what is kept can be read.
 */
export function createSudokuRecords(options: SudokuRecordsOptions): SudokuRecords {
    const { store } = options;
    const solved = new Set<number>();
    const started = new Set<number>();
    const solvedCounts = new Uint16Array(LEVELS.length);
    let chosenLevel = readLevel();
    let isTutorialSeen = store.read(TUTORIAL_KEY) !== undefined;
    readIndex();

    return {
        isSolved: (day, level) => solved.has(toKey(day, level)),
        isStarted: (day, level) => started.has(toKey(day, level)),
        countSolved: (level) => solvedCounts[LEVELS.indexOf(level)],
        markSolved(day, level) {
            if (solved.has(toKey(day, level))) return;
            solved.add(toKey(day, level));
            solvedCounts[LEVELS.indexOf(level)]++;
            writeIndex();
        },
        readPuzzle: (day, level) => store.readJson(PUZZLE_KEY + toName(day, level)),
        writePuzzle(day, level, save) {
            store.writeJson(PUZZLE_KEY + toName(day, level), save);
            if (started.has(toKey(day, level))) return;
            started.add(toKey(day, level));
            writeIndex();
        },
        get chosenLevel() { return chosenLevel; },
        rememberLevel(level) {
            chosenLevel = level;
            store.write(LEVEL_KEY, level);
        },
        get isTutorialSeen() { return isTutorialSeen; },
        markTutorialSeen() {
            isTutorialSeen = true;
            store.write(TUTORIAL_KEY, 'seen');
        },
    };

    function readLevel(): Level | undefined {
        const text = store.read(LEVEL_KEY);
        return LEVELS.find((level) => level === text);
    }

    /** Reads which puzzles are solved and started. A name that is not a puzzle's, from an older version maybe, is skipped. */
    function readIndex(): void {
        const kept = store.readJson(INDEX_KEY);
        const fields = typeof kept === 'object' && kept !== null ? kept as Record<string, unknown> : {};
        for (const key of readNames(fields.started)) started.add(key);
        for (const key of readNames(fields.solved)) {
            solved.add(key);
            started.add(key);
        }
        for (const key of solved) solvedCounts[key % LEVELS.length]++;
    }

    function writeIndex(): void {
        store.writeJson(INDEX_KEY, { solved: [...solved].map(toNameOf), started: [...started].map(toNameOf) });
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const INDEX_KEY = 'mvt-arcade:sudoku:records';
const PUZZLE_KEY = 'mvt-arcade:sudoku:puzzle:';
const LEVEL_KEY = 'mvt-arcade:sudoku:level';
const TUTORIAL_KEY = 'mvt-arcade:sudoku:tutorial';

/** A puzzle's key in memory: a number, so the calendar's questions about it build no strings. */
function toKey(day: number, level: Level): number {
    return day * LEVELS.length + LEVELS.indexOf(level);
}

function toNameOf(key: number): string {
    return toName(Math.floor(key / LEVELS.length), LEVELS[key % LEVELS.length]);
}

/** A puzzle's name in the store: its date, and its level, such as `2026-10-30/medium`. */
function toName(day: number, level: Level): string {
    const { year, month, day: dayOfMonth } = toCalendarDate(day);
    return `${year}-${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}/${level}`;
}

function readNames(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    const keys: number[] = [];
    for (const name of value) {
        if (typeof name !== 'string') continue;
        const match = NAME_PATTERN.exec(name);
        if (match === null) continue;
        const level = LEVELS.find((each) => each === match[4]);
        if (level === undefined) continue;
        keys.push(toKey(toDayNumber({ year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }), level));
    }
    return keys;
}

const NAME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})\/([a-z]+)$/;

import type { LocalStore } from '@mvtjs/site-kit/storage';
import { toCalendarDate, toDayNumber } from './day-numbers';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What a daily puzzle game keeps in the visitor's browser between visits:
 * the puzzles solved and started, each puzzle's progress, the level last
 * chosen, and whether the player has seen the way in: the card that says
 * how to play.
 * Which puzzles are solved and started is read once, and kept in memory, so
 * the calendar can ask about every day each frame.
 */
export interface DailyRecords<L extends string> {
    readonly isSolved: (day: number, level: L) => boolean;
    /** Whether the puzzle has progress kept, solved or not. */
    readonly isStarted: (day: number, level: L) => boolean;
    /** How many days' puzzles are solved at `level`. */
    readonly countSolved: (level: L) => number;
    readonly markSolved: (day: number, level: L) => void;
    /** The progress kept for the puzzle, as stored, or undefined. The puzzle checks it before using it. */
    readonly readPuzzle: (day: number, level: L) => unknown;
    /** Keeps the puzzle's progress, as plain values, and counts it as started. */
    readonly writePuzzle: (day: number, level: L, save: unknown) => void;
    /**
     * Forgets the puzzle's progress, as when the player starts it again, so
     * it no longer counts as started. A puzzle solved stays solved, and so
     * still counts as started.
     */
    readonly forgetPuzzle: (day: number, level: L) => void;
    /** The level the player chose last, on this visit or one before, if any. */
    readonly chosenLevel: L | undefined;
    readonly rememberLevel: (level: L) => void;
    /** Whether the player has put the way in away, played or skipped, on this visit or one before. */
    readonly isIntroSeen: boolean;
    readonly markIntroSeen: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DailyRecordsOptions<L extends string> {
    /** Where the records are kept. A test passes a store in memory. */
    readonly store: LocalStore;
    /** The game's id, which the keys of what it keeps start with, such as `mvt-arcade:sudoku:records`. */
    readonly gameId: string;
    /** The game's levels, in order. A level's name is part of its puzzles' names in the store, so it must never change. */
    readonly levels: readonly L[];
    /**
     * Levels the game once named otherwise, by their former names, such as
     * `{ hardest: 'expert' }`. What was kept under a former name is read as
     * the level's, so a renamed level keeps its players' records and saves.
     */
    readonly formerLevelNames?: Readonly<Record<string, L>>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the records, reading what is kept in `store`. Each puzzle is
 * named in the store by its date and level, such as `2026-10-30/medium`, so
 * what is kept can be read.
 */
export function createDailyRecords<L extends string>(options: DailyRecordsOptions<L>): DailyRecords<L> {
    const { store, levels } = options;
    const formerLevelNames: Readonly<Record<string, L>> = options.formerLevelNames ?? {};
    const indexKey = `mvt-arcade:${options.gameId}:records`;
    const puzzleKey = `mvt-arcade:${options.gameId}:puzzle:`;
    const levelKey = `mvt-arcade:${options.gameId}:level`;
    // Named for the tutorial the way in grew from, so a player who saw that isn't shown this
    const introKey = `mvt-arcade:${options.gameId}:tutorial`;
    const solved = new Set<number>();
    const started = new Set<number>();
    const solvedCounts = new Uint16Array(levels.length);
    let chosenLevel = readLevel();
    let isIntroSeen = store.read(introKey) !== undefined;
    readIndex();

    return {
        isSolved: (day, level) => solved.has(toKey(day, level)),
        isStarted: (day, level) => started.has(toKey(day, level)),
        countSolved: (level) => solvedCounts[levels.indexOf(level)],
        markSolved(day, level) {
            if (solved.has(toKey(day, level))) return;
            solved.add(toKey(day, level));
            solvedCounts[levels.indexOf(level)]++;
            writeIndex();
        },
        readPuzzle(day, level) {
            const kept = store.readJson(puzzleKey + toName(day, level));
            if (kept !== undefined) return kept;
            for (const name in formerLevelNames) {
                if (formerLevelNames[name] === level) return store.readJson(puzzleKey + toName(day, name));
            }
            return undefined;
        },
        writePuzzle(day, level, save) {
            store.writeJson(puzzleKey + toName(day, level), save);
            if (started.has(toKey(day, level))) return;
            started.add(toKey(day, level));
            writeIndex();
        },
        forgetPuzzle(day, level) {
            store.remove(puzzleKey + toName(day, level));
            // What was kept under a former name would be read in its place
            for (const name in formerLevelNames) {
                if (formerLevelNames[name] === level) store.remove(puzzleKey + toName(day, name));
            }
            if (!started.has(toKey(day, level)) || solved.has(toKey(day, level))) return;
            started.delete(toKey(day, level));
            writeIndex();
        },
        get chosenLevel() { return chosenLevel; },
        rememberLevel(level) {
            chosenLevel = level;
            store.write(levelKey, level);
        },
        get isIntroSeen() { return isIntroSeen; },
        markIntroSeen() {
            isIntroSeen = true;
            store.write(introKey, 'seen');
        },
    };

    function readLevel(): L | undefined {
        const text = store.read(levelKey);
        return text === undefined ? undefined : findLevel(text);
    }

    /** The level named `name`, now or formerly, if there is one. */
    function findLevel(name: string): L | undefined {
        return levels.find((level) => level === name) ?? (Object.hasOwn(formerLevelNames, name) ? formerLevelNames[name] : undefined);
    }

    /** Reads which puzzles are solved and started. A name that is not a puzzle's, from an older version maybe, is skipped. */
    function readIndex(): void {
        const kept = store.readJson(indexKey);
        const fields = typeof kept === 'object' && kept !== null ? kept as Record<string, unknown> : {};
        for (const key of readNames(fields.started)) started.add(key);
        for (const key of readNames(fields.solved)) {
            solved.add(key);
            started.add(key);
        }
        for (const key of solved) solvedCounts[key % levels.length]++;
    }

    function writeIndex(): void {
        store.writeJson(indexKey, { solved: [...solved].map(toNameOf), started: [...started].map(toNameOf) });
    }

    /** A puzzle's key in memory: a number, so the calendar's questions about it build no strings. */
    function toKey(day: number, level: L): number {
        return day * levels.length + levels.indexOf(level);
    }

    function toNameOf(key: number): string {
        return toName(Math.floor(key / levels.length), levels[key % levels.length]);
    }

    function readNames(value: unknown): number[] {
        if (!Array.isArray(value)) return [];
        const keys: number[] = [];
        for (const name of value) {
            if (typeof name !== 'string') continue;
            const match = NAME_PATTERN.exec(name);
            if (match === null) continue;
            const level = findLevel(match[4]);
            if (level === undefined) continue;
            keys.push(toKey(toDayNumber({ year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }), level));
        }
        return keys;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A puzzle's name in the store: its date, and its level, such as `2026-10-30/medium`. */
function toName(day: number, level: string): string {
    const { year, month, day: dayOfMonth } = toCalendarDate(day);
    return `${year}-${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}/${level}`;
}

const NAME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})\/([a-z]+)$/;

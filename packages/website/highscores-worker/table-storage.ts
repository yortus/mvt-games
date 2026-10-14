import { type EnteredRow, enterRow, type HighscoreRow } from '#highscores';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Where the Worker keeps its tables, each under a key naming a game and its
 * table's version (`toTableKey`). Every table is best first, and holds at
 * most `TABLE_SIZE` rows.
 */
export interface TableStorage {
    /** The table under `key`: empty if it has no rows. */
    readonly tableAt: (key: string) => readonly HighscoreRow[];
    /** Enters `row` in the table under `key`, by `enterRow`'s rules. */
    readonly enter: (key: string, row: HighscoreRow) => EnteredRow;
    /** Removes the row at `rank` (1 for the top) from the table under `key`. Whether there was one. */
    readonly removeAt: (key: string, rank: number) => boolean;
}

/** The key a game's table is stored under: its game id and its table's version (`galaxy-raiders@1`). */
export function toTableKey(gameId: string, version: number): string {
    return `${gameId}@${version}`;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates table storage that keeps its tables in memory, for tests of what the Worker does with them. */
export function createMemoryTableStorage(): TableStorage {
    const tables = new Map<string, readonly HighscoreRow[]>();

    const storage: TableStorage = {
        tableAt: (key) => tables.get(key) ?? [],
        enter(key, row) {
            const entered = enterRow(storage.tableAt(key), row);
            if (entered.rank !== undefined) tables.set(key, entered.table);
            return entered;
        },
        removeAt(key, rank) {
            const table = storage.tableAt(key);
            if (!Number.isSafeInteger(rank) || rank < 1 || rank > table.length) return false;
            tables.set(key, table.filter((_row, index) => index !== rank - 1));
            return true;
        },
    };
    return storage;
}

import { type HighscoreRow, findRank, TABLE_SIZE } from '#highscores';
import type { TableStorage } from './table-storage';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to reach the SQLite database that the storage keeps its tables in. */
export interface SqlTableStorageOptions {
    /**
     * Runs one SQL statement with its bindings, and returns its rows: the
     * Durable Object's `ctx.storage.sql.exec`, or a stand-in over Node's
     * SQLite in tests.
     */
    readonly exec: (query: string, ...bindings: (string | number)[]) => Iterable<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates table storage in SQLite, with one database row per score. In the
 * Worker, the database is the Durable Object's own. Each statement runs to
 * completion before the next, and the object handles one request at a time,
 * so a table is never read half written.
 */
export function createSqlTableStorage(options: SqlTableStorageOptions): TableStorage {
    const { exec } = options;
    // `seq` counts arrivals, so of two equal scores the earlier ranks higher
    drain(exec(`CREATE TABLE IF NOT EXISTS scores (
        seq       INTEGER PRIMARY KEY AUTOINCREMENT,
        table_key TEXT    NOT NULL,
        initials  TEXT    NOT NULL,
        score     INTEGER NOT NULL,
        at        INTEGER NOT NULL
    )`));
    drain(exec('CREATE INDEX IF NOT EXISTS scores_by_table ON scores (table_key, score DESC, seq ASC)'));

    const storage: TableStorage = {
        tableAt(key) {
            const rows: HighscoreRow[] = [];
            for (const row of exec(`SELECT initials, score, at FROM scores WHERE table_key = ? ${BEST_FIRST} LIMIT ?`, key, TABLE_SIZE)) {
                rows.push({ initials: String(row.initials), score: Number(row.score), at: Number(row.at) });
            }
            return rows;
        },
        enter(key, row) {
            const table = storage.tableAt(key);
            const rank = findRank(table, row.score);
            if (rank === undefined) return { table, rank };
            drain(exec('INSERT INTO scores (table_key, initials, score, at) VALUES (?, ?, ?, ?)', key, row.initials, row.score, row.at));
            drain(exec(
                `DELETE FROM scores WHERE table_key = ? AND seq NOT IN (SELECT seq FROM scores WHERE table_key = ? ${BEST_FIRST} LIMIT ?)`,
                key, key, TABLE_SIZE,
            ));
            return { table: storage.tableAt(key), rank };
        },
        removeAt(key, rank) {
            if (!Number.isSafeInteger(rank) || rank < 1 || rank > TABLE_SIZE) return false;
            for (const row of exec(`SELECT seq FROM scores WHERE table_key = ? ${BEST_FIRST} LIMIT 1 OFFSET ?`, key, rank - 1)) {
                drain(exec('DELETE FROM scores WHERE seq = ?', Number(row.seq)));
                return true;
            }
            return false;
        },
    };
    return storage;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The order of a table: best score first, and of equal scores, the earlier. */
const BEST_FIRST = 'ORDER BY score DESC, seq ASC';

/** Runs a statement's cursor to its end, so no statement is left part run, however its cursor works. */
function drain(rows: Iterable<unknown>): void {
    for (const _row of rows) { /* nothing to read */ }
}

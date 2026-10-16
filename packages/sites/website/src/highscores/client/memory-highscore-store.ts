import { enterRow, type GameRulesTable, type HighscoreRow, findRefusal } from '../rules';
import type { HighscoreStore, HighscoreTables } from './highscore-store';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a store that keeps its tables in memory. */
export interface MemoryHighscoreStoreOptions {
    /** The games with tables. Leave it out to take any game id, with no cap on the score. */
    readonly games?: GameRulesTable;
    /** Tables to start with, best first, by game id. */
    readonly tables?: Readonly<Record<string, readonly HighscoreRow[]>>;
    /** The time a score is entered at, in milliseconds since the epoch. Defaults to `Date.now`. */
    readonly now?: () => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a store that keeps its tables in memory, by the same rules as the
 * Worker's. It forgets them when the page closes. The site uses it when no
 * Worker is set, as in development, and tests use it too.
 */
export function createMemoryHighscoreStore(options: MemoryHighscoreStoreOptions = {}): HighscoreStore {
    const { games, now = Date.now } = options;
    const tables = new Map<string, readonly HighscoreRow[]>(Object.entries(options.tables ?? {}));

    const store: HighscoreStore = {
        async loadAll() {
            const copy: HighscoreTables = new Map(tables);
            return copy;
        },
        async submit(submission) {
            const reason = findRefusal({ submission, games });
            if (reason !== undefined) return { kind: 'refused', reason };
            const { gameId, initials, score } = submission;
            const entered = enterRow(tables.get(gameId) ?? [], { initials, score, at: now() });
            if (entered.rank !== undefined) tables.set(gameId, entered.table);
            return { kind: 'entered', table: entered.table, rank: entered.rank };
        },
    };
    return store;
}

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { type HighscoreRow, TABLE_SIZE } from '#highscores';
import { createSqlTableStorage } from './sql-table-storage';
import { createMemoryTableStorage, toTableKey, type TableStorage } from './table-storage';

/** Each storage, made empty. The SQL one runs on Node's SQLite, as the Durable Object's runs on Cloudflare's. */
const STORAGES: readonly (readonly [string, () => TableStorage])[] = [
    ['memory', createMemoryTableStorage],
    ['sql', () => {
        const database = new DatabaseSync(':memory:');
        return createSqlTableStorage({ exec: (query, ...bindings) => database.prepare(query).all(...bindings) });
    }],
];

const KEY = toTableKey('some-game', 1);

function rowOf(score: number, at = 0): HighscoreRow {
    return { initials: 'AAA', score, at };
}

describe.each(STORAGES)('%s table storage', (_name, create) => {
    it('starts every table empty', () => {
        expect(create().tableAt(KEY)).toEqual([]);
    });

    it('keeps each table best first, ties in order of arrival, and no more than the table size', () => {
        const storage = create();
        for (let i = 0; i < TABLE_SIZE + 2; i++) storage.enter(KEY, rowOf(i % 3, i));
        const table = storage.tableAt(KEY);
        expect(table).toHaveLength(TABLE_SIZE);
        for (let i = 1; i < table.length; i++) {
            const [above, below] = [table[i - 1], table[i]];
            expect(above.score > below.score || (above.score === below.score && above.at < below.at)).toBe(true);
        }
    });

    it('returns the table and rank as entered, and enters nothing that does not place', () => {
        const storage = create();
        for (let i = 0; i < TABLE_SIZE; i++) storage.enter(KEY, rowOf(100, i));
        const tie = storage.enter(KEY, rowOf(100, TABLE_SIZE));
        expect(tie.rank).toBeUndefined();
        expect(storage.tableAt(KEY).some((row) => row.at === TABLE_SIZE)).toBe(false);

        const best = storage.enter(KEY, rowOf(101, TABLE_SIZE + 1));
        expect(best.rank).toBe(1);
        expect(best.table).toEqual(storage.tableAt(KEY));
        expect(best.table[0]).toEqual(rowOf(101, TABLE_SIZE + 1));
    });

    it('keeps each key\'s table apart', () => {
        const storage = create();
        storage.enter(KEY, rowOf(1));
        expect(storage.tableAt(toTableKey('some-game', 2))).toEqual([]);
        expect(storage.tableAt(toTableKey('other-game', 1))).toEqual([]);
    });

    it('removes the row at a rank, and nothing for a rank with no row', () => {
        const storage = create();
        for (const score of [30, 20, 10]) storage.enter(KEY, rowOf(score));
        expect(storage.removeAt(KEY, 2)).toBe(true);
        expect(storage.tableAt(KEY).map((row) => row.score)).toEqual([30, 10]);
        for (const rank of [0, 3, -1, 1.5, TABLE_SIZE + 1]) expect(storage.removeAt(KEY, rank), `${rank}`).toBe(false);
        expect(storage.tableAt(KEY)).toHaveLength(2);
    });
});

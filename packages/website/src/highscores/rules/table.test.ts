import { describe, expect, it } from 'vitest';
import { enterRow, type HighscoreRow, findRank, TABLE_SIZE } from './table';

/** A full table, best first: scores TABLE_SIZE * 100 down to 100. */
function fullTable(): HighscoreRow[] {
    const rows: HighscoreRow[] = [];
    for (let i = 0; i < TABLE_SIZE; i++) rows.push({ initials: 'AAA', score: (TABLE_SIZE - i) * 100, at: i });
    return rows;
}

describe('findRank', () => {
    it('ranks any score first in an empty table', () => {
        expect(findRank([], 1)).toBe(1);
    });

    it('ranks a score below every score it does not beat, ties included', () => {
        const table = fullTable();
        expect(findRank(table, table[0].score + 1)).toBe(1);
        expect(findRank(table, table[0].score)).toBe(2);
        expect(findRank(table, table[3].score + 1)).toBe(4);
    });

    it('does not rank a score that does not beat the last place of a full table', () => {
        const table = fullTable();
        const last = table[TABLE_SIZE - 1].score;
        expect(findRank(table, last + 1)).toBe(TABLE_SIZE);
        expect(findRank(table, last)).toBeUndefined();
        expect(findRank(table, last - 1)).toBeUndefined();
    });

    it('ranks any score below the rest in a table with room', () => {
        const table = fullTable().slice(0, TABLE_SIZE - 1);
        expect(findRank(table, 1)).toBe(TABLE_SIZE);
    });
});

describe('enterRow', () => {
    it('puts the row at its rank and drops the row pushed past the last place', () => {
        const table = fullTable();
        const row: HighscoreRow = { initials: 'NEW', score: table[2].score, at: TABLE_SIZE };
        const entered = enterRow(table, row);
        expect(entered.rank).toBe(4);
        expect(entered.table).toHaveLength(TABLE_SIZE);
        expect(entered.table[3]).toBe(row);
        expect(entered.table[TABLE_SIZE - 1]).toBe(table[TABLE_SIZE - 2]);
    });

    it('grows a table with room', () => {
        const entered = enterRow([], { initials: 'NEW', score: 1, at: 0 });
        expect(entered.rank).toBe(1);
        expect(entered.table).toHaveLength(1);
    });

    it('leaves the table as it was when the row does not place', () => {
        const table = fullTable();
        const entered = enterRow(table, { initials: 'NEW', score: table[TABLE_SIZE - 1].score, at: TABLE_SIZE });
        expect(entered.rank).toBeUndefined();
        expect(entered.table).toBe(table);
    });

    it('does not change the table it was given', () => {
        const table = fullTable();
        const before = [...table];
        enterRow(table, { initials: 'NEW', score: table[0].score + 1, at: TABLE_SIZE });
        expect(table).toEqual(before);
    });
});

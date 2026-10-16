import { describe, expect, it } from 'vitest';
import { type GameRulesTable, type HighscoreRow, TABLE_SIZE } from '../rules';
import { createMemoryHighscoreStore } from './memory-highscore-store';

const GAMES: GameRulesTable = { 'some-game': { version: 1, maxScore: 1000 } };
const NOW = 1_000_000;

describe('createMemoryHighscoreStore', () => {
    it('starts with the tables it is given, and no others', async () => {
        const rows: HighscoreRow[] = [{ initials: 'AAA', score: 10, at: 0 }];
        const store = createMemoryHighscoreStore({ tables: { 'some-game': rows } });
        const tables = await store.loadAll();
        expect([...tables.keys()]).toEqual(['some-game']);
        expect(tables.get('some-game')).toEqual(rows);
    });

    it('enters a score at its rank, stamped with the time, and keeps it', async () => {
        const store = createMemoryHighscoreStore({ games: GAMES, now: () => NOW });
        await store.submit({ gameId: 'some-game', initials: 'AAA', score: 10 });
        const result = await store.submit({ gameId: 'some-game', initials: 'BBB', score: 20 });
        expect(result).toEqual({
            kind: 'entered',
            rank: 1,
            table: [{ initials: 'BBB', score: 20, at: NOW }, { initials: 'AAA', score: 10, at: NOW }],
        });
        expect((await store.loadAll()).get('some-game')).toEqual(result.kind === 'entered' ? result.table : undefined);
    });

    it('enters a score that does not place without changing the table', async () => {
        const store = createMemoryHighscoreStore({ games: GAMES });
        for (let i = 0; i < TABLE_SIZE; i++) await store.submit({ gameId: 'some-game', initials: 'AAA', score: 100 });
        const before = (await store.loadAll()).get('some-game');
        const result = await store.submit({ gameId: 'some-game', initials: 'BBB', score: 100 });
        expect(result).toMatchObject({ kind: 'entered', rank: undefined });
        expect((await store.loadAll()).get('some-game')).toBe(before);
    });

    it('refuses what the rules refuse, and keeps nothing of it', async () => {
        const store = createMemoryHighscoreStore({ games: GAMES });
        expect(await store.submit({ gameId: 'other-game', initials: 'AAA', score: 1 })).toEqual({ kind: 'refused', reason: 'unknown-game' });
        expect(await store.submit({ gameId: 'some-game', initials: 'aaa', score: 1 })).toEqual({ kind: 'refused', reason: 'bad-initials' });
        expect(await store.submit({ gameId: 'some-game', initials: 'AAA', score: 0 })).toEqual({ kind: 'refused', reason: 'bad-score' });
        expect((await store.loadAll()).size).toBe(0);
    });

    it('hands out copies, so a caller cannot change its tables', async () => {
        const store = createMemoryHighscoreStore({ games: GAMES });
        const tables = await store.loadAll();
        (tables as Map<string, readonly HighscoreRow[]>).set('some-game', []);
        expect((await store.loadAll()).size).toBe(0);
    });
});

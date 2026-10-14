import { describe, expect, it } from 'vitest';
import { STATUS_FOR_REFUSAL, type SubmitResponse, TABLES_PATH, toTablePath, type TablesResponse } from '../protocol';
import type { HighscoreRow } from '../rules';
import { createFetchHighscoreStore } from './fetch-highscore-store';

const BASE_URL = 'https://tables.example';
const ROWS: HighscoreRow[] = [{ initials: 'AAA', score: 10, at: 0 }];

interface Sent {
    readonly input: string;
    readonly init: RequestInit | undefined;
}

/** A store whose requests are answered with `response`, and a list of what it sent. */
function storeAnswering(response: () => Response): { store: ReturnType<typeof createFetchHighscoreStore>; sent: Sent[] } {
    const sent: Sent[] = [];
    const store = createFetchHighscoreStore({
        url: BASE_URL,
        fetch: async (input, init) => {
            sent.push({ input, init });
            return response();
        },
    });
    return { store, sent };
}

describe('createFetchHighscoreStore', () => {
    it('loads every table from the tables path', async () => {
        const body: TablesResponse = { tables: { 'some-game': ROWS } };
        const { store, sent } = storeAnswering(() => Response.json(body));
        const tables = await store.loadAll();
        expect(sent[0].input).toBe(`${BASE_URL}${TABLES_PATH}`);
        expect(tables.get('some-game')).toEqual(ROWS);
    });

    it('posts a score to its game\'s path, as JSON, and returns the table and rank', async () => {
        const body: SubmitResponse = { table: ROWS, rank: 1 };
        const { store, sent } = storeAnswering(() => Response.json(body));
        const result = await store.submit({ gameId: 'some game', initials: 'AAA', score: 10 });
        expect(sent[0].input).toBe(`${BASE_URL}${toTablePath('some game')}`);
        expect(sent[0].init?.method).toBe('POST');
        expect(JSON.parse(String(sent[0].init?.body))).toEqual({ initials: 'AAA', score: 10 });
        expect(result).toEqual({ kind: 'entered', table: ROWS, rank: 1 });
    });

    it('returns no rank for a score that did not place', async () => {
        const body: SubmitResponse = { table: ROWS };
        const { store } = storeAnswering(() => Response.json(body));
        expect(await store.submit({ gameId: 'some-game', initials: 'AAA', score: 1 })).toEqual({ kind: 'entered', table: ROWS, rank: undefined });
    });

    it('resolves a refusal as refused', async () => {
        const { store } = storeAnswering(() => Response.json(
            { refused: 'too-many', message: 'slow down' },
            { status: STATUS_FOR_REFUSAL['too-many'] },
        ));
        expect(await store.submit({ gameId: 'some-game', initials: 'AAA', score: 1 })).toEqual({ kind: 'refused', reason: 'too-many' });
    });

    it('rejects when the tables answer with something unexpected', async () => {
        const answers = [
            () => new Response('oops', { status: 500 }),
            () => new Response('not json'),
            () => Response.json({ tables: { 'some-game': [{ initials: 'AAA' }] } }),
            () => Response.json({ refused: 'no such reason' }, { status: 400 }),
        ];
        for (const answer of answers) {
            const { store } = storeAnswering(answer);
            await expect(store.loadAll()).rejects.toThrow(/highscores/);
            await expect(store.submit({ gameId: 'some-game', initials: 'AAA', score: 1 })).rejects.toThrow(/highscores/);
        }
    });

    it('rejects when the tables cannot be reached', async () => {
        const store = createFetchHighscoreStore({ url: BASE_URL, fetch: () => Promise.reject(new TypeError('Failed to fetch')) });
        await expect(store.loadAll()).rejects.toThrow('Failed to fetch');
    });
});

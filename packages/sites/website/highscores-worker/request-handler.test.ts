import { describe, expect, it } from 'vitest';
import { type GameRulesTable, STATUS_FOR_REFUSAL, TABLE_SIZE, TABLES_PATH, toTablePath } from '#highscores';
import { createRequestHandler, type RequestHandlerOptions } from './request-handler';
import { createMemoryTableStorage } from './table-storage';

const GAMES: GameRulesTable = { 'some-game': { version: 1, maxScore: 1000 } };
const MAX_SCORE = GAMES['some-game'].maxScore;
const ORIGIN = 'https://arcade.example';
const BASE = 'https://tables.example';
const TOKEN = 'secret';
const NOW = 1_000_000;

function handlerWith(options: Partial<RequestHandlerOptions> = {}): (request: Request) => Promise<Response> {
    return createRequestHandler({
        storage: createMemoryTableStorage(),
        games: GAMES,
        allowedOrigins: [ORIGIN, 'http://localhost:*'],
        adminToken: TOKEN,
        now: () => NOW,
        ...options,
    });
}

/** A post of `body` from the page `origin`, or with no `Origin` header if it is empty. */
function post(body: unknown, origin = ORIGIN, gameId = 'some-game'): Request {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (origin !== '') headers.Origin = origin;
    return new Request(`${BASE}${toTablePath(gameId)}`, {
        method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body),
    });
}

function remove(rank: number, token = TOKEN): Request {
    return new Request(`${BASE}${toTablePath('some-game')}/${rank}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
}

async function tablesOf(handle: (request: Request) => Promise<Response>): Promise<unknown> {
    return (await handle(new Request(`${BASE}${TABLES_PATH}`))).json();
}

describe('createRequestHandler', () => {
    it('serves no tables before any score, to any page', async () => {
        const response = await handlerWith()(new Request(`${BASE}${TABLES_PATH}`));
        expect(response.status).toBe(200);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(await response.json()).toEqual({ tables: {} });
    });

    it('enters a score from an allowed page, and serves it after', async () => {
        const handle = handlerWith();
        const response = await handle(post({ initials: 'AAA', score: 10 }));
        expect(response.status).toBe(200);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
        const row = { initials: 'AAA', score: 10, at: NOW };
        expect(await response.json()).toEqual({ table: [row], rank: 1 });
        expect(await tablesOf(handle)).toEqual({ tables: { 'some-game': [row] } });
    });

    it('leaves the rank out for a score that does not place', async () => {
        const handle = handlerWith();
        for (let i = 0; i < TABLE_SIZE; i++) await handle(post({ initials: 'AAA', score: 10 }));
        const body = await (await handle(post({ initials: 'BBB', score: 10 }))).json();
        expect(body).not.toHaveProperty('rank');
    });

    it('takes a page on any port where an allowed origin ends with :*', async () => {
        const handle = handlerWith();
        expect((await handle(post({ initials: 'AAA', score: 10 }, 'http://localhost:5173'))).status).toBe(200);
        expect((await handle(post({ initials: 'AAA', score: 10 }, 'http://localhost'))).status).toBe(STATUS_FOR_REFUSAL['bad-origin']);
        expect((await handle(post({ initials: 'AAA', score: 10 }, 'http://localhost:5173.evil.example'))).status).toBe(STATUS_FOR_REFUSAL['bad-origin']);
    });

    it('refuses a post from any other page, or none', async () => {
        const handle = handlerWith();
        for (const origin of ['https://elsewhere.example', '']) {
            const response = await handle(post({ initials: 'AAA', score: 10 }, origin));
            expect(response.status).toBe(STATUS_FOR_REFUSAL['bad-origin']);
            expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
            expect(await response.json()).toMatchObject({ refused: 'bad-origin' });
        }
        expect(await tablesOf(handle)).toEqual({ tables: {} });
    });

    it('refuses a post over the rate limit, by the address it came from', async () => {
        const addresses: string[] = [];
        const handle = handlerWith({ mayPost: async (address) => (addresses.push(address), false) });
        const request = post({ initials: 'AAA', score: 10 });
        request.headers.set('CF-Connecting-IP', '203.0.113.1');
        const response = await handle(request);
        expect(response.status).toBe(STATUS_FOR_REFUSAL['too-many']);
        expect(addresses).toEqual(['203.0.113.1']);
    });

    it('refuses what the rules refuse', async () => {
        const handle = handlerWith();
        const cases = [
            [post({ initials: 'AAA', score: 10 }, ORIGIN, 'other-game'), 'unknown-game'],
            [post({ initials: 'aaa', score: 10 }), 'bad-initials'],
            [post({ initials: 'AAA', score: MAX_SCORE + 1 }), 'bad-score'],
            [post('not json'), 'bad-request'],
            [post({ initials: 'AAA' }), 'bad-request'],
            [post(`{"initials":"AAA","score":10,"padding":"${'x'.repeat(2000)}"}`), 'bad-request'],
        ] as const;
        for (const [request, reason] of cases) {
            const response = await handle(request);
            expect(response.status, reason).toBe(STATUS_FOR_REFUSAL[reason]);
            expect(await response.json()).toMatchObject({ refused: reason });
        }
        expect(await tablesOf(handle)).toEqual({ tables: {} });
    });

    it('serves only the current version of each game\'s table', async () => {
        const storage = createMemoryTableStorage();
        await handlerWith({ storage })(post({ initials: 'AAA', score: 10 }));
        const bumped = handlerWith({ storage, games: { 'some-game': { ...GAMES['some-game'], version: 2 } } });
        expect(await tablesOf(bumped)).toEqual({ tables: {} });
    });

    it('answers the browser\'s preflight', async () => {
        const response = await handlerWith()(new Request(`${BASE}${toTablePath('some-game')}`, { method: 'OPTIONS', headers: { Origin: ORIGIN } }));
        expect(response.status).toBe(204);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
        expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
        expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    });

    it('removes a row with the admin token, and only with it', async () => {
        const handle = handlerWith();
        await handle(post({ initials: 'AAA', score: 10 }));
        expect((await handle(remove(1, 'wrong'))).status).toBe(403);
        expect((await handlerWith({ adminToken: undefined })(remove(1, ''))).status).toBe(403);
        expect((await handle(remove(2))).status).toBe(404);
        expect((await handle(remove(1))).status).toBe(204);
        expect(await tablesOf(handle)).toEqual({ tables: {} });
    });

    it('answers anything else as not found', async () => {
        const handle = handlerWith();
        for (const [method, path] of [['GET', '/'], ['GET', toTablePath('some-game')], ['PUT', TABLES_PATH], ['GET', `${TABLES_PATH}/a/1/2`]]) {
            expect((await handle(new Request(`${BASE}${path}`, { method }))).status, `${method} ${path}`).toBe(404);
        }
    });
});

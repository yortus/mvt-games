import { describe, expect, it } from 'vitest';
import {
    createMemoryHighscoreStore, type HighscoreRow, type HighscoreStore, type HighscoreTables, type SubmitResult, TABLE_SIZE,
} from '../../highscores';
import { createHighscoresModel } from './highscores-model';

describe('HighscoresModel', () => {
    describe('the tables', () => {
        it('asks for the tables as it is made, and has them once they arrive', async () => {
            const model = createHighscoresModel({ store: createMemoryHighscoreStore({ tables: { game: rows(30, 20) } }) });
            expect(model.status).toBe('loading');
            expect(model.tableFor('game')).toEqual([]);
            await settle();
            expect(model.status).toBe('ready');
            expect(model.tableFor('game').map((row) => row.score)).toEqual([30, 20]);
            expect(model.bestScoreFor('game')).toBe(30);
            expect(model.bestScoreFor('other')).toBe(0);
            expect(model.tablesRevision).toBe(1);
        });

        it('says the tables are out of reach when they never arrive, and keeps older ones when a reload fails', async () => {
            const failing = createHighscoresModel({ store: storeWith({ loadAll: () => Promise.reject(new Error('offline')) }) });
            await settle();
            expect(failing.status).toBe('unavailable');

            let isReachable = true;
            const memory = createMemoryHighscoreStore({ tables: { game: rows(30) } });
            const flaky = createHighscoresModel({
                store: storeWith({ loadAll: () => isReachable ? memory.loadAll() : Promise.reject(new Error('offline')) }),
            });
            await settle();
            isReachable = false;
            flaky.reload();
            await settle();
            expect(flaky.status).toBe('ready');
            expect(flaky.bestScoreFor('game')).toBe(30);
        });

        it('takes only the latest of several reloads', async () => {
            const held = createHeldStore();
            const model = createHighscoresModel({ store: held.store });
            model.reload();
            held.answerLoad(1, new Map([['game', rows(20)]]));
            held.answerLoad(0, new Map([['game', rows(10)]]));
            await settle();
            expect(model.bestScoreFor('game')).toBe(20);
        });
    });

    describe('a score that places', () => {
        it('waits for initials, at the rank it would take, then shows where it went', async () => {
            const model = await readyModel({ game: rows(30, 10) });
            model.runEnded('game', 20);
            expect(model.placing).toBe('asking');
            expect(model.placingEntryId).toBe('game');
            expect(model.placingScore).toBe(20);
            expect(model.placingRank).toBe(2);

            model.submitInitials('TJG');
            expect(model.placing).toBe('sending');
            expect(model.lastInitials).toBe('TJG');
            await settle();
            expect(model.placing).toBe('shown');
            expect(model.placingRank).toBe(2);
            expect(model.placingProblem).toBeUndefined();
            expect(model.tableFor('game')[1]).toMatchObject({ initials: 'TJG', score: 20 });

            model.close();
            expect(model.placing).toBe('none');
            expect(model.placingEntryId).toBeUndefined();
        });

        it('ignores a run that would not place, scores nothing, or ends before the tables arrive', async () => {
            const scores: number[] = [];
            for (let i = 0; i < TABLE_SIZE; i++) scores.push(100);
            const model = await readyModel({ game: rows(...scores) });
            model.runEnded('game', 100);
            model.runEnded('other', 0);
            expect(model.placing).toBe('none');

            const early = createHighscoresModel({ store: createMemoryHighscoreStore() });
            early.runEnded('game', 100);
            expect(early.placing).toBe('none');
        });

        it('places in an empty table, and holds one placing at a time', async () => {
            const model = await readyModel({});
            model.runEnded('game', 1);
            expect(model.placingRank).toBe(1);
            model.runEnded('other', 500);
            expect(model.placingEntryId).toBe('game');
        });

        it('sends only valid initials, and only while asking', async () => {
            const model = await readyModel({});
            model.submitInitials('TJG');
            expect(model.placing).toBe('none');
            model.runEnded('game', 10);
            for (const initials of ['tjg', 'TJ', '   ', 'A55']) {
                model.submitInitials(initials);
                expect(model.placing, initials).toBe('asking');
            }
            expect(model.lastInitials).toBeUndefined();
        });

        it('shows a score the tables turned down, or could not take, as not entered', async () => {
            const refusing = await readyModel({}, { submit: async () => ({ kind: 'refused', reason: 'too-many' }) });
            refusing.runEnded('game', 10);
            refusing.submitInitials('TJG');
            await settle();
            expect(refusing.placing).toBe('shown');
            expect(refusing.placingProblem).toBe('refused');
            expect(refusing.placingRank).toBeUndefined();

            const unreachable = await readyModel({}, { submit: () => Promise.reject(new Error('offline')) });
            unreachable.runEnded('game', 10);
            unreachable.submitInitials('TJG');
            await settle();
            expect(unreachable.placingProblem).toBe('unreachable');
        });

        it('asks again if the tables turn down initials it took', async () => {
            const model = await readyModel({}, { submit: async () => ({ kind: 'refused', reason: 'bad-initials' }) });
            model.runEnded('game', 10);
            model.submitInitials('TJG');
            await settle();
            expect(model.placing).toBe('asking');
        });

        it('shows no rank for a score others pushed out of the table while it was sent', async () => {
            const model = await readyModel({ game: rows(10) }, { submit: async () => ({ kind: 'entered', table: rows(90, 80), rank: undefined }) });
            model.runEnded('game', 20);
            model.submitInitials('TJG');
            await settle();
            expect(model.placing).toBe('shown');
            expect(model.placingRank).toBeUndefined();
            expect(model.placingProblem).toBeUndefined();
            expect(model.bestScoreFor('game')).toBe(90);
        });

        it('still enters a score closed while it is sent, but does not show it', async () => {
            const model = await readyModel({});
            model.runEnded('game', 10);
            model.submitInitials('TJG');
            model.close();
            await settle();
            expect(model.placing).toBe('none');
            expect(model.bestScoreFor('game')).toBe(10);
        });

        it('keeps a submission\'s table over one asked for before it', async () => {
            const held = createHeldStore();
            const model = createHighscoresModel({ store: held.store });
            held.answerLoad(0, new Map());
            await settle();
            model.reload();
            model.runEnded('game', 10);
            model.submitInitials('TJG');
            held.answerSubmit(0, { kind: 'entered', table: rows(10), rank: 1 });
            await settle();
            held.answerLoad(1, new Map());
            await settle();
            expect(model.bestScoreFor('game')).toBe(10);
        });
    });

    describe('remembered initials', () => {
        it('offers valid remembered initials, and ignores the rest', () => {
            const store = createMemoryHighscoreStore();
            expect(createHighscoresModel({ store, rememberedInitials: 'TJG' }).lastInitials).toBe('TJG');
            expect(createHighscoresModel({ store, rememberedInitials: 'tjg' }).lastInitials).toBeUndefined();
            expect(createHighscoresModel({ store }).lastInitials).toBeUndefined();
        });
    });
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A table of these scores, best first, as entered in that order. */
function rows(...scores: number[]): HighscoreRow[] {
    return scores.map((score, at) => ({ initials: 'AAA', score, at }));
}

/** A model whose tables have arrived: these, kept in memory, with any store method replaced. */
async function readyModel(
    tables: Record<string, readonly HighscoreRow[]>,
    overrides: Partial<HighscoreStore> = {},
): Promise<ReturnType<typeof createHighscoresModel>> {
    const model = createHighscoresModel({ store: storeWith({ ...overrides }, createMemoryHighscoreStore({ tables })) });
    await settle();
    return model;
}

/** An in-memory store with some of its methods replaced. */
function storeWith(overrides: Partial<HighscoreStore>, base: HighscoreStore = createMemoryHighscoreStore()): HighscoreStore {
    return { ...base, ...overrides };
}

/** A store whose answers the test gives, to each request by the order it was made in. */
function createHeldStore(): {
    store: HighscoreStore;
    answerLoad: (index: number, tables: HighscoreTables) => void;
    answerSubmit: (index: number, result: SubmitResult) => void;
} {
    const loads: ((tables: HighscoreTables) => void)[] = [];
    const submits: ((result: SubmitResult) => void)[] = [];
    return {
        store: {
            loadAll: () => new Promise((resolve) => loads.push(resolve)),
            submit: () => new Promise((resolve) => submits.push(resolve)),
        },
        answerLoad: (index, tables) => loads[index](tables),
        answerSubmit: (index, result) => submits[index](result),
    };
}

/** Lets answers that have arrived report back. */
function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

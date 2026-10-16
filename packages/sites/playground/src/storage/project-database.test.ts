import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createMemoryProjectDatabase, openProjectDatabase, type StoredProject } from './project-database';

const BALL: StoredProject = { id: 'a', name: 'Ball', files: [{ path: 'main.ts', text: 'ball' }], savedAt: 100, isBarrelKept: true, description: '' };
const CLOCK: StoredProject = { id: 'b', name: 'Clock', files: [{ path: 'main.ts', text: 'clock' }, { path: 'models/clock.ts', text: '' }], savedAt: 200, isBarrelKept: false, description: 'A clock' };

describe('a project database', () => {
    it('saves, lists the last saved first, loads, replaces and removes projects', async () => {
        const database = await openProjectDatabase({ indexedDB: new IDBFactory() });
        expect(database.isKept).toBe(true);
        await database.save(BALL);
        await database.save(CLOCK);
        expect(await database.list()).toEqual([
            { id: 'b', name: 'Clock', description: 'A clock', savedAt: 200, fileCount: 2 },
            { id: 'a', name: 'Ball', description: '', savedAt: 100, fileCount: 1 },
        ]);
        expect(await database.load('a')).toEqual(BALL);

        await database.save({ ...BALL, name: 'Bouncing Ball', savedAt: 300 });
        expect((await database.list()).map((p) => p.name)).toEqual(['Bouncing Ball', 'Clock']);

        await database.remove('b');
        expect((await database.list()).map((p) => p.id)).toEqual(['a']);
        expect(await database.load('b')).toBeUndefined();
    });

    it('keeps its projects for the next visit', async () => {
        const indexedDB = new IDBFactory();
        await (await openProjectDatabase({ indexedDB })).save(BALL);
        expect(await (await openProjectDatabase({ indexedDB })).load('a')).toEqual(BALL);
    });

    it('stores a frozen project as a plain copy', async () => {
        const database = await openProjectDatabase({ indexedDB: new IDBFactory() });
        await database.save(Object.freeze({ ...BALL, files: Object.freeze([...BALL.files]) }));
        expect(await database.load('a')).toEqual(BALL);
    });

    it('keeps projects in memory where IndexedDB cannot be opened', async () => {
        const broken = {
            open: () => {
                throw new Error('Blocked');
            },
        } as unknown as IDBFactory;
        const database = await openProjectDatabase({ indexedDB: broken });
        expect(database.isKept).toBe(false);
        await database.save(BALL);
        expect(await database.load('a')).toEqual(BALL);
    });

    it('lists the same in memory as in IndexedDB', async () => {
        const database = createMemoryProjectDatabase();
        await database.save(BALL);
        await database.save(CLOCK);
        expect((await database.list()).map((p) => p.id)).toEqual(['b', 'a']);
    });
});

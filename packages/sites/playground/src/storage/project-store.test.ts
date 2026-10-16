import { describe, expect, it } from 'vitest';
import { createMemoryProjectDatabase, type ProjectDatabase } from './project-database';
import { moveLocalProjects } from './project-store';

/** A stand-in for `localStorage`, holding these items. */
function createStorage(items: Record<string, string>): Storage {
    const map = new Map(Object.entries(items));
    return {
        get length() { return map.size; },
        // eslint-disable-next-line @mvtjs/no-null -- the DOM's Storage says "no item" with null
        key: (index) => [...map.keys()][index] ?? null,
        // eslint-disable-next-line @mvtjs/no-null -- the DOM's Storage says "no item" with null
        getItem: (key) => map.get(key) ?? null,
        setItem: (key, value) => void map.set(key, value),
        removeItem: (key) => void map.delete(key),
        clear: () => map.clear(),
    };
}

/** A database in memory that says it outlasts the page, as IndexedDB does. */
function createKeptDatabase(): ProjectDatabase {
    return { ...createMemoryProjectDatabase(), isKept: true };
}

const KEPT = JSON.stringify({ name: 'Bouncing Ball', files: [{ path: 'main.ts', text: 'ball' }] });
const OLD = JSON.stringify({ m: 'function createModel() { return { update() {} }; }', v: 'function createView(model) { return new Container(); }', w: 300, h: 200 });

describe('moving the projects kept in localStorage', () => {
    it('moves both into the database, the last worked on as the newer, and removes them from localStorage', async () => {
        const database = createKeptDatabase();
        const storage = createStorage({ 'mvt-playground-project': KEPT, 'mvt-playground-custom': OLD });
        let ids = 0;
        const lastId = await moveLocalProjects({ database, storage, createId: () => `id-${++ids}`, now: 1000 });

        const list = await database.list();
        expect(list.map((p) => p.name)).toEqual(['Bouncing Ball', 'My first project']);
        expect(lastId).toBe(list[0].id);
        expect((await database.load(list[0].id))?.files).toEqual([{ path: 'main.ts', text: 'ball' }]);
        // The old playground's model and view, converted into files of their own
        expect((await database.load(list[1].id))?.files.map((f) => f.path)).toContain('main.ts');
        expect(storage.length).toBe(0);
    });

    it('numbers a project moved in under a name the database has already', async () => {
        const database = createKeptDatabase();
        await database.save({ id: 'there', name: 'Bouncing Ball', files: [], savedAt: 1 });
        await moveLocalProjects({ database, storage: createStorage({ 'mvt-playground-project': KEPT }), createId: () => 'moved', now: 1000 });
        expect((await database.load('moved'))?.name).toBe('Bouncing Ball 2');
    });

    it('moves nothing, and gives no id, when localStorage kept nothing', async () => {
        const database = createKeptDatabase();
        expect(await moveLocalProjects({ database, storage: createStorage({}), createId: () => 'x', now: 0 })).toBeUndefined();
        expect(await database.list()).toEqual([]);
    });

    it('leaves localStorage as it was when the database lasts only as long as the page', async () => {
        const storage = createStorage({ 'mvt-playground-project': KEPT });
        await moveLocalProjects({ database: createMemoryProjectDatabase(), storage, createId: () => 'x', now: 0 });
        expect(storage.getItem('mvt-playground-project')).toBe(KEPT);
    });
});

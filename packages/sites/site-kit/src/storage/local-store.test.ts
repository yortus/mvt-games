import { describe, expect, it } from 'vitest';
import { createLocalStore, createMemoryStore } from './local-store';

describe('LocalStore', () => {
    it('reads back what it wrote, and nothing once it is removed', () => {
        const store = createMemoryStore();
        expect(store.read('a')).toBeUndefined();
        expect(store.write('a', 'one')).toBe(true);
        expect(store.read('a')).toBe('one');
        store.remove('a');
        expect(store.read('a')).toBeUndefined();
    });

    it('reads back a value written as JSON', () => {
        const store = createMemoryStore();
        store.writeJson('b', { score: 40, ids: ['x', 'y'] });
        expect(store.readJson('b')).toEqual({ score: 40, ids: ['x', 'y'] });
    });

    it('reads text that is not JSON as nothing', () => {
        const store = createMemoryStore();
        store.write('c', '{ not json');
        expect(store.readJson('c')).toBeUndefined();
    });

    it('reports a value that cannot be written as JSON as not kept', () => {
        const store = createMemoryStore();
        const loop: Record<string, unknown> = {};
        loop.self = loop;
        expect(store.writeJson('d', loop)).toBe(false);
    });

    it('throws nothing where storage is blocked', () => {
        const blocked = new Proxy({} as Storage, {
            get: () => {
                throw new Error('blocked');
            },
        });
        const store = createLocalStore({ storage: blocked });
        expect(store.read('a')).toBeUndefined();
        expect(store.write('a', 'one')).toBe(false);
        expect(() => store.remove('a')).not.toThrow();
        expect(store.readJson('a')).toBeUndefined();
    });
});

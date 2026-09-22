import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { refreshScene } from '../pixi-mvt';
import { List } from './list';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Item { readonly id: number }

function setup(count: number) {
    const items: Item[] = [];
    for (let i = 0; i < count; i++) items.push({ id: i });

    let builds = 0;
    const list = List<Item>({
        of: () => items,
        to: (item) => {
            builds++;
            const c = new Container();
            c.label = `item-${item.id}`;
            return c;
        },
    });

    return {
        items,
        resetBuilds: () => { builds = 0; },
        builds: () => builds,
        tick: () => refreshScene(list),
        // Each item is wrapped in a slot container.
        labels: () => list.children.map((slot) => slot.children[0]?.label),
    };
}

function labelsOf(items: readonly Item[]): string[] {
    return items.map((item) => `item-${item.id}`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('List', () => {
    it('builds one slot per item on first reconcile', () => {
        const t = setup(4);

        expect(t.builds()).toBe(4);
        expect(t.labels()).toEqual(labelsOf(t.items));
    });

    it('does nothing when the items are unchanged', () => {
        const t = setup(4);
        t.resetBuilds();

        t.tick();
        t.tick();

        expect(t.builds()).toBe(0);
    });

    it('appends without rebuilding the existing items', () => {
        const t = setup(4);
        t.resetBuilds();

        t.items.push({ id: 99 });
        t.tick();

        expect(t.builds()).toBe(1);
        expect(t.labels()).toEqual(labelsOf(t.items));
    });

    // Regression: `prev` used to be written at the insert cursor while still
    // being read at the delete cursor. After a non-tail insertion the write
    // ran ahead of the read and clobbered entries that had not been compared
    // yet, so every remaining item fell through to Replace. A single head
    // insertion into a list of N cost N+1 builds instead of 1.
    it('inserts at the head without rebuilding the tail', () => {
        for (const n of [5, 10, 20]) {
            const t = setup(n);
            t.resetBuilds();

            t.items.unshift({ id: 999 });
            t.tick();

            expect(t.builds()).toBe(1);
            expect(t.labels()).toEqual(labelsOf(t.items));
        }
    });

    it('inserts in the middle without rebuilding the tail', () => {
        const t = setup(8);
        t.resetBuilds();

        t.items.splice(3, 0, { id: 999 });
        t.tick();

        expect(t.builds()).toBe(1);
        expect(t.labels()).toEqual(labelsOf(t.items));
    });

    it('removes from the head without rebuilding', () => {
        const t = setup(8);
        t.resetBuilds();

        t.items.shift();
        t.tick();

        expect(t.builds()).toBe(0);
        expect(t.labels()).toEqual(labelsOf(t.items));
    });

    it('removes from the middle without rebuilding', () => {
        const t = setup(8);
        t.resetBuilds();

        t.items.splice(3, 1);
        t.tick();

        expect(t.builds()).toBe(0);
        expect(t.labels()).toEqual(labelsOf(t.items));
    });

    it('truncates from the tail', () => {
        const t = setup(6);
        t.resetBuilds();

        t.items.length = 2;
        t.tick();

        expect(t.builds()).toBe(0);
        expect(t.labels()).toEqual(labelsOf(t.items));
    });

    it('renders reorders correctly, whatever they cost', () => {
        const t = setup(6);

        t.items.reverse();
        t.tick();
        expect(t.labels()).toEqual(labelsOf(t.items));

        const tmp = t.items[1];
        t.items[1] = t.items[4];
        t.items[4] = tmp;
        t.tick();
        expect(t.labels()).toEqual(labelsOf(t.items));
    });

    it('skips reconciliation while the version is unchanged', () => {
        const items: Item[] = [{ id: 0 }];
        let version = 0;
        let builds = 0;

        const list = List<Item>({
            of: () => items,
            version: () => version,
            to: () => {
                builds++;
                return new Container();
            },
        });
        builds = 0;

        items.push({ id: 1 });
        refreshScene(list);
        expect(builds).toBe(0);

        version = 1;
        refreshScene(list);
        expect(builds).toBe(1);
    });
});

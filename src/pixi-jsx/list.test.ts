import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { createOrderedSlotList, createSlotList } from '#common';
import { refreshScene } from '../pixi-mvt';
import { countPropReads } from './prop-reads';
import { jsx } from './jsx-runtime';
import { List } from './list';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Item { readonly id: number }

/**
 * A list over an array that is mutated in place, the way models in this repo
 * own collections. `undefined` entries are empty slots.
 */
function setup(initial: (Item | undefined)[]) {
    const items = initial;
    const built: number[] = [];
    let labelReads = 0;
    let atCalls = 0;

    // Counts `at` calls without changing what the array returns
    const source = {
        get length() { return items.length; },
        at: (i: number) => {
            atCalls++;
            return items[i];
        },
    };

    const list = List<Item>({
        items: source,
        children: (item, index) => {
            built.push(index);
            return jsx('container', {
                label: () => {
                    labelReads++;
                    return `item-${item().id}`;
                },
            });
        },
    });

    // The host refreshes the scene before the first render; do the same here
    refreshScene(list);

    return {
        list,
        items,
        built,
        labelReads: () => labelReads,
        atCalls: () => atCalls,
        resetCounts: () => {
            labelReads = 0;
            atCalls = 0;
        },
        labels: () => list.children.map((c) => c.label),
        visible: () => list.children.map((c) => c.visible),
    };
}

function findDescriptor(proto: object | null, key: string): PropertyDescriptor | undefined {
    for (let p = proto; p; p = Object.getPrototypeOf(p) as object | null) {
        const descriptor = Object.getOwnPropertyDescriptor(p, key);
        if (descriptor) return descriptor;
    }
    return undefined;
}

function itemsWithIds(...ids: number[]): Item[] {
    return ids.map((id) => ({ id }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('List', () => {
    describe('slots', () => {
        it('builds one slot per item, in order, each seeing its item at construction', () => {
            const t = setup(itemsWithIds(7, 8, 9));

            expect(t.built).toEqual([0, 1, 2]);
            expect(t.labels()).toEqual(['item-7', 'item-8', 'item-9']);
        });

        it('builds only the new indices when the source grows', () => {
            const t = setup(itemsWithIds(1, 2, 3));
            t.built.length = 0;

            t.items.push({ id: 4 }, { id: 5 });
            refreshScene(t.list);

            expect(t.built).toEqual([3, 4]);
            expect(t.list.children.length).toBe(5);
        });

        it('detaches surplus slots on shrink, keeping them rather than destroying them', () => {
            const t = setup(itemsWithIds(1, 2, 3, 4));
            const surplus = t.list.children[3];

            t.items.length = 2;
            refreshScene(t.list);

            expect(t.list.children.length).toBe(2);
            expect(t.visible()).toEqual([true, true]);
            expect(surplus.parent).toBeNull();
            expect(surplus.destroyed).toBe(false);
        });

        it('destroys detached slots along with the list', () => {
            const t = setup(itemsWithIds(1, 2, 3));
            const attached = t.list.children[0];
            const detached = t.list.children[2];
            t.items.length = 1;
            refreshScene(t.list);

            t.list.destroy({ children: true });

            expect(attached.destroyed).toBe(true);
            expect(detached.destroyed).toBe(true);
        });

        it('does not run a hidden slot\'s bindings', () => {
            const t = setup(itemsWithIds(1, 2, 3, 4));
            t.items.length = 1;
            t.resetCounts();

            refreshScene(t.list);

            // Only slot 0 is present, and it has one binding
            expect(t.labelReads()).toBe(1);
        });

        it('reattaches kept slots on regrowth, refreshed that frame, and never rebuilds one', () => {
            const t = setup(itemsWithIds(1, 2, 3, 4));
            const original = t.list.children[3];

            t.items.length = 1;
            refreshScene(t.list);
            t.items.push(...itemsWithIds(12, 13, 14));
            refreshScene(t.list);

            // Four builds across the whole sequence, not eight
            expect(t.built).toEqual([0, 1, 2, 3]);
            expect(t.list.children[3]).toBe(original);
            expect(t.labels()).toEqual(['item-1', 'item-12', 'item-13', 'item-14']);
        });

        it('keeps refreshing a reattached slot on later frames, driven from an ancestor', () => {
            const t = setup(itemsWithIds(1, 2));
            const root = new Container();
            root.addChild(t.list);
            refreshScene(root);

            t.items.length = 1;
            refreshScene(root);
            t.items.push({ id: 3 });
            refreshScene(root);
            t.items[1] = { id: 4 };
            refreshScene(root);

            expect(t.labels()).toEqual(['item-1', 'item-4']);
        });

        it('does no structural work when the source is unchanged', () => {
            const t = setup(itemsWithIds(1, 2, 3));
            const before = t.list.children.slice();
            t.built.length = 0;

            refreshScene(t.list);
            refreshScene(t.list);

            expect(t.built).toEqual([]);
            expect(t.list.children).toEqual(before);
        });
    });

    describe('items', () => {
        it('re-reads each slot\'s item every frame, so a reorder is not structural', () => {
            const t = setup(itemsWithIds(1, 2));
            const before = t.list.children.slice();

            t.items.reverse();
            refreshScene(t.list);

            expect(t.labels()).toEqual(['item-2', 'item-1']);
            expect(t.list.children).toEqual(before);
            expect(t.built).toEqual([0, 1]);
        });

        it('calls at() once per slot per frame', () => {
            const t = setup(itemsWithIds(1, 2, 3));
            t.resetCounts();

            refreshScene(t.list);

            expect(t.atCalls()).toBe(3);
        });

        it('hides an empty slot and skips its bindings', () => {
            const t = setup(itemsWithIds(1, 2));

            // An emptied slot must not evaluate `item().id` on undefined
            t.items[1] = undefined;
            expect(() => refreshScene(t.list)).not.toThrow();
            expect(t.visible()).toEqual([true, false]);
        });

        it('builds a hole with the rest, hidden until it fills, so slot i is child i', () => {
            const t = setup([{ id: 1 }, undefined, { id: 3 }]);
            expect(t.built).toEqual([0, 1, 2]);
            expect(t.visible()).toEqual([true, false, true]);

            t.items[1] = { id: 2 };
            refreshScene(t.list);

            expect(t.built).toEqual([0, 1, 2]);
            expect(t.labels()).toEqual(['item-1', 'item-2', 'item-3']);
        });

        it('accepts a plain array as the source', () => {
            const stars = itemsWithIds(1, 2);
            const list = List<Item>({
                items: stars,
                children: (star) => jsx('container', { label: () => `star-${star().id}` }),
            });
            refreshScene(list);

            stars.splice(0, 1);
            refreshScene(list);

            // Slot 0 now shows what was at index 1; slot 1 is past the length
            expect(list.children.map((c) => c.label)).toEqual(['star-2']);
        });

        it('re-reads a getter every frame, so a replaced collection is followed', () => {
            let stars = itemsWithIds(1, 2);
            const list = List<Item>({
                items: () => stars,
                children: (star) => jsx('container', { label: () => `star-${star().id}` }),
            });
            refreshScene(list);

            stars = itemsWithIds(5);
            refreshScene(list);

            expect(list.children.map((c) => c.label)).toEqual(['star-5']);
        });
    });

    it('is inert until its first refresh: it reads nothing and builds nothing', () => {
        let built = 0;
        const list = List<Item>({
            items: () => {
                throw new Error('items read at construction');
            },
            children: () => {
                built++;
                return new Container();
            },
        });

        expect(list.children.length).toBe(0);
        expect(built).toBe(0);
    });

    it('calls a function length once per frame', () => {
        let count = 2;
        let lengthCalls = 0;
        const list = List<Item>({
            items: {
                length: () => {
                    lengthCalls++;
                    return count;
                },
                at: (i) => ({ id: i }),
            },
            children: (item) => jsx('container', { label: () => `item-${item().id}` }),
        });
        lengthCalls = 0;

        count = 3;
        refreshScene(list);

        expect(lengthCalls).toBe(1);
        expect(list.children.map((c) => c.label)).toEqual(['item-0', 'item-1', 'item-2']);
    });

    describe('slot lists', () => {
        it('projects SlotList.slots directly', () => {
            const bullets = createSlotList<{ x: number }>();
            const a = bullets.insert({ x: 1 });
            bullets.insert({ x: 2 });
            bullets.insert({ x: 3 });

            const list = List({
                items: bullets.slots,
                children: (slot) => jsx('container', { x: () => slot().value.x }),
            });
            refreshScene(list);
            expect(list.children.map((c) => c.x)).toEqual([1, 2, 3]);

            // A freed slot becomes a hole, and a reused one refills it
            bullets.remove(a);
            refreshScene(list);
            expect(list.children.map((c) => c.visible)).toEqual([false, true, true]);

            bullets.insert({ x: 9 });
            refreshScene(list);
            expect(list.children.map((c) => c.visible)).toEqual([true, true, true]);
            expect(list.children[0].x).toBe(9);
        });

        it('projects OrderedSlotList.ordered in logical order', () => {
            const cards = createOrderedSlotList<string>();
            cards.append('a');
            cards.append('b');
            cards.append('c');

            const list = List({
                items: cards.ordered,
                children: (slot) => jsx('container', { label: () => slot().value }),
            });
            cards.move(2, 0);
            refreshScene(list);

            expect(list.children.map((c) => c.label)).toEqual(['c', 'a', 'b']);
        });
    });

    it('refreshes a hand-written slot view on the frame it is built', () => {
        const items: Item[] = [];
        let refreshes = 0;
        const list = List({
            items,
            children: () => {
                const view = new Container();
                view.onRefresh = () => {
                    refreshes++;
                };
                return view;
            },
        });

        items.push({ id: 1 });
        refreshScene(list);

        expect(refreshes).toBe(1);
    });

    it('leaves an occupied slot hidden by its own visible binding, without flipping it each frame', () => {
        const items = itemsWithIds(1, 2);
        const list = List<Item>({
            items,
            children: (item) => jsx('container', { visible: () => item().id !== 2 }),
        });
        refreshScene(list);
        const hidden = list.children[1];
        expect(hidden.visible).toBe(false);

        // Count every write to `visible` on the hidden slot over a few frames
        let writes = 0;
        const proto = Object.getPrototypeOf(hidden) as object;
        const descriptor = findDescriptor(proto, 'visible')!;
        Object.defineProperty(hidden, 'visible', {
            configurable: true,
            get() { return descriptor.get!.call(hidden) as boolean; },
            set(value: boolean) {
                if (value !== descriptor.get!.call(hidden)) writes++;
                descriptor.set!.call(hidden, value);
            },
        });
        refreshScene(list);
        refreshScene(list);

        expect(hidden.visible).toBe(false);
        expect(writes).toBe(0);
    });

    it('counts one read of `items` and one presence check per slot', () => {
        const t = setup(itemsWithIds(1, 2, 3));
        t.items[1] = undefined;

        // `items` + 3 presence checks + a label getter for each of the 2 present items
        expect(countPropReads(() => refreshScene(t.list))).toBe(1 + 3 + 2);
    });

    it('passes its own container to ref', () => {
        let received: Container | undefined;
        // Called the way compiled TSX calls it, which erases the prop types
        const list = jsx(List as unknown as (props: Record<string, unknown>) => Container, {
            items: [],
            children: () => new Container(),
            ref: (el: Container) => { received = el; },
        });

        expect(received).toBe(list);
    });
});

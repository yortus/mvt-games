import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { List } from './list';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup() {
    let length = 0;
    const built: number[] = [];

    const list = List({
        length: () => length,
        children: (index) => {
            built.push(index);
            const slot = new Container();
            slot.label = `slot-${index}`;
            return slot;
        },
    });

    /** Drive the list the way Pixi's render pass would. */
    const tick = (): void => list.onRender?.(undefined as never);

    return {
        list,
        built,
        setLength: (n: number) => { length = n; },
        tick,
        labels: () => list.children.map((c) => c.label),
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('List', () => {
    it('builds one slot per index on first render', () => {
        const t = setup();
        t.setLength(3);
        t.tick();

        expect(t.built).toEqual([0, 1, 2]);
        expect(t.labels()).toEqual(['slot-0', 'slot-1', 'slot-2']);
    });

    it('appends only the new indices when the length grows', () => {
        const t = setup();
        t.setLength(3);
        t.tick();
        t.built.length = 0;

        t.setLength(5);
        t.tick();

        expect(t.built).toEqual([3, 4]);
        expect(t.list.children.length).toBe(5);
    });

    it('detaches surplus slots without destroying them', () => {
        const t = setup();
        t.setLength(4);
        t.tick();
        const parked = t.list.children[3];

        t.setLength(2);
        t.tick();

        expect(t.list.children.length).toBe(2);
        expect(parked.destroyed).toBe(false);
        // Detached, so Pixi no longer refreshes it and its index-bound getters
        // never run with an out-of-range index.
        expect(parked.parent).toBeFalsy();
    });

    it('reuses parked slots on regrowth and never rebuilds one', () => {
        const t = setup();
        t.setLength(4);
        t.tick();
        const original = t.list.children[3];

        t.setLength(1);
        t.tick();
        t.setLength(4);
        t.tick();

        // Four builds total across the whole sequence, not eight.
        expect(t.built).toEqual([0, 1, 2, 3]);
        expect(t.list.children[3]).toBe(original);
        expect(t.labels()).toEqual(['slot-0', 'slot-1', 'slot-2', 'slot-3']);
    });

    it('does no structural work when the length is unchanged', () => {
        const t = setup();
        t.setLength(3);
        t.tick();
        const before = t.list.children.slice();
        t.built.length = 0;

        t.tick();
        t.tick();

        expect(t.built).toEqual([]);
        expect(t.list.children).toEqual(before);
    });
});

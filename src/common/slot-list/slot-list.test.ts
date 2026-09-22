import { describe, it, expect, vi } from 'vitest';
import { createSlotList, type Slot } from './slot-list';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createSlotList', () => {
    describe('initial state', () => {
        it('starts empty', () => {
            const list = createSlotList<number>();
            expect(list.slotCount).toBe(0);
            expect(list.liveCount).toBe(0);
            expect(list.at(0)).toBeUndefined();
        });

        it('is never full when unbounded', () => {
            const list = createSlotList<number>();
            expect(list.isFull).toBe(false);
        });

        it('is not full when bounded with room', () => {
            const list = createSlotList<number>({ maxSlots: 2 });
            expect(list.isFull).toBe(false);
        });
    });

    describe('insert', () => {
        it('places a value in a live slot', () => {
            const list = createSlotList<string>();
            const slot = list.insert('a');

            expect(slot.isLive).toBe(true);
            expect(slot.index).toBe(0);
            expect(slot.value).toBe('a');
            expect(list.slotCount).toBe(1);
            expect(list.liveCount).toBe(1);
            expect(list.at(0)).toBe(slot);
        });

        it('assigns ascending indices while growing', () => {
            const list = createSlotList<number>();
            expect(list.insert(10).index).toBe(0);
            expect(list.insert(20).index).toBe(1);
            expect(list.insert(30).index).toBe(2);
            expect(list.slotCount).toBe(3);
            expect(list.liveCount).toBe(3);
        });

        it('fills the lowest available index', () => {
            const list = createSlotList<number>();
            list.insert(10);
            const b = list.insert(20);
            list.insert(30);

            list.remove(b); // index 1 released immediately (no delay)
            const d = list.insert(40);

            expect(d.index).toBe(1);
            expect(list.slotCount).toBe(3);
        });

        it('keeps filling the lowest available index across scattered removals', () => {
            const list = createSlotList<number>();
            const a = list.insert(0);
            list.insert(1);
            const c = list.insert(2);
            list.insert(3);

            list.remove(c); // hole at index 2
            list.remove(a); // hole at index 0

            expect(list.insert(10).index).toBe(0); // lowest hole first
            expect(list.insert(11).index).toBe(2); // next hole
            expect(list.insert(12).index).toBe(4); // then append
            expect(list.slotCount).toBe(5);
        });

        it('throws when full and reports isFull first', () => {
            const list = createSlotList<number>({ maxSlots: 1 });
            list.insert(1);

            expect(list.isFull).toBe(true);
            expect(() => list.insert(2)).toThrow(/full/);
        });

        it('grows on demand past a would-be bound when unbounded', () => {
            const list = createSlotList<number>();
            for (let i = 0; i < 100; i++) list.insert(i);
            expect(list.slotCount).toBe(100);
            expect(list.isFull).toBe(false);
        });
    });

    describe('remove without delay', () => {
        it('releases the slot immediately', () => {
            const list = createSlotList<number>();
            const slot = list.insert(1);

            list.remove(slot);

            expect(slot.isLive).toBe(false);
            expect(list.liveCount).toBe(0);
            expect(list.at(0)).toBeUndefined();
            expect(list.slotCount).toBe(0);
        });

        it('trims the tail and skips interior holes', () => {
            const list = createSlotList<number>();
            const a = list.insert(1);
            const b = list.insert(2);
            const c = list.insert(3);

            list.remove(b); // interior hole at index 1
            expect(list.slotCount).toBe(3);

            list.remove(c); // tail released, then trim walks back across the index-1 hole
            expect(list.slotCount).toBe(1);

            expect(a.isLive).toBe(true);
        });

        it('trims back across multiple trailing available slots', () => {
            const list = createSlotList<number>();
            list.insert(1);
            const b = list.insert(2);
            const c = list.insert(3);

            list.remove(c);
            list.remove(b);

            expect(list.slotCount).toBe(1);
        });

        it('is a no-op on a second remove', () => {
            const list = createSlotList<number>();
            const slot = list.insert(1);
            list.remove(slot);
            list.remove(slot);
            expect(list.liveCount).toBe(0);
        });
    });

    describe('remove with a release delay', () => {
        it('keeps the slot pending release until the delay elapses', () => {
            const list = createSlotList<number>({ releaseDelayMs: 100 });
            const slot = list.insert(1);

            list.remove(slot);
            expect(slot.isLive).toBe(false);
            expect(list.liveCount).toBe(0);
            expect(list.at(0)).toBe(slot); // still readable while pending release

            list.update(50);
            expect(list.at(0)).toBe(slot);

            list.update(50);
            expect(list.at(0)).toBeUndefined();
            expect(list.slotCount).toBe(0);
        });

        it('does not reuse a slot that is pending release', () => {
            const list = createSlotList<number>({ releaseDelayMs: 100 });
            const a = list.insert(1);
            list.remove(a);

            const b = list.insert(2);
            expect(b.index).toBe(1); // index 0 is still pending release
        });

        it('honors a per-call delay over the list default', () => {
            const list = createSlotList<number>({ releaseDelayMs: 1000 });
            const slot = list.insert(1);

            list.remove(slot, 10);
            list.update(10);
            expect(list.at(0)).toBeUndefined();
        });

        it('releases slots in release-time order regardless of removal order', () => {
            const list = createSlotList<number>({ releaseDelayMs: 0 });
            const a = list.insert(1);
            const b = list.insert(2);

            list.remove(a, 1000);
            list.remove(b, 100);

            list.update(150);
            expect(a.isLive).toBe(false);
            expect(list.at(a.index)).toBe(a); // still pending release
            expect(list.at(b.index)).toBeUndefined(); // released

            list.update(1000);
            expect(list.at(a.index)).toBeUndefined();
        });

        it('supports the born-removed pattern', () => {
            const list = createSlotList<{ ageMs: number }>({ releaseDelayMs: 200 });
            const slot = list.insert({ ageMs: 0 });
            list.remove(slot);

            expect(list.at(slot.index)).toBe(slot);
            list.update(200);
            expect(list.at(slot.index)).toBeUndefined();
        });
    });

    describe('onRelease', () => {
        it('fires on immediate remove', () => {
            const onRelease = vi.fn();
            const list = createSlotList<number>({ onRelease });
            const slot = list.insert(7);

            list.remove(slot);
            expect(onRelease).toHaveBeenCalledExactlyOnceWith(7);
        });

        it('fires when a pending-release slot is released', () => {
            const onRelease = vi.fn();
            const list = createSlotList<number>({ releaseDelayMs: 100, onRelease });
            const slot = list.insert(7);

            list.remove(slot);
            expect(onRelease).not.toHaveBeenCalled();

            list.update(100);
            expect(onRelease).toHaveBeenCalledExactlyOnceWith(7);
        });

        it('fires for every value on clear', () => {
            const onRelease = vi.fn();
            const list = createSlotList<number>({ releaseDelayMs: 100, onRelease });
            const a = list.insert(1);
            list.insert(2);
            list.remove(a); // pending release

            list.clear();
            expect(onRelease).toHaveBeenCalledTimes(2);
        });

        it('supports pooling values back to a source', () => {
            const pool: { id: number }[] = [];
            const value = { id: 1 };
            const list = createSlotList<{ id: number }>({
                onRelease: (v) => pool.push(v),
            });

            const slot = list.insert(value);
            list.remove(slot);

            expect(pool).toEqual([value]);
        });
    });

    describe('clear', () => {
        it('releases everything immediately and resets counts', () => {
            const list = createSlotList<number>({ releaseDelayMs: 100 });
            const a = list.insert(1);
            list.insert(2);
            list.remove(a);

            list.clear();

            expect(list.slotCount).toBe(0);
            expect(list.liveCount).toBe(0);
            expect(list.at(0)).toBeUndefined();
            expect(a.isLive).toBe(false);
        });

        it('does not resurrect pending-release slots on a later update', () => {
            const onRelease = vi.fn();
            const list = createSlotList<number>({ releaseDelayMs: 100, onRelease });
            const slot = list.insert(1);
            list.remove(slot);

            list.clear();
            list.update(1000);

            expect(onRelease).toHaveBeenCalledTimes(1); // only the clear release
        });
    });

    describe('update', () => {
        it('is a safe no-op with no slots pending release', () => {
            const list = createSlotList<number>();
            list.insert(1);
            expect(() => list.update(16)).not.toThrow();
            expect(list.liveCount).toBe(1);
        });
    });

    describe('forEachLive', () => {
        it('visits each live item in storage-index order', () => {
            const list = createSlotList<string>();
            list.insert('a');
            list.insert('b');
            list.insert('c');

            const seen: string[] = [];
            list.forEachLive((value) => seen.push(value));
            expect(seen).toEqual(['a', 'b', 'c']);
        });

        it('skips empty and pending-release slots', () => {
            const list = createSlotList<string>({ releaseDelayMs: 100 });
            const a = list.insert('a');
            const b = list.insert('b');
            list.insert('c');

            list.remove(a, 0); // immediate -> empty slot
            list.remove(b); // pending release -> present but not live

            const seen: string[] = [];
            list.forEachLive((value) => seen.push(value));
            expect(seen).toEqual(['c']);
        });

        it('passes the slot as the second argument', () => {
            const list = createSlotList<number>();
            const only = list.insert(7);

            let received: Slot<number> | undefined;
            list.forEachLive((_value, slot) => {
                received = slot;
            });
            expect(received).toBe(only);
        });

        it('allows removing the visited slot during iteration', () => {
            const list = createSlotList<number>();
            list.insert(1);
            list.insert(2);
            list.insert(3);

            list.forEachLive((value, slot) => {
                if (value === 2) list.remove(slot);
            });

            const seen: number[] = [];
            list.forEachLive((value) => seen.push(value));
            expect(seen).toEqual([1, 3]);
        });
    });

    describe('forgotten-update guard', () => {
        it.runIf(import.meta.env.DEV)('throws when slots pile up pending release before update is called', () => {
            const list = createSlotList<number>({ releaseDelayMs: 100 });
            const slots: Slot<number>[] = [];
            for (let i = 0; i < 1024; i++) slots.push(list.insert(i));

            expect(() => {
                for (let i = 0; i < 1024; i++) list.remove(slots[i]);
            }).toThrow(/update\(deltaMs\) has never been called/);
        });

        it('stays silent once update has been called, even past the threshold', () => {
            const list = createSlotList<number>({ releaseDelayMs: 100 });
            list.update(0); // arms hasUpdated without advancing the clock
            const slots: Slot<number>[] = [];
            for (let i = 0; i < 1100; i++) slots.push(list.insert(i));

            expect(() => {
                for (let i = 0; i < 1100; i++) list.remove(slots[i]);
            }).not.toThrow();
        });

        it('stays silent for zero-delay removals regardless of update', () => {
            const list = createSlotList<number>();
            const slots: Slot<number>[] = [];
            for (let i = 0; i < 2000; i++) slots.push(list.insert(i));

            expect(() => {
                for (let i = 0; i < 2000; i++) list.remove(slots[i]);
            }).not.toThrow();
        });
    });

    describe('slot identity', () => {
        it('keeps a live slot at a stable index across other mutations', () => {
            const list = createSlotList<number>();
            const target = list.insert(1);
            const b = list.insert(2);

            list.remove(b);
            list.insert(3);
            list.insert(4);

            expect(target.index).toBe(0);
            expect(target.isLive).toBe(true);
            expect(list.at(0)).toBe(target);
        });

        it('reflects liveness on the same wrapper reference after removal', () => {
            const list = createSlotList<number>({ releaseDelayMs: 50 });
            const slot = list.insert(1);
            expect(slot.isLive).toBe(true);

            list.remove(slot);
            expect(slot.isLive).toBe(false);
        });
    });
});

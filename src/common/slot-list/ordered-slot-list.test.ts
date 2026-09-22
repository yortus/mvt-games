import { describe, it, expect, vi } from 'vitest';
import { createOrderedSlotList, type OrderedSlot } from './ordered-slot-list';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createOrderedSlotList', () => {
    describe('append', () => {
        it('assigns ascending ordinals and stable storage indices', () => {
            const list = createOrderedSlotList<string>();
            const a = list.append('a');
            const b = list.append('b');

            expect(a.ordinal).toBe(0);
            expect(a.index).toBe(0);
            expect(b.ordinal).toBe(1);
            expect(b.index).toBe(1);
            expect(list.atSlotIndex(0)).toBe(a);
            expect(list.atOrdinal(1)).toBe(b);
            expect(list.slotCount).toBe(2);
            expect(list.liveCount).toBe(2);
        });

        it('throws when full', () => {
            const list = createOrderedSlotList<number>({ maxSlots: 1 });
            list.append(1);
            expect(list.isFull).toBe(true);
            expect(() => list.append(2)).toThrow(/full/);
        });
    });

    describe('insertAt', () => {
        it('inserts at an ordinal and shifts the rest up', () => {
            const list = createOrderedSlotList<string>();
            list.append('a');
            list.append('c');
            const b = list.insertAt(1, 'b');

            expect(b.ordinal).toBe(1);
            expect(list.atOrdinal(0)?.value).toBe('a');
            expect(list.atOrdinal(1)?.value).toBe('b');
            expect(list.atOrdinal(2)?.value).toBe('c');
            expect(list.liveCount).toBe(3);
        });

        it('clamps an out-of-range ordinal to an append', () => {
            const list = createOrderedSlotList<string>();
            list.append('a');
            const b = list.insertAt(99, 'b');
            expect(b.ordinal).toBe(1);
            expect(list.atOrdinal(1)).toBe(b);
        });
    });

    describe('move', () => {
        it('reorders and renumbers, keeping storage indices stable', () => {
            const list = createOrderedSlotList<string>();
            const a = list.append('a'); // index 0, ordinal 0
            const b = list.append('b'); // index 1, ordinal 1
            const c = list.append('c'); // index 2, ordinal 2

            list.move(2, 0); // c to the front

            expect(a.index).toBe(0);
            expect(b.index).toBe(1);
            expect(c.index).toBe(2); // storage index unchanged
            expect(c.ordinal).toBe(0); // ordinal changed
            expect(a.ordinal).toBe(1);
            expect(b.ordinal).toBe(2);
            expect(list.atOrdinal(0)).toBe(c);
        });

        it('is a no-op for an out-of-range source', () => {
            const list = createOrderedSlotList<number>();
            list.append(1);
            expect(() => list.move(5, 0)).not.toThrow();
            expect(list.atOrdinal(0)?.value).toBe(1);
        });
    });

    describe('sort', () => {
        it('reorders live items by value and renumbers', () => {
            const list = createOrderedSlotList<number>();
            list.append(3);
            list.append(1);
            list.append(2);

            list.sort((a, b) => a - b);

            expect(list.atOrdinal(0)?.value).toBe(1);
            expect(list.atOrdinal(1)?.value).toBe(2);
            expect(list.atOrdinal(2)?.value).toBe(3);
            expect(list.atOrdinal(0)?.ordinal).toBe(0);
            expect(list.atOrdinal(2)?.ordinal).toBe(2);
        });
    });

    describe('remove', () => {
        it('detaches from the order immediately and renumbers survivors', () => {
            const list = createOrderedSlotList<string>({ releaseDelayMs: 100 });
            const a = list.append('a');
            const b = list.append('b');
            const c = list.append('c');

            list.remove(b);

            expect(b.ordinal).toBe(-1);
            expect(list.liveCount).toBe(2);
            expect(a.ordinal).toBe(0);
            expect(c.ordinal).toBe(1);
            expect(list.atOrdinal(0)).toBe(a);
            expect(list.atOrdinal(1)).toBe(c);
            // still reachable by storage index during the release delay
            expect(list.atSlotIndex(b.index)).toBe(b);
            expect(b.isLive).toBe(false);
        });

        it('releases a detached slot after the delay elapses', () => {
            const list = createOrderedSlotList<string>({ releaseDelayMs: 100 });
            const a = list.append('a');

            list.remove(a);
            expect(list.atSlotIndex(a.index)).toBe(a);

            list.update(100);
            expect(list.atSlotIndex(a.index)).toBeUndefined();
        });

        it('frees immediately with no release delay', () => {
            const list = createOrderedSlotList<string>();
            const a = list.append('a');
            list.append('b');

            list.remove(a);

            expect(list.atSlotIndex(a.index)).toBeUndefined();
            expect(list.liveCount).toBe(1);
            expect(list.atOrdinal(0)?.value).toBe('b');
        });

        it('ignores a second remove', () => {
            const list = createOrderedSlotList<number>({ releaseDelayMs: 100 });
            const a = list.append(1);
            list.remove(a);
            list.remove(a);
            expect(list.liveCount).toBe(0);
        });
    });

    describe('forEachLive', () => {
        it('visits each live item in ordinal order', () => {
            const list = createOrderedSlotList<string>();
            list.append('a');
            list.append('b');
            list.append('c');
            list.move(2, 0); // order becomes c, a, b

            const seen: string[] = [];
            list.forEachLive((value) => seen.push(value));
            expect(seen).toEqual(['c', 'a', 'b']);
        });

        it('skips pending-release slots', () => {
            const list = createOrderedSlotList<string>({ releaseDelayMs: 100 });
            const a = list.append('a');
            const b = list.append('b');
            list.append('c');

            list.remove(a, 0); // immediate -> freed
            list.remove(b); // pending release -> detached from the order

            const seen: string[] = [];
            list.forEachLive((value) => seen.push(value));
            expect(seen).toEqual(['c']);
        });

        it('passes the slot as the second argument', () => {
            const list = createOrderedSlotList<number>();
            const only = list.append(7);

            let received: OrderedSlot<number> | undefined;
            list.forEachLive((_value, slot) => {
                received = slot;
            });
            expect(received).toBe(only);
        });

        it('allows removing the visited slot during iteration', () => {
            const list = createOrderedSlotList<number>();
            list.append(1);
            list.append(2);
            list.append(3);

            list.forEachLive((value, slot) => {
                if (value === 2) list.remove(slot);
            });

            const seen: number[] = [];
            list.forEachLive((value) => seen.push(value));
            expect(seen).toEqual([1, 3]);
        });

        it('visits every survivor when removing each visited slot', () => {
            const list = createOrderedSlotList<number>({ releaseDelayMs: 100 });
            list.append(1);
            list.append(2);
            list.append(3);

            const seen: number[] = [];
            list.forEachLive((value, slot) => {
                seen.push(value);
                list.remove(slot);
            });
            expect(seen).toEqual([1, 2, 3]);
            expect(list.liveCount).toBe(0);
        });
    });

    describe('onRelease', () => {
        it('fires when a slot frees', () => {
            const onRelease = vi.fn();
            const list = createOrderedSlotList<number>({ onRelease });
            const a = list.append(7);

            list.remove(a);
            expect(onRelease).toHaveBeenCalledExactlyOnceWith(7);
        });
    });

    describe('clear', () => {
        it('releases everything and resets both spaces', () => {
            const onRelease = vi.fn();
            const list = createOrderedSlotList<number>({ releaseDelayMs: 100, onRelease });
            list.append(1);
            const b = list.append(2);
            list.remove(b); // pending release

            list.clear();

            expect(list.slotCount).toBe(0);
            expect(list.liveCount).toBe(0);
            expect(list.atOrdinal(0)).toBeUndefined();
            expect(onRelease).toHaveBeenCalledTimes(2);
        });
    });
});

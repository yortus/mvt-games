import { createSlotList, type Slot, type SlotListOptions, type MutableSlot } from './slot-list';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A `SlotList` with a logical order layered on top. Every live item has an
 * `ordinal` in `[0, liveCount)`; storage slots keep their stable index for
 * identity and `<List>` projection, exactly as in `SlotList`.
 *
 * `remove` detaches an item from the order at once - the survivors renumber to
 * close the gap - while its slot lingers pending release (per `releaseDelayMs`)
 * so the view can still animate the exit. A detached slot's ordinal is -1.
 *
 * Typical uses are small, user-ordered UI lists whose items animate out: a card
 * hand, a toast stack, an initiative tracker, a playlist.
 */
export interface OrderedSlotList<T> {
    /** Storage slots allocated, including those pending release. For `<List>`. */
    readonly slotCount: number;

    /** Items in the live set, which is also the length of the ordinal space. */
    readonly liveCount: number;

    /** True when no slot is available, so `append`/`insertAt` would throw. */
    readonly isFull: boolean;

    /** The slot at a storage index - live or pending release - or undefined if available. */
    atSlotIndex(index: number): OrderedSlot<T> | undefined;

    /** The live slot at a logical position, or undefined outside `[0, liveCount)`. */
    atOrdinal(ordinal: number): OrderedSlot<T> | undefined;

    /**
     * Calls `visit` for each live item in ordinal order, skipping pending-release
     * slots (which are already detached from the order). Safe to `remove` the
     * visited slot during the walk; inserting during the walk is not. Pass a
     * named callback to avoid a per-frame closure allocation.
     */
    forEachLive(visit: (value: T, slot: OrderedSlot<T>) => void): void;

    /** Adds a value at the end of the order (ordinal `liveCount`). Throws when `isFull`. */
    append(value: T): OrderedSlot<T>;

    /** Adds a value at `ordinal`, shifting the rest up. Clamped to `[0, liveCount]`. Throws when `isFull`. */
    insertAt(ordinal: number, value: T): OrderedSlot<T>;

    /** Moves the item at `fromOrdinal` to `toOrdinal`, shifting the span between. */
    move(fromOrdinal: number, toOrdinal: number): void;

    /** Reorders live items by comparing their values. */
    sort(compare: (a: T, b: T) => number): void;

    /**
     * Detaches from the order now (survivors renumber to close the gap) and
     * removes from the live set; the slot then lingers pending release per the
     * delay. `releaseDelayMs` overrides the list default.
     */
    remove(slot: OrderedSlot<T>, releaseDelayMs?: number): void;

    clear(): void;

    update(deltaMs: number): void;
}

/**
 * A `Slot` that also carries its logical position. `ordinal` is `0..liveCount-1`
 * while live, and -1 once detached (removed, whether pending release or freed).
 */
export interface OrderedSlot<T> extends Slot<T> {
    readonly ordinal: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Composes a `SlotList` and maintains an ordinal -> slot array beside it,
 * writing each slot's `ordinal` field as the order changes. With `n = liveCount`:
 *
 *   slotCount, liveCount, isFull, atSlotIndex, atOrdinal   O(1)
 *   forEachLive                                            O(n)
 *   append                                                 O(1) ordering (plus insert)
 *   insertAt, move, remove                                 O(n)
 *   sort                                                   O(n log n) + O(n)
 *   clear                                                  O(n)
 *   update                                                 forwards to SlotList
 */
export function createOrderedSlotList<T>(options: SlotListOptions<T> = {}): OrderedSlotList<T> {
    const list = createSlotList<T>(options);

    // ordinal -> slot, dense over [0, liveCount). Each slot's ordinal field mirrors its position here.
    const order: MutableSlot<T>[] = [];

    const ordered: OrderedSlotList<T> = {
        get slotCount() { return list.slotCount; },
        get liveCount() { return list.liveCount; },
        get isFull() { return list.isFull; },

        atSlotIndex(index) {
            return list.at(index) as OrderedSlot<T> | undefined;
        },

        atOrdinal(ordinal) {
            if (ordinal < 0 || ordinal >= order.length) return undefined;
            return order[ordinal];
        },

        forEachLive(visit) {
            // `order` compacts when the visited slot is removed, so re-read order[i]
            // and only advance when it still holds the record we just visited.
            let i = 0;
            while (i < order.length) {
                const record = order[i];
                visit(record.value, record);
                if (order[i] === record) i += 1;
            }
        },

        append(value) {
            const record = list.insert(value) as MutableSlot<T>;
            record.ordinal = order.length;
            order.push(record);
            return record;
        },

        insertAt(ordinal, value) {
            const at = clamp(ordinal, 0, order.length);
            const record = list.insert(value) as MutableSlot<T>;
            order.splice(at, 0, record);
            renumberFrom(at);
            return record;
        },

        move(fromOrdinal, toOrdinal) {
            const n = order.length;
            if (fromOrdinal < 0 || fromOrdinal >= n) return;
            const to = clamp(toOrdinal, 0, n - 1);
            if (to === fromOrdinal) return;

            const record = order.splice(fromOrdinal, 1)[0];
            order.splice(to, 0, record);
            renumberFrom(fromOrdinal < to ? fromOrdinal : to);
        },

        sort(compare) {
            order.sort((a, b) => compare(a.value, b.value));
            renumberFrom(0);
        },

        remove(slot, releaseDelayMs) {
            const record = slot as MutableSlot<T>;
            const at = record.ordinal;
            if (at < 0 || at >= order.length || order[at] !== record) return;

            order.splice(at, 1);
            renumberFrom(at);
            record.ordinal = -1;
            list.remove(record, releaseDelayMs);
        },

        clear() {
            list.clear();
            order.length = 0;
        },

        update(deltaMs) {
            list.update(deltaMs);
        },
    };

    return ordered;

    // --- Helpers ---

    function renumberFrom(from: number): void {
        for (let i = from; i < order.length; i++) {
            order[i].ordinal = i;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

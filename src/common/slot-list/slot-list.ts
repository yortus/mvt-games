// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A collection of live items where every item occupies a stable slot for its
 * whole lifetime. Slots are addressed by index over `[0, slotCount)`.
 *
 * A slot has two removal phases: `remove` takes an item out of the live set,
 * then after `releaseDelayMs` the slot is released - its value handed back via
 * `onRelease` and its index made available for a future `insert`. A zero delay
 * releases in the same call; until release the slot is pending release and its
 * value is still readable, so exit effects have something to render.
 *
 * Item identity lives in the `Slot<T>` wrapper, so `T` is unconstrained and
 * references held elsewhere stay correct.
 *
 * Typical uses are churning pools of same-shaped entities: bullets, particles,
 * explosions, enemies, floating damage numbers, or targets a tower keeps a
 * live reference to.
 */
export interface SlotList<T> {
    /** Slots allocated. Indices are [0, slotCount). Shrinks when the tail frees. */
    readonly slotCount: number;

    /** Items in the live set. */
    readonly liveCount: number;

    /** True when no slot is available, so `insert` would throw. */
    readonly isFull: boolean;

    /** The slot at `index` - live or pending release - or undefined if available. */
    at(index: number): Slot<T> | undefined;

    /**
     * Calls `visit` for each live item in storage-index order, skipping empty
     * and pending-release slots. Safe to `remove` the visited slot during the
     * walk; inserting during the walk is not. Pass a named callback to avoid a
     * per-frame closure allocation.
     */
    forEachLive(visit: (value: T, slot: Slot<T>) => void): void;

    /**
     * Places a value in an available slot and returns it. The list chooses the
     * slot (lowest available index). Throws when `isFull`; check it first.
     */
    insert(value: T): Slot<T>;

    /**
     * Takes an item out of the live set. The slot is then pending release for
     * `releaseDelayMs` so exit effects have something to render, and is released
     * once it elapses. A zero delay releases in the same call. `releaseDelayMs`
     * overrides the list default.
     *
     * Dev builds throw if slots pile up pending release before `update` is ever
     * called - the signature of a forgotten `update(deltaMs)` in the tick loop.
     */
    remove(slot: Slot<T>, releaseDelayMs?: number): void;

    /** Releases every slot immediately, live and pending-release alike. */
    clear(): void;

    /** Advances the release clock and releases slots whose delay has elapsed. */
    update(deltaMs: number): void;
}

/**
 * A slot's identity is its own object identity, unique for the lifetime of the
 * item it holds. Three plain fields, no getters.
 */
export interface Slot<T> {
    /** True while in the live set; false once removed, whether pending release or released. */
    readonly isLive: boolean;

    /** Position in the list, stable for the item's whole lifetime. */
    readonly index: number;

    /** The wrapped item. */
    readonly value: T;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface SlotListOptions<T> {
    /** A domain bound, not a performance knob. Omit unless the domain has one. */
    maxSlots?: number;

    /** How long a removed item's slot is pending release before it is released. */
    releaseDelayMs?: number;

    /** The list is finished with this value. Return it to a pool, free resources. */
    onRelease?: (value: T) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Array-backed implementation. Per-member complexity of this implementation,
 * with `n = slotCount` and `p` the number of slots pending release:
 *
 *   slotCount, liveCount, isFull, at   O(1)
 *   forEachLive                        O(n)
 *   insert                             O(n) worst case, amortised ~O(1) via a lowest-free-index hint
 *   remove                             O(log p) delayed, amortised O(1) immediate
 *   clear                              O(n)
 *   update                             O(1) idle, O(k log p) to release k slots
 */
export function createSlotList<T>(options: SlotListOptions<T> = {}): SlotList<T> {
    const maxSlots = options.maxSlots;
    const defaultReleaseDelayMs = options.releaseDelayMs ?? 0;
    const onRelease = options.onRelease;

    // slots[i] holds the record while index i is live or pending release; undefined once available.
    const slots: (MutableSlot<T> | undefined)[] = [];

    // Records pending release, ordered by releaseAtMs, so `update` releases only those now due.
    const pendingRelease: MutableSlot<T>[] = [];

    let slotCount = 0;
    let liveCount = 0;
    let nowMs = 0;
    let hasUpdated = false;

    // Lower bound on the lowest available index: every index below it is occupied.
    let lowestFreeHint = 0;

    const list: SlotList<T> = {
        get slotCount() { return slotCount; },
        get liveCount() { return liveCount; },
        get isFull() { return computeIsFull(); },

        at(index) {
            if (index < 0 || index >= slotCount) return undefined;
            return slots[index];
        },

        forEachLive(visit) {
            for (let i = 0; i < slotCount; i++) {
                const slot = slots[i];
                if (slot !== undefined && slot.isLive) visit(slot.value, slot);
            }
        },

        insert(value) {
            if (computeIsFull()) {
                throw new Error('SlotList.insert: list is full; check isFull first');
            }

            let index = lowestFreeHint;
            while (index < slotCount && slots[index] !== undefined) {
                index += 1;
            }
            if (index === slotCount) {
                slotCount += 1;
            }
            lowestFreeHint = index + 1;

            const record: MutableSlot<T> = { isLive: true, index, value, releaseAtMs: 0, ordinal: -1 };
            slots[index] = record;
            liveCount += 1;
            return record;
        },

        remove(slot, releaseDelayMs) {
            const record = slot as MutableSlot<T>;
            if (slots[record.index] !== record || !record.isLive) return;

            record.isLive = false;
            liveCount -= 1;

            const delay = releaseDelayMs ?? defaultReleaseDelayMs;
            if (delay <= 0) {
                release(record);
                return;
            }

            record.releaseAtMs = nowMs + delay;
            heapPush(pendingRelease, record);

            if (DEV && !hasUpdated && pendingRelease.length >= PENDING_RELEASE_LEAK_THRESHOLD) {
                throw new Error(
                    `SlotList: ${pendingRelease.length} slots are pending release but update(deltaMs) `
                    + 'has never been called; drive update() from the tick loop so removed slots are released.',
                );
            }
        },

        clear() {
            for (let i = 0; i < slotCount; i++) {
                const record = slots[i];
                if (record === undefined) continue;
                record.isLive = false;
                slots[i] = undefined;
                onRelease?.(record.value);
            }
            slots.length = 0;
            pendingRelease.length = 0;
            slotCount = 0;
            liveCount = 0;
            lowestFreeHint = 0;
        },

        update(deltaMs) {
            hasUpdated = true;
            nowMs += deltaMs;
            while (pendingRelease.length > 0 && pendingRelease[0].releaseAtMs <= nowMs) {
                const record = heapPop(pendingRelease);
                if (record === undefined) break;
                release(record);
            }
        },
    };

    return list;

    // --- Helpers ---

    function computeIsFull(): boolean {
        return maxSlots !== undefined && liveCount + pendingRelease.length >= maxSlots;
    }

    function release(record: MutableSlot<T>): void {
        const index = record.index;
        slots[index] = undefined;
        onRelease?.(record.value);
        if (index < lowestFreeHint) lowestFreeHint = index;
        while (slotCount > 0 && slots[slotCount - 1] === undefined) {
            slotCount -= 1;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// Vite replaces `import.meta.env.DEV` at build time; plain Node (the bench/test
// harness) has no `import.meta.env`, so it is read defensively.
const DEV = import.meta.env?.DEV === true;

// Dev-only trip-wire: this many slots pending release before the first update()
// almost certainly means update(deltaMs) was never wired into the tick loop.
const PENDING_RELEASE_LEAK_THRESHOLD = 1024;

// The record shared with the ordered variant. `ordinal` is inert for a plain
// SlotList (left at -1) and owned by `createOrderedSlotList`; it is here so both
// factories allocate one record shape.
export interface MutableSlot<T> {
    isLive: boolean;
    index: number;
    value: T;
    releaseAtMs: number;
    ordinal: number;
}

function heapPush<T>(heap: MutableSlot<T>[], record: MutableSlot<T>): void {
    heap.push(record);
    let i = heap.length - 1;
    while (i > 0) {
        const parent = (i - 1) >> 1;
        if (heap[parent].releaseAtMs <= heap[i].releaseAtMs) break;
        const tmp = heap[parent];
        heap[parent] = heap[i];
        heap[i] = tmp;
        i = parent;
    }
}

function heapPop<T>(heap: MutableSlot<T>[]): MutableSlot<T> | undefined {
    const n = heap.length;
    if (n === 0) return undefined;
    const top = heap[0];
    const last = heap[n - 1];
    heap.length = n - 1;
    if (heap.length > 0) {
        heap[0] = last;
        siftDown(heap, 0);
    }
    return top;
}

function siftDown<T>(heap: MutableSlot<T>[], start: number): void {
    const n = heap.length;
    let i = start;
    let left = 2 * i + 1;
    while (left < n) {
        const right = left + 1;
        let smaller = left;
        if (right < n && heap[right].releaseAtMs < heap[left].releaseAtMs) smaller = right;
        if (heap[i].releaseAtMs <= heap[smaller].releaseAtMs) break;
        const tmp = heap[i];
        heap[i] = heap[smaller];
        heap[smaller] = tmp;
        i = smaller;
        left = 2 * i + 1;
    }
}

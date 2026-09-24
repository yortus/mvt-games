import { createOrderedSlotList, type OrderedSlotList } from '#common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface Card {
    readonly label: string;
    readonly color: number;
}

export interface OrderedListDemoModel {
    readonly list: OrderedSlotList<Card>;
    /** Human-readable description of the operation just performed. */
    readonly caption: string;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * A scripted tour of `OrderedSlotList`, advanced purely by `update(deltaMs)`.
 * Each step performs one mutation - append, sort, move, insertAt, remove - and
 * the view animates the consequences (reorder slides, exit fades) on its own.
 */
export function createOrderedListDemoModel(): OrderedListDemoModel {
    const list = createOrderedSlotList<Card>({ maxSlots: MAX_CARDS, releaseDelayMs: EXIT_MS });

    let caption = '';
    let elapsedMs = 0;
    let step = -1;

    const model: OrderedListDemoModel = {
        get list() { return list; },
        get caption() { return caption; },
        update,
    };

    return model;

    function update(deltaMs: number): void {
        list.update(deltaMs);
        elapsedMs += deltaMs;
        const target = Math.floor(elapsedMs / STEP_MS);
        while (step < target) {
            step += 1;
            runStep(step % STEP_COUNT);
        }
    }

    function runStep(i: number): void {
        switch (i) {
            case 0:
                list.clear();
                append('A');
                append('B');
                append('C');
                append('D');
                append('E');
                caption = 'append A - E';
                break;
            case 1:
                list.sort(byLabelDescending);
                caption = 'sort descending';
                break;
            case 2:
                if (list.liveCount > 1) list.move(list.liveCount - 1, 0);
                caption = 'move last -> front';
                break;
            case 3:
                insertAt(2, 'X');
                caption = 'insertAt(2, X)';
                break;
            case 4:
                removeOrdinal(Math.floor(list.liveCount / 2));
                caption = 'remove middle (others close the gap)';
                break;
            case 5:
                removeOrdinal(0);
                caption = 'remove front';
                break;
            case 6:
                append('Y');
                caption = 'append Y';
                break;
        }
    }

    function append(label: string): void {
        if (!list.isFull) list.append(cardFor(label));
    }

    function insertAt(ordinal: number, label: string): void {
        if (!list.isFull) list.insertAt(ordinal, cardFor(label));
    }

    function removeOrdinal(ordinal: number): void {
        const slot = list.ordered.at(ordinal);
        if (slot !== undefined) list.remove(slot);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const MAX_CARDS = 12;
const EXIT_MS = 700;
const STEP_MS = 1500;
const STEP_COUNT = 7;

const COLORS: Record<string, number> = {
    A: 0xef4444,
    B: 0xf59e0b,
    C: 0x22c55e,
    D: 0x3b82f6,
    E: 0xa855f7,
    X: 0xec4899,
    Y: 0x14b8a6,
};

function cardFor(label: string): Card {
    return { label, color: COLORS[label] ?? 0x8b949e };
}

function byLabelDescending(a: Card, b: Card): number {
    if (a.label < b.label) return 1;
    if (a.label > b.label) return -1;
    return 0;
}

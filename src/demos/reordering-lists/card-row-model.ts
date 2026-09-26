import { createOrderedSlotList, type OrderedSlotList } from '#common';

/**
 * One row of cards, held two ways so the demo can compare them: as a plain
 * array and as an `OrderedSlotList`. A scripted tour mutates both identically,
 * one step at a time, advanced purely by `update(deltaMs)`.
 *
 * There is no notion of position in pixels, of motion, or of animation here.
 * Every mutation is instantaneous; everything the eye sees moving is
 * presentation state, owned by the view side.
 */

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface Card {
    /** Dense: ids run 0..CARD_COUNT-1, one per card, for the life of the model. */
    readonly id: number;
    readonly label: string;
    readonly color: number;
}

export interface CardRowModel {
    /**
     * The row as a plain array, in order. Cards move between indices as the
     * row reorders, and a removed card is gone at once. The same array for the
     * model's lifetime.
     */
    readonly cardArray: readonly Card[];
    /**
     * The same row as an `OrderedSlotList`. Each card keeps its storage slot
     * while it is in the row, and its `ordinal` is its position. A removed card
     * keeps its slot, no longer live, for a release delay.
     */
    readonly cardSlots: OrderedSlotList<Card>;
    /** Human-readable description of the step just performed. */
    readonly caption: string;
    /** Move a card to the front of the row, in both forms. Ignored if the card is not in the row. */
    moveToFront: (card: Card) => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCardRowModel(): CardRowModel {
    const cardArray: Card[] = [];
    const cardSlots = createOrderedSlotList<Card>({ maxSlots: CARDS.length, releaseDelayMs: EXIT_MS });

    let caption = '';
    let elapsedMs = 0;
    let step = -1;

    const model: CardRowModel = {
        cardArray,
        cardSlots,
        get caption() { return caption; },
        moveToFront,
        update,
    };

    // Run the first step now, so the row is populated before the first frame.
    update(0);
    return model;

    function update(deltaMs: number): void {
        cardSlots.update(deltaMs);
        elapsedMs += deltaMs;
        const target = Math.floor(elapsedMs / STEP_MS);
        while (step < target) {
            step += 1;
            runStep(step % STEP_COUNT);
        }
    }

    function moveToFront(card: Card): void {
        const index = cardArray.indexOf(card);
        if (index < 0) return;
        move(index, 0);
        caption = 'move ' + card.label + ' -> front';
    }

    function runStep(i: number): void {
        switch (i) {
            case 0:
                cardArray.length = 0;
                cardSlots.clear();
                append('A');
                append('B');
                append('C');
                append('D');
                append('E');
                caption = 'append A - E';
                break;
            case 1:
                cardArray.sort(byLabelDescending);
                cardSlots.sort(byLabelDescending);
                caption = 'sort descending';
                break;
            case 2:
                move(cardArray.length - 1, 0);
                caption = 'move last -> front';
                break;
            case 3:
                insertAt(2, 'X');
                caption = 'insert X at 2';
                break;
            case 4:
                removeAt(Math.floor(cardArray.length / 2));
                caption = 'remove middle';
                break;
            case 5:
                removeAt(0);
                caption = 'remove front';
                break;
            case 6:
                append('Y');
                caption = 'append Y';
                break;
        }
    }

    // --- Mutations, applied to both forms alike -----------------------------

    function append(label: string): void {
        insertAt(cardArray.length, label);
    }

    function insertAt(index: number, label: string): void {
        const card = cardFor(label);
        cardArray.splice(index, 0, card);
        cardSlots.insertAt(index, card);
    }

    function move(from: number, to: number): void {
        if (from === to || from < 0 || from >= cardArray.length) return;
        const card = cardArray[from];
        cardArray.splice(from, 1);
        cardArray.splice(to, 0, card);
        cardSlots.move(from, to);
    }

    function removeAt(index: number): void {
        if (index < 0 || index >= cardArray.length) return;
        cardArray.splice(index, 1);
        const slot = cardSlots.ordered.at(index);
        if (slot !== undefined) cardSlots.remove(slot);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const EXIT_MS = 700;
const STEP_MS = 1500;
const STEP_COUNT = 7;

/** Every card the script uses, created once, so each label keeps its id. */
const CARDS: readonly Card[] = [
    { id: 0, label: 'A', color: 0xef4444 },
    { id: 1, label: 'B', color: 0xf59e0b },
    { id: 2, label: 'C', color: 0x22c55e },
    { id: 3, label: 'D', color: 0x3b82f6 },
    { id: 4, label: 'E', color: 0xa855f7 },
    { id: 5, label: 'X', color: 0xec4899 },
    { id: 6, label: 'Y', color: 0x14b8a6 },
];

function cardFor(label: string): Card {
    for (let i = 0; i < CARDS.length; i++) {
        if (CARDS[i].label === label) return CARDS[i];
    }
    throw new Error('No card labelled ' + label);
}

function byLabelDescending(a: Card, b: Card): number {
    if (a.label < b.label) return 1;
    if (a.label > b.label) return -1;
    return 0;
}

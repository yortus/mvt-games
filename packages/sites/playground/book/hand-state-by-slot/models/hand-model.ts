import { createOrderedSlotList, type IndexedSlots, type OrderedSlot } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How many cards the hand starts with. */
const START_SIZE = 5;
/** The most cards the hand can hold. */
const MAX_SIZE = 7;
/** How long a played card keeps its slot, in ms. */
const EXIT_MS = 600;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A card from the deck. */
export interface Card {
    readonly id: number;
    readonly label: string;
    readonly color: number;
}

/**
 * A hand of cards, held in an `OrderedSlotList`. Each card keeps its storage
 * slot for as long as it's in the hand, and its ordinal is its place in the
 * hand, from left to right. A played card leaves the order at once, but
 * keeps its slot, no longer live, for a moment, so a view can show it
 * leaving.
 */
export interface HandModel {
    /** The hand's storage slots, including played cards waiting to be released. */
    readonly slots: IndexedSlots<OrderedSlot<Card>>;
    /** Plays the card at this place in the hand, which takes it out of the hand. */
    readonly playAt: (ordinal: number) => void;
    /** Deals the next card from the deck onto the right of the hand, if the hand has room. */
    readonly deal: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a hand of the deck's first five cards. */
export function createHandModel(): HandModel {
    // A played card keeps its slot for EXIT_MS before it's released
    const hand = createOrderedSlotList<Card>({ releaseDelayMs: EXIT_MS });
    // The deck's next card to deal
    let nextId = 0;
    for (let i = 0; i < START_SIZE; i++) deal();

    const model: HandModel = {
        slots: hand.slots,

        playAt(ordinal) {
            const slot = hand.ordered.at(ordinal);
            if (slot !== undefined) hand.remove(slot);
        },

        deal,

        update(deltaMs) {
            // Releases the slots of played cards whose time is up
            hand.update(deltaMs);
        },
    };

    return model;

    function deal(): void {
        if (hand.liveCount >= MAX_SIZE) return;
        // Skip the cards already in the hand. The deck is bigger than the
        // hand, so one is always left.
        while (isInHand(nextId)) nextId = (nextId + 1) % DECK.length;
        hand.append(DECK[nextId]);
        nextId = (nextId + 1) % DECK.length;
    }

    function isInHand(id: number): boolean {
        for (let i = 0; i < hand.ordered.length; i++) {
            if (hand.ordered.at(i)?.value.id === id) return true;
        }
        return false;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The whole deck. */
const DECK: readonly Card[] = [
    { id: 0, label: 'A', color: 0xe05561 },
    { id: 1, label: 'B', color: 0xe8a33d },
    { id: 2, label: 'C', color: 0x4cb860 },
    { id: 3, label: 'D', color: 0x3d8fe8 },
    { id: 4, label: 'E', color: 0x9b6be0 },
    { id: 5, label: 'F', color: 0x2fb5a8 },
    { id: 6, label: 'G', color: 0xd96bb5 },
    { id: 7, label: 'H', color: 0x8a9a3a },
];

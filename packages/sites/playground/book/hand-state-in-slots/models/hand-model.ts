// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How many cards the hand starts with. */
const START_SIZE = 5;
/** The most cards the hand can hold. */
const MAX_SIZE = 7;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A card from the deck. */
export interface Card {
    /** A small whole number, from 0 up, that no other card in the deck has. */
    readonly id: number;
    readonly label: string;
    readonly color: number;
}

/**
 * A hand of cards, held as a plain array. Playing a card splices it out of
 * the array, and dealing a card pushes the next one from the deck onto the
 * end. Nothing in the hand changes with time.
 */
export interface HandModel {
    /** The cards in the hand, from left to right. */
    readonly hand: readonly Card[];
    /** Plays the card at this place in the hand, which takes it out of the hand. */
    readonly playAt: (index: number) => void;
    /** Deals the next card from the deck onto the right of the hand, if the hand has room. */
    readonly deal: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a hand of the deck's first five cards. */
export function createHandModel(): HandModel {
    const hand: Card[] = [];
    // The deck's next card to deal
    let nextId = 0;
    for (let i = 0; i < START_SIZE; i++) deal();

    const model: HandModel = {
        hand,

        playAt(index) {
            if (index < 0 || index >= hand.length) return;
            hand.splice(index, 1);
        },

        deal,

        update(_deltaMs) {
            // Nothing in the hand changes with time
        },
    };

    return model;

    function deal(): void {
        if (hand.length >= MAX_SIZE) return;
        // Skip the cards already in the hand. The deck is bigger than the
        // hand, so one is always left.
        while (isInHand(nextId)) nextId = (nextId + 1) % DECK.length;
        hand.push(DECK[nextId]);
        nextId = (nextId + 1) % DECK.length;
    }

    function isInHand(id: number): boolean {
        for (let i = 0; i < hand.length; i++) {
            if (hand[i].id === id) return true;
        }
        return false;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The whole deck. Each card's id is its place in the deck. */
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

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long a card takes to open, or to close, in ms. */
const TRANSITION_MS = 700;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What the gallery is doing: showing every card, or opening, showing or closing one. */
export type GalleryPhase = 'browsing' | 'opening' | 'open' | 'closing';

/**
 * A gallery of cards. Opening a card, and closing it again, each take a
 * moment, which `progress` follows. The model knows nothing of where the
 * cards are drawn. That's up to the view.
 */
export interface GalleryModel {
    readonly cardCount: number;
    readonly phase: GalleryPhase;
    /** How far through opening or closing the gallery is, from 0 to 1. */
    readonly progress: number;
    /** The card that is open, or opening or closing. */
    readonly openIndex: number;
    /** Opens a card, if the gallery is showing every card. */
    readonly openCard: (index: number) => void;
    /** Closes the open card, if one is open. */
    readonly closeCard: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a gallery of six cards, showing every card. */
export function createGalleryModel(): GalleryModel {
    let phase: GalleryPhase = 'browsing';
    let openIndex = 0;
    // How long the gallery has been opening or closing, in ms
    let elapsedMs = 0;

    const model: GalleryModel = {
        cardCount: CARD_COUNT,
        get phase() { return phase; },
        get progress() {
            if (phase === 'opening' || phase === 'closing') return Math.min(elapsedMs / TRANSITION_MS, 1);
            return phase === 'open' ? 1 : 0;
        },
        get openIndex() { return openIndex; },

        openCard(index) {
            if (phase !== 'browsing') return;
            openIndex = index;
            phase = 'opening';
            elapsedMs = 0;
        },

        closeCard() {
            if (phase !== 'open') return;
            phase = 'closing';
            elapsedMs = 0;
        },

        update(deltaMs) {
            if (phase !== 'opening' && phase !== 'closing') return;
            elapsedMs += deltaMs;
            if (elapsedMs < TRANSITION_MS) return;
            phase = phase === 'opening' ? 'open' : 'browsing';
        },
    };

    return model;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const CARD_COUNT = 6;

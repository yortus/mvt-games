import type { IndexedSlots, OrderedSlot } from '#common';

/**
 * Presentation state for a row held as an `OrderedSlotList`: each card eases
 * toward its position, fades in when it enters, and fades and rises when it is
 * removed. The model knows about none of this.
 *
 * A card keeps its storage slot for as long as it is in the row, so the state
 * is stored per storage index, and `<List items={list.slots}>` reads it back
 * by the same index. No ids, and no republishing: a reorder changes each
 * slot's `ordinal`, the card eases toward the new position, and it slides.
 * One reference comparison per slot notices when a slot has a new card.
 *
 * A removed card leaves the order at once but keeps its slot for the list's
 * release delay, no longer live. Its view is still there to animate, so it
 * fades out where it stood while the cards after it close the gap.
 */

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface SlotRowViewModel {
    /** Eased X of the card in storage slot `index`, relative to the row, in pixels. */
    getX: (index: number) => number;
    /** Eased Y of the card in storage slot `index`: 0 while live, rising once removed. */
    getY: (index: number) => number;
    getAlpha: (index: number) => number;
    getScale: (index: number) => number;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface SlotRowViewModelOptions {
    /** The list's storage slots, `OrderedSlotList.slots`. */
    readonly slots: IndexedSlots<OrderedSlot<unknown>>;
    readonly pitchPx: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSlotRowViewModel(options: SlotRowViewModelOptions): SlotRowViewModel {
    const { slots, pitchPx } = options;

    // Presentation state per storage slot, indexed as `slots` is.
    const cosmetics: SlotCosmetic[] = [];

    return {
        getX: (index) => cosmetics[index].x,
        getY: (index) => cosmetics[index].y,
        getAlpha: (index) => cosmetics[index].alpha,
        getScale: (index) => cosmetics[index].scale,
        update,
    };

    function update(deltaMs: number): void {
        const count = slots.length;
        const ease = 1 - Math.exp(-deltaMs / SMOOTH_MS);

        for (let i = 0; i < count; i++) {
            let cosmetic = cosmetics[i];
            if (cosmetic === undefined) {
                cosmetic = { owner: undefined, x: 0, y: 0, alpha: 0, scale: 0 };
                cosmetics[i] = cosmetic;
            }

            const slot = slots.at(i);
            if (slot === undefined) {
                cosmetic.owner = undefined;
                continue;
            }

            // A new card in this slot: start it at its target, small and
            // transparent, rather than where the slot's last card was.
            if (cosmetic.owner !== slot) {
                cosmetic.owner = slot;
                cosmetic.x = (slot.ordinal < 0 ? 0 : slot.ordinal) * pitchPx;
                cosmetic.y = 0;
                cosmetic.alpha = 0;
                cosmetic.scale = ENTRANCE_SCALE;
            }

            if (slot.isLive) {
                cosmetic.x += (slot.ordinal * pitchPx - cosmetic.x) * ease;
                cosmetic.y += (0 - cosmetic.y) * ease;
                cosmetic.alpha += (1 - cosmetic.alpha) * ease;
                cosmetic.scale += (1 - cosmetic.scale) * ease;
            }
            else {
                // Removed, pending release: fade and rise where it stands.
                cosmetic.y += (-EXIT_RISE_PX - cosmetic.y) * ease;
                cosmetic.alpha += (0 - cosmetic.alpha) * ease;
                cosmetic.scale += (EXIT_SCALE - cosmetic.scale) * ease;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface SlotCosmetic {
    /** The slot this state was last updated for; a different one means a new card. */
    owner: OrderedSlot<unknown> | undefined;
    x: number;
    y: number;
    alpha: number;
    scale: number;
}

const SMOOTH_MS = 110;
const ENTRANCE_SCALE = 0.4;
const EXIT_SCALE = 0.7;
const EXIT_RISE_PX = 32;

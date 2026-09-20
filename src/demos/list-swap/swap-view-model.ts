/**
 * Presentation state for a row of tiles: each tile eases toward its slot and
 * pulses when it lands in a new one. The model knows about none of this.
 *
 * The `keyBy` option is the entire point of this demo. It selects what the
 * cosmetic state is attached to:
 *
 * - `'slot'` attaches it to list position. A slot's eased position is already
 *   sitting exactly where that slot is, so a swap cannot move anything: the
 *   labels change places instantly and nothing animates. Slot-keyed state
 *   cannot see a reorder at all.
 * - `'item'` attaches it to tile id. After a swap each tile is easing toward a
 *   different slot, so the tiles slide past each other. Nothing detects the
 *   swap; the targets simply changed.
 *
 * Per frame, per tile, the loop costs one `getTileId` call, one array index,
 * two comparisons and some arithmetic. `update()` is a hot path, so the
 * cosmetic store is an array indexed by dense id, never a hash map.
 */

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What per-tile presentation state is attached to. */
export type CosmeticKeyKind = 'slot' | 'item';

export interface SwapViewModel {
    /** Eased pixel X of the tile currently occupying `index`. */
    getX(index: number): number;
    /** Scale of the tile currently occupying `index`, including its land pulse. */
    getScale(index: number): number;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface SwapViewModelOptions {
    getTileCount(): number;
    /** Must return a stable dense id per tile, so cosmetics can be array-indexed. */
    getTileId(index: number): number;
    readonly keyBy: CosmeticKeyKind;
    readonly pitchPx: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSwapViewModel(options: SwapViewModelOptions): SwapViewModel {
    const isItemKeyed = options.keyBy === 'item';

    // Cosmetic state, indexed by dense integer key. Array index, not a hash
    // lookup, because this is read once per tile per frame.
    const cosmetics: TileCosmetic[] = [];

    // Republished per slot each frame, so every view binding is one array read.
    const slotX: number[] = [];
    const slotScale: number[] = [];

    return { getX, getScale, update };

    function getX(index: number): number {
        return slotX[index];
    }

    function getScale(index: number): number {
        return slotScale[index];
    }

    function update(deltaMs: number): void {
        const count = options.getTileCount();

        // Frame-rate independent factors, hoisted out of the loop.
        const ease = 1 - Math.exp(-EASE_RATE * deltaMs / 1000);
        const decay = Math.exp(-PULSE_DECAY_RATE * deltaMs / 1000);
        const targetBase = options.pitchPx;

        for (let i = 0; i < count; i++) {
            const key = isItemKeyed ? options.getTileId(i) : i;

            let cosmetic = cosmetics[key];
            if (cosmetic === undefined) {
                // First sighting: seed at the target so a tile does not slide
                // in from the origin on its first frame.
                cosmetic = { x: i * targetBase, pulse: 0, slot: i };
                cosmetics[key] = cosmetic;
            }

            // Local, opt-in slot-change detection: one comparison, and the
            // only thing about the reorder the list itself does not know.
            // A keyed reconciler would have preserved this slot's node across
            // the swap, but not its position, so this easing state would be
            // needed either way.
            if (cosmetic.slot !== i) {
                cosmetic.slot = i;
                cosmetic.pulse = 1;
            }

            cosmetic.x += (i * targetBase - cosmetic.x) * ease;
            cosmetic.pulse *= decay;

            slotX[i] = cosmetic.x;
            slotScale[i] = 1 + cosmetic.pulse * PULSE_SCALE;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface TileCosmetic {
    x: number;
    pulse: number;
    /** Slot occupied last frame, used to trigger the land pulse. */
    slot: number;
}

const EASE_RATE = 9;
const PULSE_DECAY_RATE = 5;
const PULSE_SCALE = 0.3;

import { HARDWARE_SPRITES, SPRITE_HEIGHT, SPRITE_POOL_SIZE, type VirtualChip } from './virtual-chip';

// ---------------------------------------------------------------------------
// Multiplexer
// ---------------------------------------------------------------------------

/**
 * Hands the chip's eight hardware sprite slots to the sprites in its pool,
 * top to bottom, the way a multiplexer did between raster interrupts: a slot
 * is reused as soon as the sprite in it has ended, and the lowest free slot
 * (the frontmost) goes first. A sprite that finds every slot busy gets slot
 * -1 and is not drawn; on the real machine it would flicker.
 *
 * Writes `chip.spriteSlot` and `chip.droppedSpriteCount`. Sprites at the same
 * height keep the order they were added in, so whoever adds them can choose
 * which is in front.
 */
export function assignSpriteSlots(chip: VirtualChip): void {
    const count = chip.spriteCount;

    // Order the pool top to bottom: an insertion sort, stable, into a preallocated array
    for (let i = 0; i < count; i++) {
        const y = chip.spriteY[i];
        let j = i;
        while (j > 0 && chip.spriteY[order[j - 1]] > y) {
            order[j] = order[j - 1];
            j--;
        }
        order[j] = i;
    }

    slotFreeFrom.fill(-0x8000);
    let dropped = 0;
    for (let k = 0; k < count; k++) {
        const sprite = order[k];
        const y = chip.spriteY[sprite];
        let slot = -1;
        for (let s = 0; s < HARDWARE_SPRITES; s++) {
            if (slotFreeFrom[s] <= y) {
                slot = s;
                break;
            }
        }
        chip.spriteSlot[sprite] = slot;
        if (slot < 0) {
            dropped++;
            continue;
        }
        slotFreeFrom[slot] = y + SPRITE_HEIGHT * (chip.spriteIsExpandedY[sprite] === 1 ? 2 : 1);
    }
    chip.droppedSpriteCount = dropped;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// Scratch space, preallocated so a frame allocates nothing. Shared by every
// chip: assigning slots runs to completion, so they never overlap.
const order = new Uint8Array(SPRITE_POOL_SIZE);
const slotFreeFrom = new Int32Array(HARDWARE_SPRITES);

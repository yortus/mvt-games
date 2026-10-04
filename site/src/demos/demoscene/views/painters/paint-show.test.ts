import { describe, expect, it } from 'vitest';
import { MS_PER_BAR, SHOW_SCRIPT } from '../../data';
import { BALLS_PER_RING, createShowModel, RING_COUNT } from '../../models';
import { assignSpriteSlots, composeFrame, createVirtualChip, FRAME_HEIGHT, FRAME_WIDTH, HARDWARE_SPRITES } from '../chip';
import { paintShow } from './paint-show';

describe('paintShow', () => {
    it('never asks the multiplexer for more sprites than a line can show, all through the show', () => {
        const show = createShowModel();
        const chip = createVirtualChip();
        // The PAL machine's 50 frames a second, the whole loop
        let frames = 0;
        let sawSprites = 0;
        for (let t = 0; t < show.loopMs; t += 20) {
            show.seek(t);
            chip.reset();
            paintShow(chip, show);
            assignSpriteSlots(chip);
            if (chip.droppedSpriteCount !== 0) {
                throw new Error(`${chip.droppedSpriteCount} sprites dropped at ${t} ms, in the ${show.part} part`);
            }
            sawSprites = Math.max(sawSprites, chip.spriteCount);
            frames++;
        }
        expect(frames).toBe(Math.ceil(show.loopMs / 20));
        expect(sawSprites).toBe(BALLS_PER_RING * RING_COUNT);
    });

    it('shows eight sprites on the sprite part\'s busiest lines, and never more', () => {
        const show = createShowModel();
        show.skipParts(SHOW_SCRIPT.findIndex((s) => s.part === 'sprites'));
        const chip = createVirtualChip();
        const frame = new Uint8Array(FRAME_WIDTH * FRAME_HEIGHT);
        chip.reset();
        paintShow(chip, show);
        composeFrame(chip, frame);
        expect(Math.max(...chip.spritesOnLine)).toBe(HARDWARE_SPRITES);
    });

    // A picture of each part at a moment, as a hash of its frame of colours. A
    // change here means the picture changed: look at it in the browser, and if
    // it is as intended, update the snapshots (`vitest -u`).
    it('draws the same frames as before', () => {
        const show = createShowModel();
        const chip = createVirtualChip();
        const frame = new Uint8Array(FRAME_WIDTH * FRAME_HEIGHT);
        const hashes: Record<string, string> = {};
        let startMs = 0;
        for (let i = 0; i < SHOW_SCRIPT.length; i++) {
            const { part, bars } = SHOW_SCRIPT[i];
            show.seek(startMs + Math.min(bars / 2, 3.25) * MS_PER_BAR);
            chip.reset();
            paintShow(chip, show);
            composeFrame(chip, frame);
            hashes[part] = fnv1a(frame);
            startMs += bars * MS_PER_BAR;
        }
        expect(hashes).toMatchSnapshot();
    });
});

/** FNV-1a, 32 bits, as hex. */
function fnv1a(bytes: Uint8Array): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) {
        hash ^= bytes[i];
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

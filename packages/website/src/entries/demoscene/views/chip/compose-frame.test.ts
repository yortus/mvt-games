import { describe, expect, it } from 'vitest';
import { BLACK, BLOCK_CHAR, BLUE, CYAN, LIGHT_BLUE, RED, WHITE, YELLOW } from '../../data';
import { composeFrame } from './compose-frame';
import {
    bitmapIndex, createVirtualChip, DISPLAY_HEIGHT, DISPLAY_LEFT, DISPLAY_TOP, DISPLAY_WIDTH, FRAME_HEIGHT,
    FRAME_WIDTH, SPRITE_HEIGHT, SPRITE_WIDTH, type VirtualChip,
} from './virtual-chip';

describe('composeFrame', () => {
    it('draws the border round the display window, and the background inside', () => {
        const chip = createVirtualChip();
        chip.border.fill(LIGHT_BLUE);
        chip.background.fill(BLUE);
        const frame = compose(chip);
        expect(at(frame, 0, 0)).toBe(LIGHT_BLUE);
        expect(at(frame, DISPLAY_LEFT - 1, DISPLAY_TOP)).toBe(LIGHT_BLUE);
        expect(at(frame, DISPLAY_LEFT, DISPLAY_TOP)).toBe(BLUE);
        expect(at(frame, DISPLAY_LEFT, DISPLAY_TOP - 1)).toBe(LIGHT_BLUE);
        expect(at(frame, DISPLAY_LEFT + DISPLAY_WIDTH - 1, DISPLAY_TOP + DISPLAY_HEIGHT - 1)).toBe(BLUE);
        expect(at(frame, DISPLAY_LEFT + DISPLAY_WIDTH, DISPLAY_TOP + DISPLAY_HEIGHT - 1)).toBe(LIGHT_BLUE);
    });

    it('draws a text cell in its one colour from colour memory, on the line\'s background', () => {
        const chip = createVirtualChip();
        chip.screen[0] = BLOCK_CHAR;
        chip.colour[0] = YELLOW;
        chip.screen[1] = 'I'.charCodeAt(0);
        chip.colour[1] = WHITE;
        const frame = compose(chip);
        expect(at(frame, DISPLAY_LEFT, DISPLAY_TOP)).toBe(YELLOW);
        expect(at(frame, DISPLAY_LEFT + 7, DISPLAY_TOP + 7)).toBe(YELLOW);
        // "I" has a blank first column and a bar along its top
        expect(at(frame, DISPLAY_LEFT + 8, DISPLAY_TOP)).toBe(BLACK);
        expect(at(frame, DISPLAY_LEFT + 9, DISPLAY_TOP)).toBe(WHITE);
    });

    it('draws multicolour text with two shared colours, and hires where the cell colour is below 8', () => {
        const chip = createVirtualChip();
        chip.setMode(0, FRAME_HEIGHT, 'multicolour-text');
        chip.multicolour1.fill(RED);
        chip.multicolour2.fill(CYAN);
        chip.background.fill(BLUE);
        // Character 200, row 0: bit pairs 00 01 10 11
        chip.charset[200 * 8] = 0b00011011;
        chip.screen[0] = 200;
        chip.colour[0] = 8 + YELLOW;
        chip.screen[1] = 200;
        chip.colour[1] = WHITE;
        const frame = compose(chip);
        const y = DISPLAY_TOP;
        expect([0, 2, 4, 6].map((x) => at(frame, DISPLAY_LEFT + x, y))).toEqual([BLUE, RED, CYAN, YELLOW]);
        expect(at(frame, DISPLAY_LEFT + 1, y)).toBe(BLUE);
        // Hires cell: bits 0001 1011
        expect([0, 3, 4, 5, 6, 7].map((x) => at(frame, DISPLAY_LEFT + 8 + x, y))).toEqual([BLUE, WHITE, WHITE, BLUE, WHITE, WHITE]);
    });

    it('draws multicolour bitmaps with three colours of each cell\'s own', () => {
        const chip = createVirtualChip();
        chip.setMode(0, FRAME_HEIGHT, 'multicolour-bitmap');
        chip.screen[0] = (RED << 4) | CYAN;
        chip.colour[0] = YELLOW;
        // Display line 9 is in the second row of cells, so it takes cell 40's colours, not cell 0's
        chip.bitmap[bitmapIndex(0, 9)] = 0b00011011;
        chip.screen[40] = (WHITE << 4) | BLUE;
        chip.colour[40] = LIGHT_BLUE;
        const frame = compose(chip);
        const y = DISPLAY_TOP + 9;
        expect([0, 2, 4, 6].map((x) => at(frame, DISPLAY_LEFT + x, y))).toEqual([BLACK, WHITE, BLUE, LIGHT_BLUE]);
    });

    it('shifts a line by its offset and shows another display line by its source line', () => {
        const chip = createVirtualChip();
        chip.screen[0] = BLOCK_CHAR;
        chip.colour[0] = WHITE;
        chip.xOffset[DISPLAY_TOP] = 3;
        chip.sourceLine[DISPLAY_TOP + 50] = 2;
        chip.sourceLine[DISPLAY_TOP + 1] = -1;
        const frame = compose(chip);
        expect(at(frame, DISPLAY_LEFT + 2, DISPLAY_TOP)).toBe(BLACK);
        expect(at(frame, DISPLAY_LEFT + 3, DISPLAY_TOP)).toBe(WHITE);
        expect(at(frame, DISPLAY_LEFT + 10, DISPLAY_TOP)).toBe(WHITE);
        expect(at(frame, DISPLAY_LEFT + 11, DISPLAY_TOP)).toBe(BLACK);
        expect(at(frame, DISPLAY_LEFT, DISPLAY_TOP + 50)).toBe(WHITE);
        expect(at(frame, DISPLAY_LEFT, DISPLAY_TOP + 1)).toBe(BLACK);
    });

    it('hides sprites in the borders unless the top and bottom are opened', () => {
        const chip = createVirtualChip();
        chip.spriteShapes.fill(0xff, 0, SHAPE_BYTES);
        chip.border.fill(LIGHT_BLUE);
        // Straddling the left border, in the top border
        const left = DISPLAY_LEFT - 4;
        chip.addSprite(left, 0, 0, YELLOW);
        let frame = compose(chip);
        expect(at(frame, DISPLAY_LEFT, 0)).toBe(LIGHT_BLUE);

        chip.hasOpenBorders = true;
        frame = compose(chip);
        expect(at(frame, DISPLAY_LEFT, 0)).toBe(YELLOW);
        expect(at(frame, left + SPRITE_WIDTH - 1, SPRITE_HEIGHT - 1)).toBe(YELLOW);
        // Never in the side border
        expect(at(frame, DISPLAY_LEFT - 1, 0)).toBe(LIGHT_BLUE);
        // The opened border shows the background where no sprite is
        expect(at(frame, left + SPRITE_WIDTH, 0)).toBe(BLACK);
    });

    it('expands sprites, draws multicolour ones, and puts lower slots in front', () => {
        const chip = createVirtualChip();
        chip.spriteShapes[0] = 0b01101100; // multicolour pairs 01 10 11 00
        chip.spriteShapes.fill(0xff, 64, 64 + SHAPE_BYTES);
        chip.spriteMulticolour1 = RED;
        chip.spriteMulticolour2 = CYAN;
        const front = chip.addSprite(100, 100, 0, YELLOW);
        chip.spriteIsMulticolour[front] = 1;
        chip.spriteIsExpandedX[front] = 1;
        const back = chip.addSprite(100, 100, 1, WHITE);
        chip.spriteIsExpandedY[back] = 1;
        const frame = compose(chip);
        expect([100, 104, 108].map((x) => at(frame, x, 100))).toEqual([RED, YELLOW, CYAN]);
        expect(at(frame, 103, 100)).toBe(RED);
        // Where the front sprite is transparent, the back one shows
        expect(at(frame, 112, 100)).toBe(WHITE);
        // The back sprite is twice as tall
        expect(at(frame, 100, 100 + SPRITE_HEIGHT * 2 - 1)).toBe(WHITE);
        expect(at(frame, 100, 100 + SPRITE_HEIGHT * 2)).toBe(BLACK);
    });

    it('draws a sprite behind the display only on its background', () => {
        const chip = createVirtualChip();
        chip.screen[0] = 'I'.charCodeAt(0);
        chip.colour[0] = WHITE;
        chip.spriteShapes.fill(0xff, 0, SHAPE_BYTES);
        const sprite = chip.addSprite(DISPLAY_LEFT, DISPLAY_TOP, 0, YELLOW);
        chip.spriteIsBehind[sprite] = 1;
        const frame = compose(chip);
        expect(at(frame, DISPLAY_LEFT, DISPLAY_TOP)).toBe(YELLOW);
        expect(at(frame, DISPLAY_LEFT + 1, DISPLAY_TOP)).toBe(WHITE);
    });
});

describe('assignSpriteSlots, through composeFrame', () => {
    it('shows at most eight sprites on a line and drops the rest', () => {
        const chip = createVirtualChip();
        chip.spriteShapes.fill(0xff, 0, SHAPE_BYTES);
        for (let i = 0; i < 10; i++) chip.addSprite(DISPLAY_LEFT + i * SPRITE_WIDTH, 100, 0, WHITE);
        compose(chip);
        expect(chip.droppedSpriteCount).toBe(2);
        expect(chip.spritesOnLine[100]).toBe(8);
        expect(chip.spriteSlot[8]).toBe(-1);
        expect(at(compose(chip), DISPLAY_LEFT + 8 * SPRITE_WIDTH, 100)).toBe(BLACK);
    });

    it('reuses a slot once its sprite has ended', () => {
        const chip = createVirtualChip();
        for (let row = 0; row < 6; row++) {
            for (let i = 0; i < 8; i++) chip.addSprite(DISPLAY_LEFT + i * SPRITE_WIDTH, DISPLAY_TOP + row * (SPRITE_HEIGHT + 1), 0, WHITE);
        }
        compose(chip);
        expect(chip.droppedSpriteCount).toBe(0);
        expect(chip.spriteSlot[47]).toBe(7);

        // One line closer and the rows overlap
        const crowded = createVirtualChip();
        for (let row = 0; row < 2; row++) {
            for (let i = 0; i < 8; i++) crowded.addSprite(DISPLAY_LEFT + i * SPRITE_WIDTH, DISPLAY_TOP + row * (SPRITE_HEIGHT - 1), 0, WHITE);
        }
        compose(crowded);
        expect(crowded.droppedSpriteCount).toBe(8);
    });
});

/** The bytes of one sprite shape the chip draws: three a row. */
const SHAPE_BYTES = SPRITE_HEIGHT * 3;

function compose(chip: VirtualChip): Uint8Array {
    const frame = new Uint8Array(FRAME_WIDTH * FRAME_HEIGHT);
    composeFrame(chip, frame);
    return frame;
}

function at(frame: Uint8Array, x: number, y: number): number {
    return frame[y * FRAME_WIDTH + x];
}

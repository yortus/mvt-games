import {
    BALL, BALL_HEIGHT, BALL_WIDTH, CYAN, DARK_GREY, fadeColour, LIGHT_BLUE, LIGHT_GREEN, LIGHT_RED,
    PURPLE, SPRITES_CAPTION_BOTTOM, SPRITES_CAPTION_TOP, WHITE, YELLOW,
} from '../../data';
import { BALLS_PER_RING, RING_COUNT, type SpritesPartModel } from '../../models';
import { DISPLAY_LEFT, DISPLAY_TOP, type VirtualChip } from '../chip';
import { writeWashed } from './paint-helpers';

// ---------------------------------------------------------------------------
// Painter
// ---------------------------------------------------------------------------

/**
 * Part 5. 48 multicolour ball sprites from a pool of 64; the chip's
 * multiplexer gives each a hardware slot as the frame goes down. The model
 * keeps every ring of eight at one height, far enough from the next, so no
 * line needs more than the eight slots there are. Within a ring the nearest
 * ball is added first, so it gets the lowest slot and is drawn in front.
 */
export function paintSpritesPart(chip: VirtualChip, sprites: SpritesPartModel, washPhase: number): void {
    chip.spriteShapes.set(BALL_SHAPE, 0);
    chip.spriteMulticolour1 = DARK_GREY;
    chip.spriteMulticolour2 = WHITE;

    for (let ring = 0; ring < RING_COUNT; ring++) {
        sortRingNearestFirst(sprites, ring);
        for (let k = 0; k < BALLS_PER_RING; k++) {
            const ball = ringOrder[k];
            const depth = sprites.ballDepthAt(ball);
            // Further balls a step or two darker, through the fade table
            const colour = fadeColour(RING_COLOURS[ring], 0.7 + 0.3 * (depth + 1) / 2);
            // The ball is BALL_WIDTH multicolour pixels, twice that on screen, so half its width is BALL_WIDTH
            const x = DISPLAY_LEFT + Math.round(sprites.ballColAt(ball) * 8) - BALL_WIDTH;
            const y = DISPLAY_TOP + Math.round(sprites.ballRowAt(ball) * 8) - (BALL_HEIGHT >> 1);
            const sprite = chip.addSprite(x, y, 0, colour);
            chip.spriteIsMulticolour[sprite] = 1;
        }
    }

    writeWashed(chip, 0, SPRITES_CAPTION_TOP, washPhase);
    writeWashed(chip, 24, SPRITES_CAPTION_BOTTOM, washPhase);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const RING_COLOURS: readonly number[] = [LIGHT_RED, YELLOW, LIGHT_GREEN, CYAN, LIGHT_BLUE, PURPLE];

/** The ball as a sprite shape: three bytes a row, four multicolour pixels a byte. */
const BALL_SHAPE = buildBallShape();

/** One ring's balls, nearest first. Scratch, preallocated. */
const ringOrder = new Uint8Array(BALLS_PER_RING);

function buildBallShape(): Uint8Array {
    const shape = new Uint8Array(63);
    for (let y = 0; y < BALL_HEIGHT; y++) {
        for (let x = 0; x < BALL_WIDTH; x++) {
            shape[y * 3 + (x >> 2)] |= BALL[y * BALL_WIDTH + x] << (6 - (x & 3) * 2);
        }
    }
    return shape;
}

function sortRingNearestFirst(sprites: SpritesPartModel, ring: number): void {
    for (let k = 0; k < BALLS_PER_RING; k++) {
        const ball = ring * BALLS_PER_RING + k;
        const depth = sprites.ballDepthAt(ball);
        let j = k;
        while (j > 0 && sprites.ballDepthAt(ringOrder[j - 1]) < depth) {
            ringOrder[j] = ringOrder[j - 1];
            j--;
        }
        ringOrder[j] = ball;
    }
}

import { BlurFilter, BufferImageSource, Container, Sprite, Texture } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { FADE_STEPS, FADE_TABLE, PALETTE_RGB } from '../data';
import type { ShowModel } from '../models';
import { composeFrame, createVirtualChip, FRAME_HEIGHT, FRAME_WIDTH, HARDWARE_SPRITES, type VirtualChip } from './chip';
import { paintShow } from './painters';
import { PIXEL_SCALE } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ScreenViewBindings {
    model: ShowModel;
    /** Scanlines, as on a TV of the day: each line doubled, the copy darker. Read once. */
    hasScanlines: boolean;
    /** A soft glow round bright pixels, as on a TV of the day. A Pixi filter, so it needs a renderer. Read once. */
    hasGlow: boolean;
    /**
     * Read once. Draws in the borders what demo coders used to: a bar down
     * the right as long as the frame's paint took (a 50 Hz frame is the whole
     * height), and down the left, how many sprites each line shows.
     */
    isDebug: boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The whole show, as one texture. Each refresh resets the virtual chip, has
 * the playing part's painter write its memory and registers, composes the
 * frame by the chip's rules, turns its colours into RGB at the show's
 * brightness, and uploads it.
 *
 * Every frame is drawn from scratch from the model, so this view keeps
 * nothing between frames but its buffers, and has no update step: it is a
 * pure projection of the model. One view, not a view per effect: the effects
 * share one frame and the chip's rules for composing it, and the frame is
 * one upload.
 */
export function ScreenView(bindings: ScreenViewBindings): Container {
    const { model, hasScanlines, hasGlow, isDebug } = bindings;

    const chip = createVirtualChip();
    const frame = new Uint8Array(FRAME_WIDTH * FRAME_HEIGHT);

    const textureHeight = hasScanlines ? FRAME_HEIGHT * 2 : FRAME_HEIGHT;
    const bytes = new Uint8Array(FRAME_WIDTH * textureHeight * 4);
    const pixels = new Int32Array(bytes.buffer);
    const source = new BufferImageSource({
        resource: bytes,
        width: FRAME_WIDTH,
        height: textureHeight,
        scaleMode: 'nearest',
        // Every pixel is opaque, so it is already premultiplied
        alphaMode: 'premultiplied-alpha',
    });
    const texture = new Texture({ source });

    const view = new Container();
    view.label = 'screen';
    view.addChild(createScreenSprite());
    if (hasGlow) {
        const glow = createScreenSprite();
        glow.filters = [new BlurFilter({ strength: 6, quality: 3 })];
        glow.blendMode = 'add';
        glow.alpha = 0.3;
        view.addChild(glow);
    }

    /** The palette as 32-bit pixels at this frame's brightness, and darkened for scanlines. */
    const litColours = new Int32Array(16);
    const scanlineColours = new Int32Array(16);

    setRefresh(view, refresh);
    // A sprite does not destroy its texture unless told to
    view.on('destroyed', () => texture.destroy(true));
    return view;

    function refresh(): void {
        const paintStart = isDebug ? performance.now() : 0;
        chip.reset();
        paintShow(chip, model);
        composeFrame(chip, frame);
        if (isDebug) paintDebugBars(chip, frame, performance.now() - paintStart);

        fillColours(model.brightness);
        if (hasScanlines) {
            for (let line = 0; line < FRAME_HEIGHT; line++) {
                const from = line * FRAME_WIDTH;
                const to = from * 2;
                for (let x = 0; x < FRAME_WIDTH; x++) {
                    const colour = frame[from + x];
                    pixels[to + x] = litColours[colour];
                    pixels[to + FRAME_WIDTH + x] = scanlineColours[colour];
                }
            }
        }
        else {
            for (let i = 0; i < frame.length; i++) pixels[i] = litColours[frame[i]];
        }
        source.update();
    }

    function fillColours(brightness: number): void {
        const level = Math.round((brightness < 0 ? 0 : brightness > 1 ? 1 : brightness) * FADE_STEPS);
        for (let colour = 0; colour < 16; colour++) {
            const rgb = PALETTE_RGB[FADE_TABLE[level * 16 + colour]];
            const r = rgb >> 16;
            const g = (rgb >> 8) & 0xff;
            const b = rgb & 0xff;
            litColours[colour] = toPixel(r, g, b);
            scanlineColours[colour] = toPixel(r * SCANLINE_LEVEL, g * SCANLINE_LEVEL, b * SCANLINE_LEVEL);
        }
    }

    function createScreenSprite(): Sprite {
        const sprite = new Sprite(texture);
        sprite.scale.set(PIXEL_SCALE, hasScanlines ? PIXEL_SCALE / 2 : PIXEL_SCALE);
        return sprite;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How bright a scanline is, against the line above it. */
const SCANLINE_LEVEL = 0.55;

/** A PAL frame lasts 20 ms, and the raster takes all of it to go down the 272 lines. */
const MS_PER_FRAME_HEIGHT = 20;

const DEBUG_TIME_COLOUR = 1; // white
const DEBUG_SPRITES_COLOUR = 13; // light green
const DEBUG_FULL_COLOUR = 10; // light red

/** RGBA bytes, in memory order, as one little-endian 32-bit pixel. */
function toPixel(r: number, g: number, b: number): number {
    return (0xff << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);
}

function paintDebugBars(chip: VirtualChip, frame: Uint8Array, paintMs: number): void {
    const timeLines = Math.min(FRAME_HEIGHT, Math.round((paintMs / MS_PER_FRAME_HEIGHT) * FRAME_HEIGHT));
    for (let line = 0; line < FRAME_HEIGHT; line++) {
        const start = line * FRAME_WIDTH;
        if (line < timeLines) frame.fill(DEBUG_TIME_COLOUR, start + FRAME_WIDTH - 8, start + FRAME_WIDTH);
        const sprites = chip.spritesOnLine[line];
        if (sprites > 0) {
            const colour = sprites >= HARDWARE_SPRITES ? DEBUG_FULL_COLOUR : DEBUG_SPRITES_COLOUR;
            frame.fill(colour, start, start + sprites * 3);
        }
    }
}

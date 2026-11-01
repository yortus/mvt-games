import { BufferImageSource, Container, type FederatedPointerEvent, Sprite, Text, Texture } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { COLS, ROWS } from '../data';
import type { CoralModel, CoralPattern } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CoralViewBindings {
    model: CoralModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** How many times bigger than a cell each pixel of the grid is shown, smoothed. */
const SCALE = 4;

/** The screen's size in pixels. */
export const SCREEN_WIDTH = COLS * SCALE;
export const SCREEN_HEIGHT = ROWS * SCALE;

/**
 * The grid as one texture, a pixel per cell, coloured by how much growth is
 * there, through one of several colour schemes, each fading slowly into the
 * next. A caption names each new pattern as it comes. Dragging paints
 * growth, and a double tap moves on to the next pattern.
 */
export function CoralView(bindings: CoralViewBindings): Container {
    const { model } = bindings;
    const bytes = new Uint8Array(COLS * ROWS * 4);
    const pixels = new Uint32Array(bytes.buffer);
    const source = new BufferImageSource({ resource: bytes, width: COLS, height: ROWS, alphaMode: 'premultiplied-alpha' });
    const texture = new Texture({ source });
    const sprite = new Sprite(texture);
    sprite.scale.set(SCALE);
    const caption = new Text({ text: '', anchor: { x: 0.5, y: 1 }, x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT - 12, style: CAPTION_STYLE });
    const view = new Container();
    view.addChild(sprite, caption);

    // Presentation state: how long the colour schemes have been running, the
    // pattern the caption names and how long it has shown, and how long since
    // the last tap, to tell a double tap
    const shades = new Uint32Array(256);
    let paletteMs = 0;
    let shadesFor = -1;
    let captionFor = model.pattern;
    let captionMs = 0;
    let isFirstCaption = true;
    let msSinceTap = DOUBLE_TAP_MS;
    let isPainting = false;

    sprite.eventMode = 'static';
    sprite.cursor = 'crosshair';
    sprite.on('pointerdown', (e: FederatedPointerEvent) => {
        isPainting = true;
        if (msSinceTap < DOUBLE_TAP_MS) model.nextPattern();
        msSinceTap = 0;
        paint(e);
    });
    sprite.on('pointermove', (e: FederatedPointerEvent) => {
        if (isPainting) paint(e);
    });
    sprite.on('pointerup', stopPainting);
    sprite.on('pointerupoutside', stopPainting);
    // A sprite does not destroy its texture unless told to
    sprite.on('destroyed', () => texture.destroy(true));

    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function stopPainting(): void {
        isPainting = false;
    }

    function paint(e: FederatedPointerEvent): void {
        const { x, y } = e.getLocalPosition(sprite);
        model.seedAt(Math.floor(x), Math.floor(y));
    }

    function update(deltaMs: number): void {
        paletteMs += deltaMs;
        msSinceTap += deltaMs;
        captionMs += deltaMs;
        if (model.pattern === captionFor) return;
        captionFor = model.pattern;
        captionMs = 0;
        isFirstCaption = false;
    }

    function refresh(): void {
        refreshShades();
        for (let i = 0; i < COLS * ROWS; i++) {
            const shade = Math.floor((model.growthAt(i) / THICKEST) * shades.length);
            pixels[i] = shades[Math.min(shades.length - 1, Math.max(0, shade))];
        }
        source.update();

        caption.text = isFirstCaption ? FIRST_CAPTIONS[captionFor] : CAPTIONS[captionFor];
        caption.alpha = Math.max(0, Math.min(1, (CAPTION_MS - captionMs) / CAPTION_FADE_MS));
    }

    /** Works out the shades again, when the colour schemes have moved on since they were last worked out. */
    function refreshShades(): void {
        const at = paletteMs / PALETTE_MS;
        const palette = Math.floor(at) % PALETTES.length;
        // Each scheme holds, then fades into the next over the last part of its time
        const change = Math.min(1, Math.max(0, (at - Math.floor(at) - 0.75) / 0.25));
        const key = palette + change;
        if (key === shadesFor) return;
        shadesFor = key;
        const from = PALETTES[palette];
        const to = PALETTES[(palette + 1) % PALETTES.length];
        for (let i = 0; i < shades.length; i++) {
            const t = i / (shades.length - 1);
            shades[i] = toPixel(mixColors(colorAlong(from, t), colorAlong(to, t), change));
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The amount of growth shown in the palest shade. */
const THICKEST = 0.4;
/** How long each colour scheme lasts, fading into the next at the end. A different length from the patterns', so the two drift apart. */
const PALETTE_MS = 37_000;
/** How soon a second tap must follow the first to make a double tap. */
const DOUBLE_TAP_MS = 300;
/** How long a caption shows, and how long it takes to fade at the end. */
const CAPTION_MS = 3500;
const CAPTION_FADE_MS = 1000;

const CAPTION_STYLE = { fill: 0xffffff, fontSize: 14, fontFamily: 'monospace', align: 'center' as const, dropShadow: { alpha: 0.6, blur: 3, distance: 0 } };
const CAPTIONS: Readonly<Record<CoralPattern, string>> = {
    coral: 'CORAL',
    spots: 'SPOTS',
    maze: 'MAZE',
    holes: 'HOLES',
    worms: 'WORMS',
};
const FIRST_CAPTIONS: Readonly<Record<CoralPattern, string>> = {
    coral: 'CORAL\nDrag to paint, double-tap for the next pattern',
    spots: 'SPOTS',
    maze: 'MAZE',
    holes: 'HOLES',
    worms: 'WORMS',
};

/** The colour schemes, each from no growth to the thickest: reef, ember, lagoon, orchid and moss. */
const PALETTES: readonly (readonly number[])[] = [
    [0x0b1d3a, 0x1f7a8c, 0xff7f6b, 0xffe8d6],
    [0x140808, 0x7a1d12, 0xf28c28, 0xfff1c1],
    [0x04131c, 0x0e5a6b, 0x7fd8c8, 0xf4fff8],
    [0x140b22, 0x4b2a7a, 0xd46ab5, 0xffe3f4],
    [0x0b1408, 0x2e5a1f, 0x9cc85a, 0xf0f7d8],
];

/** The colour `t` of the way along a row of colours. */
function colorAlong(colors: readonly number[], t: number): number {
    const at = t * (colors.length - 1);
    const i = Math.min(Math.floor(at), colors.length - 2);
    return mixColors(colors[i], colors[i + 1], at - i);
}

/** The colour `t` of the way from `from` to `to`. */
function mixColors(from: number, to: number, t: number): number {
    const r = (from >> 16) + ((to >> 16) - (from >> 16)) * t;
    const g = ((from >> 8) & 0xff) + (((to >> 8) & 0xff) - ((from >> 8) & 0xff)) * t;
    const b = (from & 0xff) + ((to & 0xff) - (from & 0xff)) * t;
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

/** A colour as an opaque pixel. A pixel is red, green, blue and alpha bytes in memory, so a little-endian word holds them in reverse. */
function toPixel(color: number): number {
    return ((255 << 24) | ((color & 0xff) << 16) | (color & 0xff00) | (color >> 16)) >>> 0;
}

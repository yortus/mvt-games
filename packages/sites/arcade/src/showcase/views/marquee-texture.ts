import { Texture } from 'pixi.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface MarqueeTextureOptions {
    /** The game's name, which the marquee shows in capitals. */
    readonly name: string;
    /** The cabinet's colour, as a CSS colour, which the marquee glows in. */
    readonly color: string;
}

/** The marquee's shape, in pixels, which is also its shape on the cabinet. */
export const MARQUEE_TEXTURE_WIDTH = 512;
export const MARQUEE_TEXTURE_HEIGHT = 128;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a cabinet's marquee, the lit sign along its top, drawn on a
 * canvas. It's the game's name, in white, over a glow of the cabinet's
 * colour.
 */
export function createMarqueeTexture({ name, color }: MarqueeTextureOptions): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = MARQUEE_TEXTURE_WIDTH;
    canvas.height = MARQUEE_TEXTURE_HEIGHT;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('arcade hall: a marquee needs a 2D canvas');
    const glow = context.createLinearGradient(0, 0, 0, MARQUEE_TEXTURE_HEIGHT);
    glow.addColorStop(0, '#08080c');
    glow.addColorStop(0.5, color);
    glow.addColorStop(1, '#08080c');
    context.fillStyle = glow;
    context.fillRect(0, 0, MARQUEE_TEXTURE_WIDTH, MARQUEE_TEXTURE_HEIGHT);
    const text = name.toUpperCase();
    // The name shrinks to fit a long one in
    let fontSize = 64;
    context.font = `900 ${fontSize}px system-ui, sans-serif`;
    const width = context.measureText(text).width;
    if (width > MARQUEE_TEXTURE_WIDTH - 40) fontSize = Math.floor((fontSize * (MARQUEE_TEXTURE_WIDTH - 40)) / width);
    context.font = `900 ${fontSize}px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineWidth = 8;
    context.strokeStyle = '#08080c';
    context.strokeText(text, MARQUEE_TEXTURE_WIDTH / 2, MARQUEE_TEXTURE_HEIGHT / 2);
    context.fillStyle = '#ffffff';
    context.fillText(text, MARQUEE_TEXTURE_WIDTH / 2, MARQUEE_TEXTURE_HEIGHT / 2);
    return Texture.from(canvas);
}

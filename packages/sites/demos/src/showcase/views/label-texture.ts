import { Texture } from 'pixi.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface LabelTextureOptions {
    /** The demo's name, in bold. */
    readonly name: string;
    /** A line or two about it, under its name. */
    readonly summary: string;
}

/** The label's shape, in pixels, which is also its shape on the wall. */
export const LABEL_TEXTURE_WIDTH = 512;
export const LABEL_TEXTURE_HEIGHT = 256;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the label beside a painting, drawn on a canvas. Like a real
 * gallery's, it's a small white card. The demo's name is in bold, with its
 * summary under it, wrapped to fit.
 */
export function createLabelTexture({ name, summary }: LabelTextureOptions): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = LABEL_TEXTURE_WIDTH;
    canvas.height = LABEL_TEXTURE_HEIGHT;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('gallery: a label needs a 2D canvas');
    context.fillStyle = '#fbfaf6';
    context.fillRect(0, 0, LABEL_TEXTURE_WIDTH, LABEL_TEXTURE_HEIGHT);
    context.strokeStyle = '#d8d4ca';
    context.lineWidth = 4;
    context.strokeRect(2, 2, LABEL_TEXTURE_WIDTH - 4, LABEL_TEXTURE_HEIGHT - 4);
    context.fillStyle = '#1d1d1f';
    context.textBaseline = 'top';
    context.font = `700 ${NAME_SIZE}px Georgia, 'Times New Roman', serif`;
    context.fillText(name, MARGIN, MARGIN, LABEL_TEXTURE_WIDTH - 2 * MARGIN);
    context.fillStyle = '#4a4a50';
    context.font = `${SUMMARY_SIZE}px system-ui, sans-serif`;
    const lines = wrap(context, summary, LABEL_TEXTURE_WIDTH - 2 * MARGIN);
    const top = MARGIN + NAME_SIZE + 18;
    for (let i = 0; i < lines.length && i < MAX_LINES; i++) {
        const isCut = i === MAX_LINES - 1 && lines.length > MAX_LINES;
        context.fillText(isCut ? `${lines[i]}...` : lines[i], MARGIN, top + i * (SUMMARY_SIZE + 8));
    }
    return Texture.from(canvas);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const MARGIN = 28;
const NAME_SIZE = 44;
const SUMMARY_SIZE = 25;
const MAX_LINES = 5;

/** Splits `text` into lines no wider than `width`, at spaces, in the canvas's current font. */
function wrap(context: CanvasRenderingContext2D, text: string, width: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
        const next = line === '' ? word : `${line} ${word}`;
        if (context.measureText(next).width > width && line !== '') {
            lines.push(line);
            line = word;
        }
        else line = next;
    }
    if (line !== '') lines.push(line);
    return lines;
}

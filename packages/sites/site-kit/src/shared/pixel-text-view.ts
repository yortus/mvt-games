import { Container, Graphics } from 'pixi.js';
import { FIRST_GLYPH_CODE, GLYPH_BASELINE_ROWS, GLYPH_COLUMNS, LAST_GLYPH_CODE, listGlyphRuns, PIXEL_GLYPHS } from '#pixel-glyphs';
import { setRefresh, type ValueOrGetter } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PixelTextViewBindings {
    /**
     * What it spells. It is set in capitals, as the arcades set their text. A
     * line break starts a new line, and a character with no glyph is a space.
     */
    readonly text: ValueOrGetter<string>;
    /** The text's color. Read once. */
    readonly color: number;
    /** How many screen pixels each of a glyph's cells takes, across and down, as a whole number. Read once. Defaults to 1. */
    readonly scale?: number;
    /**
     * The widest the text may be, in screen pixels. Text wider than this at
     * `scale` is drawn at the largest whole-number scale at which it fits,
     * and never smaller than 1. Read once. Defaults to no limit.
     */
    readonly maxWidth?: number;
    /** The color of a shadow one cell down and to the right, or undefined for none. Read once. */
    readonly shadow?: number;
    /** The color of an outline one cell round every glyph, or undefined for none. Read once. */
    readonly outline?: number;
    /**
     * Where the view's origin is across each line: 0 at its left edge, 0.5 in
     * its middle, 1 at its right edge. Read once. Defaults to 0.
     */
    readonly anchorX?: number;
    /**
     * Where the origin is down the text: 0 at its top, 0.5 halfway from its
     * top to its last line's baseline, 1 on that baseline. Read once.
     * Defaults to 0.
     */
    readonly anchorY?: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Text in the site's pixel glyphs (`#pixel-glyphs`), set in capitals, for an
 * entry in the style of the 1970s to the 1990s. It is drawn as rectangles in
 * a `Graphics`, at a whole number of screen pixels to each of a glyph's
 * cells, so it stays crisp at the entry's scale. It is drawn again only when
 * its text changes. Its label is its text, so a test can read it.
 */
export function PixelTextView(bindings: PixelTextViewBindings): Container {
    const { color, shadow, outline } = bindings;
    const scale = bindings.scale ?? 1;
    const maxWidth = bindings.maxWidth ?? Infinity;
    const anchorX = bindings.anchorX ?? 0;
    const anchorY = bindings.anchorY ?? 0;
    const glyphs = new Graphics();
    const view = new Container();
    view.addChild(glyphs);
    let drawnText: string | undefined;

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const text = typeof bindings.text === 'function' ? bindings.text() : bindings.text;
        if (text === drawnText) return;
        drawnText = text;
        view.label = text;
        const lines = text.toUpperCase().split('\n');
        const widest = measurePixelText(text);
        const fitted = widest === 0 ? scale : Math.max(1, Math.min(scale, Math.floor(maxWidth / widest)));
        const height = (lines.length - 1) * LINE_ROWS + GLYPH_BASELINE_ROWS;
        glyphs.clear();
        glyphs.scale.set(fitted);
        // Whole screen pixels from the origin, so the glyphs stay crisp
        glyphs.position.set(0, -Math.round(height * fitted * anchorY));
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const x = -Math.round(measurePixelText(line) * fitted * anchorX) / fitted;
            const y = i * LINE_ROWS;
            if (outline !== undefined) {
                for (let j = 0; j < OUTLINE_OFFSETS.length; j++) spell(glyphs, line, outline, x + OUTLINE_OFFSETS[j][0], y + OUTLINE_OFFSETS[j][1]);
            }
            if (shadow !== undefined) spell(glyphs, line, shadow, x + 1, y + 1);
            spell(glyphs, line, color, x, y);
        }
    }
}

/** Returns how wide `text`'s widest line is in the pixel glyphs, in cells, with no space after its last character. */
export function measurePixelText(text: string): number {
    let widest = 0;
    let start = 0;
    for (let i = 0; i <= text.length; i++) {
        if (i < text.length && text[i] !== '\n') continue;
        const length = i - start;
        if (length > 0) widest = Math.max(widest, length * GLYPH_ADVANCE - 1);
        start = i + 1;
    }
    return widest;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far each character moves the next along, in cells: a glyph's width and a cell of space. */
const GLYPH_ADVANCE = GLYPH_COLUMNS + 1;

/** How far each line is below the one before it, in cells: room for descenders, and a gap. */
const LINE_ROWS = GLYPH_BASELINE_ROWS + 4;

/** Each glyph's cells, as runs along its rows, by character code from `FIRST_GLYPH_CODE`. */
const GLYPH_RUNS: readonly (readonly (readonly [number, number, number])[])[] = PIXEL_GLYPHS.map(listGlyphRuns);

/** The four ways an outline is drawn out from the glyphs, a cell each. */
const OUTLINE_OFFSETS: readonly (readonly [number, number])[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/** Draws `line`'s glyphs into `graphics` in `color`, from (`x`, `y`) in cells. */
function spell(graphics: Graphics, line: string, color: number, x: number, y: number): void {
    for (let i = 0; i < line.length; i++) {
        const code = line.charCodeAt(i);
        if (code < FIRST_GLYPH_CODE || code > LAST_GLYPH_CODE) continue;
        const runs = GLYPH_RUNS[code - FIRST_GLYPH_CODE];
        const left = x + i * GLYPH_ADVANCE;
        for (let j = 0; j < runs.length; j++) {
            const [runX, runY, runWidth] = runs[j];
            graphics.rect(left + runX, y + runY, runWidth, 1).fill(color);
        }
    }
}

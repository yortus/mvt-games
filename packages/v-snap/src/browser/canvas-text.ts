import type { Font, Glyph, PathCommand } from 'fontkit';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Canvas text in a visual test is laid out and drawn by this module, not by
 * the browser. Each system's font engine positions and antialiases glyphs
 * its own way, and nothing in the browser makes them agree. So this module
 * replaces a 2D canvas's `fillText`, `strokeText` and `measureText`. Its own
 * layout uses fontkit, a font-reading library, to read the test fonts'
 * files. It lays text out at the weight asked for, with kerning. It draws
 * each glyph as a `Path2D` fill, which Skia (the browser's 2D graphics
 * library) draws the same way everywhere. Fill styles, gradients, strokes,
 * letter spacing and shadows apply to paths as they do to text. Pixi
 * measures text through the same `measureText`, so its layout agrees with
 * the drawing.
 *
 * A character that the test fonts lack, such as ★ or an emoji, is drawn as
 * a box holding its code point in hex digits, as a system's fallback font
 * draws it. So each such character draws differently, and a change from
 * one to another changes the image.
 */
export interface CanvasText {
    /** Returns the font families asked for since the last call that no test font stands in for. */
    takeUnpinnedFamilies: () => readonly string[];
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CanvasTextOptions {
    /** The sans-serif test font, which stands in for every proportional family. */
    readonly sans: Font;
    /** The monospace test font, which stands in for every fixed-width family. */
    readonly mono: Font;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Replaces canvas text drawing in this page for the rest of the page's life. */
export function installCanvasText(options: CanvasTextOptions): CanvasText {
    const unpinned = new Set<string>();
    const parsed = new Map<string, ParsedFont>();
    const variations = new Map<string, Font>();

    for (const proto of [CanvasRenderingContext2D.prototype, OffscreenCanvasRenderingContext2D.prototype] as CanvasRenderingContext2D[]) {
        proto.fillText = function (this: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth?: number) {
            this.fill(layOutPath({ ctx: this, p: parse(this.font), text, x, y, maxWidth, digits: options.mono }));
        };
        proto.strokeText = function (this: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth?: number) {
            this.stroke(layOutPath({ ctx: this, p: parse(this.font), text, x, y, maxWidth, digits: options.mono }));
        };
        proto.measureText = function (this: CanvasRenderingContext2D, text: string) {
            return measure(this, parse(this.font), text);
        };
    }

    return {
        takeUnpinnedFamilies() {
            const families = [...unpinned];
            unpinned.clear();
            return families;
        },
    };

    /**
     * Returns the test font, size and slant that a CSS font string asks for.
     * The string is in the form that the canvas normalises it to.
     */
    function parse(css: string): ParsedFont {
        let font = parsed.get(css);
        if (font === undefined) {
            const match = FONT_PATTERN.exec(css);
            const style = match?.[1] ?? 'normal';
            const weightWord = match?.[3] ?? 'normal';
            const weight = weightWord === 'normal' ? 400 : weightWord === 'bold' ? 700 : Number(weightWord) || 400;
            const size = Number(match?.[4] ?? 10);
            const families = (match?.[5] ?? 'sans-serif').split(',').map((f) => f.trim().replace(/^["']|["']$/g, ''));
            let base: Font | undefined;
            for (const family of families) {
                const key = family.toLowerCase();
                if (MONO_FAMILIES.has(key)) base = options.mono;
                else if (SANS_FAMILIES.has(key)) base = options.sans;
                if (base !== undefined) break;
            }
            const unpinnedFamily = base === undefined ? families[0] : undefined;
            base ??= options.sans;
            font = { font: findVariation(base, weight), size, isItalic: style === 'italic' || style.startsWith('oblique'), unpinnedFamily };
            parsed.set(css, font);
        }
        // Recorded on every use, not only the first, so that every test that
        // asks for the family fails, whatever order the tests run in
        if (font.unpinnedFamily !== undefined) unpinned.add(font.unpinnedFamily);
        return font;
    }

    function findVariation(base: Font, weight: number): Font {
        const key = `${base === options.mono ? 'mono' : 'sans'}:${weight}`;
        let font = variations.get(key);
        if (font === undefined) {
            font = base.getVariation({ wght: weight }) as Font;
            variations.set(key, font);
        }
        return font;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface ParsedFont {
    readonly font: Font;
    readonly size: number;
    /** Whether the text is slanted. There is no italic test font, so italic and oblique text is slanted instead. */
    readonly isItalic: boolean;
    /** The family asked for, if no test font stands in for any family in its list. */
    readonly unpinnedFamily: string | undefined;
}

interface Laid {
    readonly glyphs: readonly Glyph[];
    /** Each glyph's pen position, in pixels. */
    readonly x: readonly number[];
    readonly y: readonly number[];
    /** The total advance (how far the pen moves), with letter spacing after every glyph, as the canvas measures it. */
    readonly width: number;
    readonly scale: number;
}

/** Matches a canvas font string. Its parts are style, variant, weight, stretch, size (px), line height and families. */
const FONT_PATTERN = /^(?:(italic|oblique(?: [-\d.]+deg)?|normal)\s+)?(?:(small-caps|normal)\s+)?(?:(bold|bolder|lighter|normal|\d{1,4})\s+)?(?:(?:ultra-|extra-|semi-)?(?:condensed|expanded)\s+)?([\d.]+)px(?:\/\S+)?\s+(.+)$/;

const MONO_FAMILIES: ReadonlySet<string> = new Set([
    'monospace', 'ui-monospace', 'consolas', 'menlo', 'monaco', 'courier', 'courier new', 'sf mono', 'sfmono-regular',
    'cascadia code', 'cascadia mono', 'liberation mono', 'dejavu sans mono', 'roboto mono', 'source code pro',
]);

const SANS_FAMILIES: ReadonlySet<string> = new Set([
    'sans-serif', 'serif', 'system-ui', '-apple-system', 'blinkmacsystemfont', 'ui-sans-serif', 'ui-serif', 'ui-rounded',
    'segoe ui', 'helvetica neue', 'helvetica', 'arial', 'arial black', 'roboto', 'inter', 'georgia', 'times new roman',
    'noto sans', 'ubuntu', 'cantarell', 'source sans 3', 'verdana', 'tahoma', 'trebuchet ms',
]);

/** The slant given to italic text, as a shear. */
const ITALIC_SHEAR = 0.2;

function lay(ctx: CanvasRenderingContext2D, p: ParsedFont, text: string): Laid {
    const run = p.font.layout(text);
    const scale = p.size / p.font.unitsPerEm;
    const spacing = parseFloat(ctx.letterSpacing) || 0;
    const x: number[] = [];
    const y: number[] = [];
    let pen = 0;
    for (let i = 0; i < run.glyphs.length; i++) {
        const position = run.positions[i];
        x.push(pen + position.xOffset * scale);
        y.push(position.yOffset * scale);
        pen += position.xAdvance * scale + spacing;
    }
    return { glyphs: run.glyphs, x, y, width: pen, scale };
}

function computeAlignOffset(ctx: CanvasRenderingContext2D, width: number): number {
    switch (ctx.textAlign) {
        case 'center': return -width / 2;
        case 'right':
        case 'end': return -width;
        default: return 0;
    }
}

function computeBaselineOffset(ctx: CanvasRenderingContext2D, p: ParsedFont): number {
    const scale = p.size / p.font.unitsPerEm;
    const ascent = p.font.ascent * scale;
    const descent = -p.font.descent * scale;
    switch (ctx.textBaseline) {
        case 'top': return ascent;
        case 'hanging': return ascent * 0.8;
        case 'middle': return (ascent - descent) / 2;
        case 'bottom':
        case 'ideographic': return -descent;
        default: return 0;
    }
}

function layOutPath(options: {
    readonly ctx: CanvasRenderingContext2D;
    readonly p: ParsedFont;
    readonly text: string;
    readonly x: number;
    readonly y: number;
    readonly maxWidth: number | undefined;
    /** The font whose digits name a character that the font lacks. */
    readonly digits: Font;
}): Path2D {
    const { ctx, p, text, x, y, maxWidth } = options;
    const laid = lay(ctx, p, text);
    // Text wider than maxWidth is squeezed to fit, as the canvas does.
    const squeeze = maxWidth !== undefined && laid.width > maxWidth && laid.width > 0 ? maxWidth / laid.width : 1;
    const originX = x + computeAlignOffset(ctx, laid.width * squeeze);
    const originY = y + computeBaselineOffset(ctx, p);
    const s = laid.scale;
    const shear = p.isItalic ? ITALIC_SHEAR : 0;
    const path = new Path2D();
    // The characters that the font lacks, in order. Each is laid out as the
    // font's empty glyph, glyph 0, which looks the same for every character.
    const missing = [...text].map((c) => c.codePointAt(0) ?? 0).filter((code) => !p.font.hasGlyphForCodePoint(code));
    let nextMissing = 0;
    for (let i = 0; i < laid.glyphs.length; i++) {
        const gx = originX + laid.x[i] * squeeze;
        const gy = originY - laid.y[i];
        const px = (u: number, v: number) => gx + (u * s + v * s * shear) * squeeze;
        const py = (v: number) => gy - v * s;
        const glyph = laid.glyphs[i];
        const commands = glyph.id === 0 && nextMissing < missing.length
            ? drawMissingGlyph({ code: missing[nextMissing++], width: glyph.advanceWidth, height: p.font.capHeight, digits: options.digits })
            : glyph.path.commands;
        for (const c of commands) {
            const a = c.args;
            switch (c.command) {
                case 'moveTo':
                    path.moveTo(px(a[0], a[1]), py(a[1]));
                    break;
                case 'lineTo':
                    path.lineTo(px(a[0], a[1]), py(a[1]));
                    break;
                case 'quadraticCurveTo':
                    path.quadraticCurveTo(px(a[0], a[1]), py(a[1]), px(a[2], a[3]), py(a[3]));
                    break;
                case 'bezierCurveTo':
                    path.bezierCurveTo(px(a[0], a[1]), py(a[1]), px(a[2], a[3]), py(a[3]), px(a[4], a[5]), py(a[5]));
                    break;
                case 'closePath':
                    path.closePath();
                    break;
            }
        }
    }
    return path;
}

/**
 * Returns the outline of a character that the font lacks, in the font's
 * units, as a glyph's own commands are: a box as wide as the empty glyph's
 * advance and as tall as a capital, with the character's code point in hex
 * digits inside, in two rows.
 */
function drawMissingGlyph(options: { readonly code: number; readonly width: number; readonly height: number; readonly digits: Font }): PathCommand[] {
    const { width, height, digits } = options;
    const margin = width * 0.08;
    const line = height * 0.06;
    const commands: PathCommand[] = [];
    // The box is a ring: the outer edge one way round, the inner the other,
    // so that a fill leaves the middle empty.
    addRect(commands, margin, 0, width - margin, height, false);
    addRect(commands, margin + line, line, width - margin - line, height - line, true);
    const hex = options.code.toString(16).toUpperCase().padStart(4, '0');
    const columns = Math.ceil(hex.length / 2);
    const rows = [hex.slice(0, columns), hex.slice(columns)];
    const advance = digits.layout('0').glyphs[0].advanceWidth;
    const pad = line * 1.5;
    const gap = height * 0.08;
    const innerWidth = width - 2 * (margin + line + pad);
    const innerHeight = height - 2 * (line + pad);
    const k = Math.min(innerWidth / (columns * advance), (innerHeight - gap) / (2 * digits.capHeight));
    const left = margin + line + pad + (innerWidth - columns * advance * k) / 2;
    const bottom = line + pad + (innerHeight - gap - 2 * digits.capHeight * k) / 2;
    for (let row = 0; row < rows.length; row++) {
        const baseY = bottom + (rows.length - 1 - row) * (digits.capHeight * k + gap);
        for (let col = 0; col < rows[row].length; col++) {
            const glyph = digits.glyphForCodePoint(rows[row].charCodeAt(col));
            const baseX = left + col * advance * k;
            for (const c of glyph.path.commands) {
                const args = c.args.map((v, i) => (i % 2 === 0 ? baseX + v * k : baseY + v * k));
                commands.push({ command: c.command, args });
            }
        }
    }
    return commands;
}

/** Adds a closed rectangle, wound one way or the other. */
function addRect(commands: PathCommand[], x0: number, y0: number, x1: number, y1: number, isReversed: boolean): void {
    const corners = isReversed ? [[x0, y0], [x0, y1], [x1, y1], [x1, y0]] : [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    commands.push({ command: 'moveTo', args: corners[0] });
    for (let i = 1; i < corners.length; i++) commands.push({ command: 'lineTo', args: corners[i] });
    commands.push({ command: 'closePath', args: [] });
}

function measure(ctx: CanvasRenderingContext2D, p: ParsedFont, text: string): TextMetrics {
    const laid = lay(ctx, p, text);
    const s = laid.scale;
    let left = Infinity;
    let right = -Infinity;
    let top = -Infinity;
    let bottom = Infinity;
    for (let i = 0; i < laid.glyphs.length; i++) {
        const b = laid.glyphs[i].bbox;
        if (!Number.isFinite(b.minX) || b.maxX <= b.minX) continue;
        left = Math.min(left, laid.x[i] + b.minX * s);
        right = Math.max(right, laid.x[i] + b.maxX * s);
        top = Math.max(top, laid.y[i] + b.maxY * s);
        bottom = Math.min(bottom, laid.y[i] + b.minY * s);
    }
    if (!Number.isFinite(left)) left = right = top = bottom = 0;
    const align = computeAlignOffset(ctx, laid.width);
    const base = computeBaselineOffset(ctx, p);
    const ascent = p.font.ascent * s;
    const descent = -p.font.descent * s;
    return {
        width: laid.width,
        actualBoundingBoxLeft: -(left + align),
        actualBoundingBoxRight: right + align,
        actualBoundingBoxAscent: top - base,
        actualBoundingBoxDescent: -bottom + base,
        fontBoundingBoxAscent: ascent - base,
        fontBoundingBoxDescent: descent + base,
        emHeightAscent: ascent - base,
        emHeightDescent: descent + base,
        alphabeticBaseline: base,
        hangingBaseline: base - ascent * 0.8,
        ideographicBaseline: base - descent,
    };
}

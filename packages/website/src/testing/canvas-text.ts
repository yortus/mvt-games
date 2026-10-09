import type { Font, Glyph } from 'fontkit';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Canvas text in a visual test is laid out and drawn by this module, not by
 * the browser: each system's font engine positions and antialiases glyphs
 * its own way, and nothing in the browser makes them agree. It replaces a 2D
 * canvas's `fillText`, `strokeText` and `measureText` with its own layout
 * (fontkit, from the test fonts' files, at the weight asked for, with
 * kerning) and `Path2D` fills, which Skia draws the same way everywhere.
 * Fill styles, gradients, strokes, letter spacing and shadows apply to paths
 * as to text. Pixi measures through the same `measureText`, so its layout and
 * the drawing agree.
 */
export interface CanvasText {
    /** Families asked for since the last call that no test font stands in for. */
    takeUnpinnedFamilies: () => readonly string[];
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CanvasTextOptions {
    /** The test fonts: sans-serif for every proportional family, monospace for every fixed one. */
    readonly sans: Font;
    readonly mono: Font;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Replaces canvas text drawing in this page, for the rest of its life. */
export function installCanvasText(options: CanvasTextOptions): CanvasText {
    const unpinned = new Set<string>();
    const parsed = new Map<string, ParsedFont>();
    const variations = new Map<string, Font>();

    for (const proto of [CanvasRenderingContext2D.prototype, OffscreenCanvasRenderingContext2D.prototype] as CanvasRenderingContext2D[]) {
        proto.fillText = function (this: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth?: number) {
            this.fill(layOutPath(this, parse(this.font), text, x, y, maxWidth));
        };
        proto.strokeText = function (this: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth?: number) {
            this.stroke(layOutPath(this, parse(this.font), text, x, y, maxWidth));
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

    /** The test font, size and slant a CSS font string asks for (as the canvas normalises it). */
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
            if (base === undefined) {
                unpinned.add(families[0]);
                base = options.sans;
            }
            font = { font: findVariation(base, weight), size, isItalic: style === 'italic' || style.startsWith('oblique') };
            parsed.set(css, font);
        }
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
    /** No italic test font: italic and oblique text is slanted. */
    readonly isItalic: boolean;
}

interface Laid {
    readonly glyphs: readonly Glyph[];
    /** Each glyph's pen position, in pixels. */
    readonly x: readonly number[];
    readonly y: readonly number[];
    /** The advance, letter spacing included after every glyph, as the canvas measures it. */
    readonly width: number;
    readonly scale: number;
}

/** A canvas font string: style, variant, weight, stretch, size (px), line height, families. */
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

function layOutPath(ctx: CanvasRenderingContext2D, p: ParsedFont, text: string, x: number, y: number, maxWidth: number | undefined): Path2D {
    const laid = lay(ctx, p, text);
    // Text wider than maxWidth is squeezed to fit, as the canvas does
    const squeeze = maxWidth !== undefined && laid.width > maxWidth && laid.width > 0 ? maxWidth / laid.width : 1;
    const originX = x + computeAlignOffset(ctx, laid.width * squeeze);
    const originY = y + computeBaselineOffset(ctx, p);
    const s = laid.scale;
    const shear = p.isItalic ? ITALIC_SHEAR : 0;
    const path = new Path2D();
    for (let i = 0; i < laid.glyphs.length; i++) {
        const gx = originX + laid.x[i] * squeeze;
        const gy = originY - laid.y[i];
        const px = (u: number, v: number) => gx + (u * s + v * s * shear) * squeeze;
        const py = (v: number) => gy - v * s;
        for (const c of laid.glyphs[i].path.commands) {
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

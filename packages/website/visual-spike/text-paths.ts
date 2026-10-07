// Spike, rung 3: canvas text drawn as paths. fillText, strokeText and measureText on a 2D
// canvas are replaced, for the test fonts, by our own layout (fontkit, from the same CFF2
// files, at the weight asked for) and Path2D fills, which Skia draws on the CPU the same way
// on every system. The system's glyph rasteriser never sees the text.
import * as fontkit from 'fontkit';

type Font = fontkit.Font;

interface Parsed {
    readonly font: Font;
    readonly size: number;
}

const bases = new Map<string, Font>();
const variations = new Map<string, Font>();
const parsedFonts = new Map<string, Parsed | undefined>();

export async function installTextPaths(options: { sansUrl: string; monoUrl: string; sansFamilies: readonly string[]; monoFamilies: readonly string[] }): Promise<void> {
    const load = async (url: string) => fontkit.create(new Uint8Array(await (await fetch(url)).arrayBuffer()) as never) as Font;
    const [sans, mono] = await Promise.all([load(options.sansUrl), load(options.monoUrl)]);
    for (const family of options.sansFamilies) bases.set(family.toLowerCase(), sans);
    for (const family of options.monoFamilies) bases.set(family.toLowerCase(), mono);

    for (const proto of [CanvasRenderingContext2D.prototype, OffscreenCanvasRenderingContext2D.prototype] as CanvasRenderingContext2D[]) {
        const nativeFill = proto.fillText;
        const nativeStroke = proto.strokeText;
        const nativeMeasure = proto.measureText;
        proto.fillText = function (this: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth?: number) {
            const parsed = parse(this.font);
            if (parsed === undefined) return nativeFill.call(this, text, x, y, maxWidth);
            this.fill(pathFor(this, parsed, text, x, y));
        };
        proto.strokeText = function (this: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth?: number) {
            const parsed = parse(this.font);
            if (parsed === undefined) return nativeStroke.call(this, text, x, y, maxWidth);
            this.stroke(pathFor(this, parsed, text, x, y));
        };
        proto.measureText = function (this: CanvasRenderingContext2D, text: string) {
            const parsed = parse(this.font);
            if (parsed === undefined) return nativeMeasure.call(this, text);
            return measure(this, parsed, text);
        };
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const FONT = /^(?:(italic|oblique|normal)\s+)?(?:(small-caps|normal)\s+)?(?:(bold|bolder|lighter|normal|\d{3})\s+)?(?:(?:ultra-|extra-|semi-)?(?:condensed|expanded)\s+)?([\d.]+)px(?:\/\S+)?\s+(.+)$/;

function parse(font: string): Parsed | undefined {
    if (parsedFonts.has(font)) return parsedFonts.get(font);
    let result: Parsed | undefined;
    const m = FONT.exec(font);
    if (m !== null) {
        const weight = m[3] === undefined || m[3] === 'normal' ? 400 : m[3] === 'bold' ? 700 : Number(m[3]) || 400;
        const first = m[5].split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
        const base = bases.get(first);
        if (base !== undefined) result = { font: variation(base, first, weight), size: Number(m[4]) };
    }
    parsedFonts.set(font, result);
    return result;
}

function variation(base: Font, family: string, weight: number): Font {
    const key = `${family}|${weight}`;
    let font = variations.get(key);
    if (font === undefined) {
        font = base.getVariation({ wght: weight }) as Font;
        variations.set(key, font);
    }
    return font;
}

function spacingOf(ctx: CanvasRenderingContext2D): number {
    const s = (ctx as unknown as { letterSpacing?: string }).letterSpacing ?? '0px';
    return parseFloat(s) || 0;
}

interface Laid {
    readonly glyphs: readonly fontkit.Glyph[];
    readonly x: readonly number[]; // pen x of each glyph, px
    readonly y: readonly number[];
    readonly width: number; // advance, px, letter spacing included after every glyph (as Chrome measures)
    readonly scale: number;
}

function lay(ctx: CanvasRenderingContext2D, p: Parsed, text: string): Laid {
    const run = p.font.layout(text);
    const scale = p.size / p.font.unitsPerEm;
    const spacing = spacingOf(ctx);
    const xs: number[] = [];
    const ys: number[] = [];
    let pen = 0;
    for (let i = 0; i < run.glyphs.length; i++) {
        const pos = run.positions[i];
        xs.push(pen + pos.xOffset * scale);
        ys.push(pos.yOffset * scale);
        pen += pos.xAdvance * scale + spacing;
    }
    return { glyphs: run.glyphs, x: xs, y: ys, width: pen, scale };
}

function alignOffset(ctx: CanvasRenderingContext2D, width: number): number {
    switch (ctx.textAlign) {
        case 'center': return -width / 2;
        case 'right':
        case 'end': return -width;
        default: return 0;
    }
}

function baselineOffset(ctx: CanvasRenderingContext2D, p: Parsed): number {
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

function pathFor(ctx: CanvasRenderingContext2D, p: Parsed, text: string, x: number, y: number): Path2D {
    const laid = lay(ctx, p, text);
    const ox = x + alignOffset(ctx, laid.width);
    const oy = y + baselineOffset(ctx, p);
    const s = laid.scale;
    const path = new Path2D();
    for (let i = 0; i < laid.glyphs.length; i++) {
        const gx = ox + laid.x[i];
        const gy = oy - laid.y[i];
        const X = (v: number) => gx + v * s;
        const Y = (v: number) => gy - v * s;
        for (const c of laid.glyphs[i].path.commands) {
            const a = c.args;
            switch (c.command) {
                case 'moveTo': path.moveTo(X(a[0]), Y(a[1])); break;
                case 'lineTo': path.lineTo(X(a[0]), Y(a[1])); break;
                case 'quadraticCurveTo': path.quadraticCurveTo(X(a[0]), Y(a[1]), X(a[2]), Y(a[3])); break;
                case 'bezierCurveTo': path.bezierCurveTo(X(a[0]), Y(a[1]), X(a[2]), Y(a[3]), X(a[4]), Y(a[5])); break;
                case 'closePath': path.closePath(); break;
            }
        }
    }
    return path;
}

function measure(ctx: CanvasRenderingContext2D, p: Parsed, text: string): TextMetrics {
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
    const align = alignOffset(ctx, laid.width);
    const base = baselineOffset(ctx, p);
    const fontAscent = p.font.ascent * s;
    const fontDescent = -p.font.descent * s;
    return {
        width: laid.width,
        actualBoundingBoxLeft: -(left + align),
        actualBoundingBoxRight: right + align,
        actualBoundingBoxAscent: top - base,
        actualBoundingBoxDescent: -bottom + base,
        fontBoundingBoxAscent: fontAscent - base,
        fontBoundingBoxDescent: fontDescent + base,
        emHeightAscent: fontAscent - base,
        emHeightDescent: fontDescent + base,
        alphabeticBaseline: base,
        hangingBaseline: base - fontAscent * 0.8,
        ideographicBaseline: base - fontDescent,
    } as TextMetrics;
}

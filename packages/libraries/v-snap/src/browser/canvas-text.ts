import type { Font, Glyph, PathCommand } from 'fontkit';
import { type MatchableFace, matchFace } from './match-face';

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
 * A project may register its own fonts for named families. Text that asks
 * for one is laid out and drawn in it, in the same way, in the face that
 * CSS would pick. A character that a registered font lacks falls back, run
 * by run as in a browser, to the font list's later registered families,
 * then to the test font.
 *
 * A character that no font has, such as ★ or an emoji, is drawn as a box
 * holding its code point in hex digits, as a system's fallback font draws
 * it. So each such character draws differently, and a change from one to
 * another changes the image.
 */
export interface CanvasText {
    /** Returns the font families asked for since the last call that no font stands in for. */
    takeUnpinnedFamilies: () => readonly string[];
    /**
     * Registers the project's own families, in place of any registered
     * before. The page registers them after its calibration set, which is
     * drawn in the test fonts alone, and before any of the project's code
     * runs.
     */
    registerFamilies: (families: readonly RegisteredFamily[]) => void;
}

/** A font family that a project registers, with its faces loaded. */
export interface RegisteredFamily {
    readonly name: string;
    /** At least one face. */
    readonly faces: readonly RegisteredFace[];
}

/** One face of a registered family. */
export interface RegisteredFace extends MatchableFace {
    readonly font: Font;
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
    /** Each font's variations, by their axes' settings. */
    const variations = new Map<Font, Map<string, Font>>();
    /** The registered families, by their names in lower case. */
    let registered = new Map<string, RegisteredFamily>();

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
        registerFamilies(families) {
            registered = new Map(families.map((family) => [family.name.trim().toLowerCase(), family]));
            parsed.clear();
        },
    };

    /**
     * Returns the faces and size that a CSS font string asks for. The string
     * is in the form that the canvas normalises it to. The font list's first
     * registered or known family draws the text. Characters that its font
     * lacks fall back to the list's later registered families, then to the
     * project's own font for the list's generic family, if it registers one,
     * then to the test font.
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
            const isItalic = style === 'italic' || style.startsWith('oblique');
            const faces: Face[] = [];
            /** The kind of test font that the list's first known family picks. */
            let kind: StandInKind | undefined;
            for (const family of families) {
                const key = family.toLowerCase();
                const own = registered.get(key);
                const known: StandInKind | undefined = MONO_FAMILIES.has(key) ? 'mono' : SANS_FAMILIES.has(key) ? 'sans' : undefined;
                if (own !== undefined) faces.push(pickRegisteredFace(own, weight, isItalic));
                else if (known !== undefined && faces.length === 0) faces.push(pickStandInFace(known, weight, isItalic));
                kind ??= known;
            }
            const unpinnedFamily = faces.length === 0 ? families[0] : undefined;
            kind ??= 'sans';
            const ownStandIn = registered.get(GENERIC_FAMILY[kind]);
            if (ownStandIn !== undefined) addFace(faces, pickRegisteredFace(ownStandIn, weight, isItalic));
            addFace(faces, pickTestFace(kind, weight, isItalic));
            font = { faces, size, unpinnedFamily };
            parsed.set(css, font);
        }
        // Recorded on every use, not only the first, so that every test that
        // asks for the family fails, whatever order the tests run in
        if (font.unpinnedFamily !== undefined) unpinned.add(font.unpinnedFamily);
        return font;
    }

    /** Returns the face that stands in for a known family: the project's own font for its generic family, or else the test font. */
    function pickStandInFace(kind: StandInKind, weight: number, isItalic: boolean): Face {
        const own = registered.get(GENERIC_FAMILY[kind]);
        return own === undefined ? pickTestFace(kind, weight, isItalic) : pickRegisteredFace(own, weight, isItalic);
    }

    /** Returns a test font at a weight. There is no italic test font, so italic and oblique text is slanted instead. */
    function pickTestFace(kind: StandInKind, weight: number, isItalic: boolean): Face {
        return { font: vary(kind === 'mono' ? options.mono : options.sans, { wght: weight }), shear: isItalic ? ITALIC_SHEAR : 0 };
    }

    /**
     * Returns the face of a registered family for a weight and style, as CSS
     * picks it, set to the weight if it is variable. Italic text with no
     * italic face takes the face's `ital` axis, or failing that its `slnt`
     * axis, slanted as far as CSS's default oblique angle, -14 degrees. A
     * face with neither is slanted by a shear, as the test fonts are.
     */
    function pickRegisteredFace(family: RegisteredFamily, weight: number, isItalic: boolean): Face {
        const match = matchFace(family.faces, weight, isItalic);
        const axes = match.face.font.variationAxes;
        const settings: Record<string, number> = {};
        if (axes.wght !== undefined) settings.wght = match.weight;
        let shear = isItalic && !match.face.isItalic ? ITALIC_SHEAR : 0;
        if (shear !== 0 && axes.ital !== undefined) {
            settings.ital = axes.ital.max;
            shear = 0;
        }
        else if (shear !== 0 && axes.slnt !== undefined && axes.slnt.min < 0) {
            settings.slnt = Math.max(axes.slnt.min, OBLIQUE_ANGLE);
            shear = 0;
        }
        return { font: Object.keys(settings).length === 0 ? match.face.font : vary(match.face.font, settings), shear };
    }

    /** Returns a variable font set to the given axes' values, made once for each set of values. */
    function vary(font: Font, settings: Readonly<Record<string, number>>): Font {
        let made = variations.get(font);
        if (made === undefined) {
            made = new Map();
            variations.set(font, made);
        }
        const key = Object.entries(settings).map(([axis, value]) => `${axis}=${value}`).join(',');
        let variation = made.get(key);
        if (variation === undefined) {
            variation = font.getVariation(settings) as Font;
            made.set(key, variation);
        }
        return variation;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface ParsedFont {
    /**
     * The faces that draw the text, in the order that they are tried for
     * each character. The first draws the text and sets its baseline. The
     * last is a test font, which also lays out the characters that no face
     * has, as boxes.
     */
    readonly faces: readonly Face[];
    readonly size: number;
    /** The family asked for, if no font stands in for any family in its list. */
    readonly unpinnedFamily: string | undefined;
}

/** A font at one weight and slant, ready to lay text out in. */
interface Face {
    readonly font: Font;
    /** The shear that slants italic text drawn in a face with no italic of its own, or 0. */
    readonly shear: number;
}

/** The kinds of test font. */
type StandInKind = 'sans' | 'mono';

/** The generic family that each kind of test font stands in for, which a project may register its own font for. */
const GENERIC_FAMILY: Readonly<Record<StandInKind, string>> = { sans: 'sans-serif', mono: 'monospace' };

interface Laid {
    readonly runs: readonly LaidRun[];
    /** The total advance (how far the pen moves), with letter spacing after every glyph, as the canvas measures it. */
    readonly width: number;
}

/** A stretch of text that one face draws, laid out. */
interface LaidRun {
    readonly face: Face;
    readonly text: string;
    readonly glyphs: readonly Glyph[];
    /** Each glyph's pen position, in pixels, from the start of the whole text. */
    readonly x: readonly number[];
    readonly y: readonly number[];
    readonly scale: number;
}

/** Matches a canvas font string. Its parts are style, variant, weight, stretch, size (px), line height and families. */
const FONT_PATTERN = /^(?:(italic|oblique(?: [-\d.]+deg)?|normal)\s+)?(?:(small-caps|normal)\s+)?(?:(bold|bolder|lighter|normal|\d{1,4})\s+)?(?:(?:ultra-|extra-|semi-)?(?:condensed|expanded)\s+)?([\d.]+)px(?:\/\S+)?\s+(.+)$/;

const MONO_FAMILIES: ReadonlySet<string> = new Set([
    'monospace', 'ui-monospace', 'consolas', 'menlo', 'monaco', 'courier', 'courier new', 'sf mono', 'sfmono-regular',
    'cascadia code', 'cascadia mono', 'liberation mono', 'dejavu sans mono', 'roboto mono', 'source code pro',
]);

const SANS_FAMILIES: ReadonlySet<string> = new Set([
    'sans-serif', 'serif', 'system-ui', 'cursive', 'fantasy', 'emoji', 'math', 'fangsong', '-apple-system', 'blinkmacsystemfont', 'ui-sans-serif', 'ui-serif', 'ui-rounded',
    'segoe ui', 'helvetica neue', 'helvetica', 'arial', 'arial black', 'roboto', 'inter', 'georgia', 'times new roman',
    'noto sans', 'ubuntu', 'cantarell', 'source sans 3', 'verdana', 'tahoma', 'trebuchet ms',
]);

/** The slant given to italic text, as a shear. */
const ITALIC_SHEAR = 0.2;

/** CSS's default oblique angle, in degrees, as a `slnt` axis measures it. */
const OBLIQUE_ANGLE = -14;

/**
 * Matches a character that joins the one before it, and so stays in its
 * run: a combining mark, which includes the variation selectors, or a
 * joiner.
 */
const JOINER = /^(?:\p{M}|‌|‍)$/u;

/**
 * Lays text out in runs, each in one face, with kerning within each run, as
 * a browser does. Text that one face draws is one run.
 */
function lay(ctx: CanvasRenderingContext2D, p: ParsedFont, text: string): Laid {
    const spacing = toPixels(ctx.letterSpacing, p.size);
    const runs: LaidRun[] = [];
    let pen = 0;
    for (const part of splitRuns(p.faces, text)) {
        const run = part.face.font.layout(part.text);
        const scale = p.size / part.face.font.unitsPerEm;
        const x: number[] = [];
        const y: number[] = [];
        for (let i = 0; i < run.glyphs.length; i++) {
            const position = run.positions[i];
            x.push(pen + position.xOffset * scale);
            y.push(position.yOffset * scale);
            pen += position.xAdvance * scale + spacing;
        }
        runs.push({ face: part.face, text: part.text, glyphs: run.glyphs, x, y, scale });
    }
    return { runs, width: pen };
}

/**
 * Splits text into the longest stretches that one face draws. Each character
 * goes to the first face that has it, or to the last face if none has it.
 */
function splitRuns(faces: readonly Face[], text: string): { readonly face: Face; readonly text: string }[] {
    if (faces.length === 1) return [{ face: faces[0], text }];
    const runs: { face: Face; text: string }[] = [];
    let current: Face | undefined;
    let start = 0;
    let end = 0;
    for (const char of text) {
        const code = char.codePointAt(0) ?? 0;
        const face = current !== undefined && JOINER.test(char)
            ? current
            : faces.find((f) => f.font.hasGlyphForCodePoint(code)) ?? faces[faces.length - 1];
        if (face !== current) {
            if (current !== undefined) runs.push({ face: current, text: text.slice(start, end) });
            current = face;
            start = end;
        }
        end += char.length;
    }
    if (current !== undefined) runs.push({ face: current, text: text.slice(start) });
    return runs;
}

/** Adds a face to the end of a list of faces, unless the list already ends with it. */
function addFace(faces: Face[], face: Face): void {
    const last = faces.at(-1);
    if (last === undefined || last.font !== face.font || last.shear !== face.shear) faces.push(face);
}

/**
 * Returns a letter spacing in pixels. The canvas keeps it as the CSS length
 * that it was given, such as `2px` or `0.1em`, where `em` is the font's
 * size. A length in another unit is resolved by CSS, on an element with the
 * font's size, and cached.
 */
function toPixels(length: string, fontSize: number): number {
    if (length.endsWith('px')) return parseFloat(length) || 0;
    const key = `${length} ${fontSize}`;
    let pixels = resolvedLengths.get(key);
    if (pixels === undefined) {
        const probe = document.createElement('span');
        probe.style.fontSize = `${fontSize}px`;
        probe.style.letterSpacing = length;
        document.documentElement.append(probe);
        pixels = parseFloat(getComputedStyle(probe).letterSpacing) || 0;
        probe.remove();
        resolvedLengths.set(key, pixels);
    }
    return pixels;
}

/** Letter spacings resolved by CSS, by their length and font size. */
const resolvedLengths = new Map<string, number>();

/** Returns the offset of text from its x for the context's alignment. `start` and `end` follow the text's direction. */
function computeAlignOffset(ctx: CanvasRenderingContext2D, width: number): number {
    const isRtl = isRightToLeft(ctx);
    switch (ctx.textAlign) {
        case 'center': return -width / 2;
        case 'right': return -width;
        case 'end': return isRtl ? 0 : -width;
        case 'start': return isRtl ? -width : 0;
        default: return 0;
    }
}

/**
 * Returns whether the context's text runs right to left. A context whose
 * direction is `inherit`, the default, takes its canvas's, if the canvas is
 * in the page, and runs left to right otherwise.
 */
function isRightToLeft(ctx: CanvasRenderingContext2D): boolean {
    if (ctx.direction !== 'inherit') return ctx.direction === 'rtl';
    const canvas = ctx.canvas as HTMLCanvasElement | OffscreenCanvas;
    return canvas instanceof HTMLCanvasElement && canvas.isConnected && getComputedStyle(canvas).direction === 'rtl';
}

/** Returns the offset of text from its y for the context's baseline, by the metrics of the font that draws the text, as the canvas does. */
function computeBaselineOffset(ctx: CanvasRenderingContext2D, p: ParsedFont): number {
    const font = p.faces[0].font;
    const scale = p.size / font.unitsPerEm;
    const ascent = font.ascent * scale;
    const descent = -font.descent * scale;
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
    /** The font whose digits name a character that no font has. */
    readonly digits: Font;
}): Path2D {
    const { ctx, p, text, x, y, maxWidth } = options;
    const laid = lay(ctx, p, text);
    // Text wider than maxWidth is squeezed to fit, as the canvas does.
    const squeeze = maxWidth !== undefined && laid.width > maxWidth && laid.width > 0 ? maxWidth / laid.width : 1;
    const originX = x + computeAlignOffset(ctx, laid.width * squeeze);
    const originY = y + computeBaselineOffset(ctx, p);
    const path = new Path2D();
    for (const run of laid.runs) addRunToPath({ path, run, originX, originY, squeeze, digits: options.digits });
    return path;
}

/** Adds the outlines of a run's glyphs to a path. */
function addRunToPath(options: {
    readonly path: Path2D;
    readonly run: LaidRun;
    readonly originX: number;
    readonly originY: number;
    readonly squeeze: number;
    readonly digits: Font;
}): void {
    const { path, run, originX, originY, squeeze } = options;
    const font = run.face.font;
    const s = run.scale;
    const shear = run.face.shear;
    // The characters that the font lacks, in order. Each is laid out as the
    // font's empty glyph, glyph 0, which looks the same for every character.
    const missing = [...run.text].map((c) => c.codePointAt(0) ?? 0).filter((code) => !font.hasGlyphForCodePoint(code));
    let nextMissing = 0;
    for (let i = 0; i < run.glyphs.length; i++) {
        const gx = originX + run.x[i] * squeeze;
        const gy = originY - run.y[i];
        const px = (u: number, v: number) => gx + (u * s + v * s * shear) * squeeze;
        const py = (v: number) => gy - v * s;
        const glyph = run.glyphs[i];
        const commands = glyph.id === 0 && nextMissing < missing.length
            ? drawMissingGlyph({ code: missing[nextMissing++], width: glyph.advanceWidth, height: font.capHeight, digits: options.digits })
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
    let left = Infinity;
    let right = -Infinity;
    let top = -Infinity;
    let bottom = Infinity;
    for (const run of laid.runs) {
        const s = run.scale;
        for (let i = 0; i < run.glyphs.length; i++) {
            const b = run.glyphs[i].bbox;
            if (!Number.isFinite(b.minX) || b.maxX <= b.minX) continue;
            left = Math.min(left, run.x[i] + b.minX * s);
            right = Math.max(right, run.x[i] + b.maxX * s);
            top = Math.max(top, run.y[i] + b.maxY * s);
            bottom = Math.min(bottom, run.y[i] + b.minY * s);
        }
    }
    if (!Number.isFinite(left)) left = right = top = bottom = 0;
    const align = computeAlignOffset(ctx, laid.width);
    const base = computeBaselineOffset(ctx, p);
    const font = p.faces[0].font;
    const s = p.size / font.unitsPerEm;
    const ascent = font.ascent * s;
    const descent = -font.descent * s;
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

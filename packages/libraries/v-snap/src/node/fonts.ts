/**
 * The `fonts` option, which registers a project's own font files for named
 * families, so that canvas text asking for them draws in them. Node checks
 * every file when the config loads, before the browser starts: that it is
 * there, that fontkit can read it, and that it holds one font. It reads each
 * face's weight and style from the file, unless the option gives them, and
 * the page gets the checked faces through Vitest's `provide`.
 */

import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as fontkit from 'fontkit';
import type { ProvidedFontFace, ProvidedFontFamily } from '../protocol.ts';
import { toDisplayPath } from './paths.ts';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * One font file of a family: its path, relative to v-snap's root, or the
 * path with the weight and style that it is used as, which override what
 * the file says, as `@font-face` descriptors do.
 */
export type FontSource = string | {
    readonly src: string;
    /** A weight, or a range for a variable font. By default, read from the file. */
    readonly weight?: number | readonly [number, number];
    /** By default, read from the file. */
    readonly style?: 'normal' | 'italic';
};

/** The `fonts` option: each family's name, and its font file or files. */
export type FontFamilies = Readonly<Record<string, FontSource | readonly FontSource[]>>;

/** The registered families, checked, and the folders that the page fetches their files from. */
export interface ResolvedFonts {
    readonly families: readonly ProvidedFontFamily[];
    readonly folders: readonly string[];
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Checks the `fonts` option and reads each face's descriptors. It throws, with
 * the family named, for a file that is missing, isn't a font, or is a
 * collection of fonts, for two names that differ only in case, and for a
 * generic family other than `sans-serif` and `monospace`.
 */
export function resolveFonts(root: string, fonts: FontFamilies | undefined): ResolvedFonts {
    const families: ProvidedFontFamily[] = [];
    const folders = new Set<string>();
    const names = new Map<string, string>();
    for (const [family, given] of Object.entries(fonts ?? {})) {
        const name = family.trim();
        const key = name.toLowerCase();
        if (name === '') throw new Error("v-snap's fonts option registers a family with no name. Name each family as the font lists ask for it, such as MyGameFont.");
        const other = names.get(key);
        if (other !== undefined) {
            throw new Error(`v-snap's fonts option registers ${other} and ${name}, which differ only in case. A font list's names match in any case, as in CSS, so register the family once.`);
        }
        names.set(key, name);
        if (GENERIC_FAMILIES.has(key) && !REPLACEABLE_FAMILIES.has(key)) {
            throw new Error(`v-snap's fonts option registers ${name}, which is a generic family. Of the generic families, only sans-serif and monospace can be registered, to replace v-snap's own fonts for them.`);
        }
        const sources = (typeof given === 'string' || !Array.isArray(given) ? [given] : given) as readonly FontSource[];
        if (sources.length === 0) throw new Error(`v-snap's fonts option gives ${name} no font files. Give it a file, or leave it out.`);
        const faces = sources.map((source) => readFace({ root, family: name, source }));
        for (const face of faces) folders.add(dirname(face.path));
        families.push({ family: name, faces: faces.map((face) => face.provided) });
    }
    return { families, folders: [...folders] };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** CSS's generic families, which name no font of their own. */
const GENERIC_FAMILIES: ReadonlySet<string> = new Set([
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded',
    'emoji', 'math', 'fangsong',
]);

/** The generic families that a project may register, which replace v-snap's own fonts. */
const REPLACEABLE_FAMILIES: ReadonlySet<string> = new Set(['sans-serif', 'monospace']);

function readFace(options: { readonly root: string; readonly family: string; readonly source: FontSource }): { path: string; provided: ProvidedFontFace } {
    const { family, source } = options;
    const given = typeof source === 'string' ? { src: source } : source;
    if (typeof given.src !== 'string' || given.src === '') throw new Error(`v-snap's fonts option gives ${family} a font with no src. Give each font file's path, relative to v-snap's root.`);
    const path = resolve(options.root, given.src);
    const shown = toDisplayPath(path);
    if (!statSync(path, { throwIfNoEntry: false })?.isFile()) {
        throw new Error(`v-snap's fonts option gives ${family} the file ${shown}, which doesn't exist. Font paths are relative to v-snap's root, ${toDisplayPath(options.root)}.`);
    }
    let font: fontkit.Font | fontkit.FontCollection;
    try {
        font = fontkit.create(readFileSync(path));
    }
    catch (error) {
        throw new Error(
            `v-snap's fonts option gives ${family} the file ${shown}, which isn't a font file that v-snap can read (OpenType, TrueType, WOFF or WOFF2): ${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
        );
    }
    if ('fonts' in font) {
        throw new Error(`v-snap's fonts option gives ${family} the file ${shown}, which is a collection of fonts. A path can't say which of them to use, so give a file that holds one font.`);
    }
    const weight = given.weight === undefined ? readWeight(font) : checkWeight(family, given.weight);
    const style = given.style ?? (isItalic(font) ? 'italic' : 'normal');
    if (style !== 'normal' && style !== 'italic') throw new Error(`v-snap's fonts option gives ${family} the style ${String(style)}. A face's style is normal or italic.`);
    return { path, provided: { url: toFsUrl(path), file: shown, weight, style } };
}

/** Returns a face's weights, as its file says: a variable face's `wght` axis, or a static face's weight class. */
function readWeight(font: fontkit.Font): readonly [number, number] {
    const axis = font.variationAxes.wght;
    if (axis !== undefined) return [axis.min, axis.max];
    const weight = font['OS/2']?.usWeightClass;
    return weight !== undefined && weight >= 1 && weight <= 1000 ? [weight, weight] : [400, 400];
}

function checkWeight(family: string, weight: number | readonly [number, number]): readonly [number, number] {
    const range = typeof weight === 'number' ? [weight, weight] as const : weight;
    const [min, max] = range;
    const isWeight = (w: unknown): boolean => typeof w === 'number' && w >= 1 && w <= 1000;
    if (range.length !== 2 || !isWeight(min) || !isWeight(max) || min > max) {
        throw new Error(`v-snap's fonts option gives ${family} the weight ${JSON.stringify(weight)}. A weight is a number from 1 to 1000, or a range of two, the lighter first.`);
    }
    return [min, max];
}

/** Returns whether a face is italic, as its file says: by its selection flags, or by its italic angle. */
function isItalic(font: fontkit.Font): boolean {
    const selection = font['OS/2']?.fsSelection;
    return selection?.italic === true || selection?.oblique === true || (font.italicAngle !== 0 && Number.isFinite(font.italicAngle));
}

/** Returns the URL at which Vite serves a file by its path, which works for a file outside the root too, once its folder is allowed. */
function toFsUrl(path: string): string {
    const segments = path.replaceAll('\\', '/').replace(/^\/+/, '').split('/');
    // A Windows drive's colon stays as it is, as Vite writes it.
    return `/@fs/${segments.map((segment) => encodeURIComponent(segment).replaceAll('%3A', ':')).join('/')}`;
}

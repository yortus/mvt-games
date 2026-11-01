import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEME_KINDS, type ThemeKind } from './models';

// Each theme's colours, read from its CSS as the page has them, and checked
// for contrast: text a visitor must read stands out from what it lies on by
// at least WCAG AA's ratio, 4.5:1, and secondary text and controls by 3:1.

/** Pairs of tokens: the text, what it lies on, and the ratio it needs. */
const PAIRS: readonly (readonly [text: string, under: string, ratio: number])[] = [
    ['text', 'bg', 4.5],
    ['text', 'surface', 4.5],
    ['text-strong', 'surface', 4.5],
    ['text-strong', 'raised', 4.5],
    ['text-muted', 'surface', 4.5],
    ['text-muted', 'bg', 4.5],
    ['text-faint', 'surface', 3],
    ['accent', 'surface', 4.5],
    ['highlight', 'surface', 3],
    ['on-accent-fill', 'accent-fill', 4.5],
    ['on-go', 'go', 4.5],
    ['on-highlight', 'highlight', 4.5],
    ['card-badge-text', 'surface', 4.5],
    ['on-tag', 'tag-era', 4.5],
    ['on-tag', 'tag-genre', 4.5],
    ['on-tag', 'tag-renderer', 4.5],
    ['highscore-1', 'highscore-bg', 3],
    ['highscore-2', 'highscore-bg', 3],
    ['highscore-3', 'highscore-bg', 3],
    ['highscore-4', 'highscore-bg', 3],
    ['highscore-5', 'highscore-bg', 3],
    ['placed-rank', 'highscore-bg', 3],
];

describe.each(THEME_KINDS)('the %s theme', (theme) => {
    const tokens = readTheme(theme);

    it('gives every property the Arcade theme has a value', () => {
        const arcade = readTheme('arcade');
        for (const name of arcade.keys()) expect(tokens.has(name), `--theme-${name}`).toBe(true);
    });

    it.each(PAIRS)('sets %s on %s apart enough to read', (text, under, ratio) => {
        const contrast = contrastOf(colourOf(tokens, text), colourOf(tokens, under));
        expect(contrast, `${text} on ${under}: ${contrast.toFixed(2)}:1`).toBeGreaterThanOrEqual(ratio);
    });
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Each theme's file. The Arcade's is the default, in `themes.css`. */
const FILES: Readonly<Record<ThemeKind, string>> = { arcade: 'themes.css', dark: 'theme-dark.css', light: 'theme-light.css' };

/** The theme's properties, by name without `--theme-`, as written: values may name other properties. */
function readTheme(theme: ThemeKind): Map<string, string> {
    const css = readFileSync(join(import.meta.dirname, FILES[theme]), 'utf8');
    const start = css.indexOf(`:root[data-theme="${theme}"] {`);
    const block = css.slice(start, css.indexOf('}', start));
    const tokens = new Map<string, string>();
    for (const match of block.matchAll(/--theme-([a-z0-9-]+):\s*([^;]+);/g)) tokens.set(match[1], match[2].trim());
    return tokens;
}

/** A property's colour as red, green and blue from 0 to 255, following `var()`s. Only solid colours are checked. */
function colourOf(tokens: Map<string, string>, name: string): readonly [number, number, number] {
    let value = tokens.get(name) ?? '';
    for (let match = /^var\(--theme-([a-z0-9-]+)\)$/.exec(value); match !== null; match = /^var\(--theme-([a-z0-9-]+)\)$/.exec(value)) {
        value = tokens.get(match[1]) ?? '';
    }
    let hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value)?.[1];
    if (hex === undefined) throw new Error(`--theme-${name} is not a solid colour: ${value}`);
    if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

/** WCAG's contrast ratio between two colours, from 1 to 21. */
function contrastOf(a: readonly [number, number, number], b: readonly [number, number, number]): number {
    const [lighter, darker] = [luminanceOf(a), luminanceOf(b)].sort((x, y) => y - x);
    return (lighter + 0.05) / (darker + 0.05);
}

function luminanceOf([r, g, b]: readonly [number, number, number]): number {
    const linear = (c: number): number => {
        const s = c / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

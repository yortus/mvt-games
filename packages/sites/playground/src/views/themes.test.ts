import { describe, expect, it } from 'vitest';
import { THEME_KINDS } from '../models';
import { THEMES } from './themes';

/** The least contrast for body text, and for large or secondary text and marks, as WCAG 2 sets them. */
const TEXT_CONTRAST = 4.5;
const SECONDARY_CONTRAST = 3;

describe('the themes', () => {
    it('has one for each kind', () => {
        expect(Object.keys(THEMES).sort()).toEqual([...THEME_KINDS].sort());
    });

    for (const kind of THEME_KINDS) {
        const { name, palette } = THEMES[kind];

        it(`${name}: text reads on the editor, the panels and what is raised`, () => {
            for (const surface of ['background', 'panel', 'raised'] as const) {
                expect(contrastOf(palette.text, palette[surface]), surface).toBeGreaterThanOrEqual(TEXT_CONTRAST);
            }
        });

        it(`${name}: muted text, links and problems read on the panels`, () => {
            for (const colour of ['muted', 'accent', 'error', 'warning', 'success'] as const) {
                expect(contrastOf(palette[colour], palette.panel), colour).toBeGreaterThanOrEqual(SECONDARY_CONTRAST);
                expect(contrastOf(palette[colour], palette.selected), `${colour} on selected`).toBeGreaterThanOrEqual(SECONDARY_CONTRAST);
            }
        });
    }
});

/** The contrast ratio between two colours written as `#rrggbb`, from 1 to 21. */
function contrastOf(a: string, b: string): number {
    const [lighter, darker] = [luminanceOf(a), luminanceOf(b)].sort((x, y) => y - x);
    return (lighter + 0.05) / (darker + 0.05);
}

/** A colour's relative luminance, as WCAG 2 defines it. */
function luminanceOf(colour: string): number {
    const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(colour);
    if (match === null) throw new Error(`Not a #rrggbb colour: ${colour}`);
    const [r, g, b] = match.slice(1).map((hex) => {
        const channel = Number.parseInt(hex, 16) / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

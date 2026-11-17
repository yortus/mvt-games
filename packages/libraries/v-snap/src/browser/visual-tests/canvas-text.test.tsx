// Canvas text in a project's own fonts. This package's Vitest config
// registers Fixture Mono, two static faces, Regular (400) and Bold (700),
// cut from Source Code Pro to capitals, digits and a little punctuation. So
// its text is monospaced where the sans-serif test font is not, and its
// lower case falls back to another font.
import { expect, it } from 'vitest';
import { canvasTest } from '../visual-test';

/** Returns a canvas with a row of text in each font, on the tests' background. */
function drawRows(rows: readonly { readonly font: string; readonly text: string }[]): OffscreenCanvas {
    const canvas = new OffscreenCanvas(240, 12 + rows.length * 30);
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('The browser gave no 2D context.');
    ctx.fillStyle = '#202024';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < rows.length; i++) {
        ctx.font = rows[i].font;
        ctx.fillText(rows[i].text, 8, 32 + i * 30);
    }
    return canvas;
}

/** Returns the width of text in a font, as the canvas measures it. */
function measureWidth(font: string, text: string): number {
    const ctx = new OffscreenCanvas(10, 10).getContext('2d');
    if (ctx === null) throw new Error('The browser gave no 2D context.');
    ctx.font = font;
    return ctx.measureText(text).width;
}

// Measured as this module loads, as a game's code may measure or draw text,
// such as a bitmap font made at the top of a module. The page registers the
// fonts before it imports any test file.
const widthAtLoad = measureWidth('20px "Fixture Mono"', 'WIDE');

// Each weight picks a face as CSS does: 300 and 450 pick Regular, and 600
// picks Bold. Neither face is italic, so italic text is slanted. No list
// ends with a generic family, which a registered family doesn't need.
canvasTest('a registered family, at each weight and in italic', { kind: 'canvas' }, () => drawRows([
    { font: '300 22px "Fixture Mono"', text: '300 POINTS' },
    { font: '450 22px "Fixture Mono"', text: '450 POINTS' },
    { font: '600 22px "Fixture Mono"', text: '600 POINTS' },
    { font: 'italic 700 22px "Fixture Mono"', text: '700 POINTS' },
]));

// Fixture Mono lacks lower case and ★. The lower case falls back to the
// test font for the list's generic family, sans-serif, and ★ to a box, as
// in a font that no font has.
canvasTest('characters a registered font lacks', { kind: 'canvas' }, () => drawRows([
    { font: '22px "Fixture Mono", sans-serif', text: 'Score ★ 1,250' },
]));

it('measures text in a registered font, even as a module loads', () => {
    // Each of Source Code Pro's glyphs is 0.6 em wide: 12 pixels at 20 pixels.
    expect(widthAtLoad).toBe(48);
    expect(measureWidth('20px sans-serif', 'WIDE')).not.toBe(48);
});

// The config registers Fixture Sans, a proportional face of capitals and
// digits, for monospace. So it draws every family that picks the monospace
// test font, such as Consolas, and their lower case falls back to the test
// font itself.
canvasTest("a project's own font for monospace", { kind: 'canvas' }, () => drawRows([
    { font: '22px monospace', text: 'SCORE 1,250' },
    { font: '22px Consolas', text: 'Score 1,250' },
]));

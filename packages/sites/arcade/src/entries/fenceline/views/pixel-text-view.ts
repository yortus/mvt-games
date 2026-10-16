import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { drawPixels } from './drawing';
import { measurePixelText, spellPixelText } from './pixel-font';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PixelTextViewBindings {
    /** What it spells, in the game's pixel font. Lower-case letters are drawn as capitals. */
    text: () => string;
    /** The text's colour, and the colour of its shadow, a pixel down and to the right. Read once. */
    colour: number;
    shadow: number;
    /** How many screen pixels each of the font's pixels takes, across and down. Read once. */
    scale: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A line of text in the game's pixel font (`pixel-font.ts`), with a drop
 * shadow, as 80s arcade games set their text. It is centred across the
 * view's origin, with its top on it. It is drawn again only when its text
 * changes. Its label is its text, so a test can read it.
 */
export function PixelTextView(bindings: PixelTextViewBindings): Container {
    const { colour, shadow, scale } = bindings;
    const glyphs = new Graphics();
    glyphs.scale.set(scale);
    const view = new Container();
    view.addChild(glyphs);
    let drawnText: string | undefined;

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const text = bindings.text();
        if (text === drawnText) return;
        drawnText = text;
        view.label = text;
        glyphs.clear();
        drawPixels(glyphs, spellPixelText(text, shadow), 1, 1);
        drawPixels(glyphs, spellPixelText(text, colour));
        // Whole screen pixels from the origin, so the font stays crisp
        glyphs.position.set(-Math.round(measurePixelText(text) * scale / 2), 0);
    }
}

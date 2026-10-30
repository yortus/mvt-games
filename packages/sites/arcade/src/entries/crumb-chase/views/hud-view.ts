import { Container } from 'pixi.js';
import { createComputed } from '@mvtjs/utils';
import { PixelTextView } from '#shared';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HudViewBindings {
    score: () => number;
    /** A line on how to play, at the right, such as how to steer on a touch screen. Read once. Empty for none. */
    hint: string;
    /** The HUD's width, in pixels, for the hint to sit against its right edge. Read once. */
    width: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The strip below the maze: the score at the left, and a hint on how to play at the right. */
export function HudView(bindings: HudViewBindings): Container {
    const scoreText = createComputed({ watch: bindings.score, compute: (score) => `SCORE: ${score}` });

    const view = new Container();
    initialiseView();
    return view;

    function initialiseView(): void {
        const scoreLine = PixelTextView({ text: scoreText, color: TEXT_COLOR, scale: TEXT_SCALE });
        scoreLine.position.set(8, TEXT_Y);
        view.addChild(scoreLine);

        if (bindings.hint === '') return;
        const hintLine = PixelTextView({ text: bindings.hint, color: HINT_COLOR, scale: TEXT_SCALE, anchorX: 1 });
        hintLine.position.set(bindings.width - 8, TEXT_Y);
        view.addChild(hintLine);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TEXT_COLOR = 0xffffff;
/** The glyphs at twice their size: capitals 14 pixels tall, in the middle of the strip. */
const TEXT_SCALE = 2;
const TEXT_Y = 8;

/** The hint is quieter than the score. */
const HINT_COLOR = 0x9aa4b2;

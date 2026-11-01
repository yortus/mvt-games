import { Container, Text } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { createComputed } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How quickly the score rolls up, in ms. In this time, it closes about two thirds of the gap. */
const ROLL_MS = 200;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ScoreViewBindings {
    readonly score: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A score that rolls up to the model's score, rather than jumping. The
 * number on screen is presentation state: the model's score is already
 * there, and nothing in the game depends on the roll.
 */
export function ScoreView(bindings: ScoreViewBindings): Container {
    const view = new Container();
    const digits = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 72, fontWeight: 'bold', fill: 0xffd166 } });
    digits.anchor.set(0.5, 0.5);
    view.addChild(digits);

    // Presentation state: the score on screen. It starts at the model's, so the first refresh is right.
    let shownScore = bindings.score();

    function update(deltaMs: number): void {
        const score = bindings.score();
        // Closes most of the gap at once, then slows down, so a big jump rolls up as fast as a small one
        shownScore += (score - shownScore) * (1 - Math.exp(-deltaMs / ROLL_MS));
        if (Math.abs(score - shownScore) < 0.5) shownScore = score;
    }

    // The text is made again only when the whole number on screen changes
    const scoreText = createComputed({ watch: () => Math.round(shownScore), compute: String });

    function refresh(): void {
        digits.text = scoreText();
    }

    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;
}

import { Container, Text } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { createComputed } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How quickly the shown score catches up, in ms. Smaller is quicker. */
const COUNT_MS = 150;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SmoothScoreViewBindings {
    readonly score: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The score, which counts up smoothly to the real one rather than jumping.
 * The number shown is this view's own presentation state, kept inline: one
 * number, moved on in `update` and written in `refresh`.
 */
export function SmoothScoreView(bindings: SmoothScoreViewBindings): Container {
    const view = new Container();
    const text = new Text({ style: SCORE_STYLE });
    text.position.set(64, 72);
    view.addChild(text);

    // The score as shown, which starts at the real one
    let displayedScore = bindings.score();
    // The text is made again only when the whole number shown changes
    const scoreLabel = createComputed({ watch: () => Math.round(displayedScore), compute: formatScore });

    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function update(deltaMs: number): void {
        const score = bindings.score();
        // Close part of the gap each tick, and snap the last little bit
        displayedScore += (score - displayedScore) * (1 - Math.exp(-deltaMs / COUNT_MS));
        if (Math.abs(score - displayedScore) < 0.5) displayedScore = score;
    }

    function refresh(): void {
        text.text = scoreLabel();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SCORE_STYLE = { fontFamily: 'monospace', fontSize: 36, fontWeight: 'bold', fill: 0xffd75e } as const;

function formatScore(score: number): string {
    return 'SCORE ' + String(score).padStart(6, '0');
}

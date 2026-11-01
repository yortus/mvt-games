/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { LivesView } from './lives-view';
import { ScoreLabelView } from './score-label-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HudViewBindings {
    readonly score: () => number;
    readonly lives: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The score on the left, and the lives on the right. This view is a parent
 * too: it passes each of its own bindings on to the child that shows it,
 * so it knows nothing about the game, and stays as reusable as they are.
 */
export function HudView(bindings: HudViewBindings): Container {
    return (
        <container>
            <ScoreLabelView score={bindings.score} />
            <container x={LIVES_X}>
                <LivesView lives={bindings.lives} />
            </container>
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Where the lives start, in pixels from the HUD's left edge. */
const LIVES_X = 340;

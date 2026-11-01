/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { createComputed } from '@mvtjs/utils';
import { LABEL_STYLE } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ScoreLabelViewBindings {
    readonly score: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The score, as text. The text is built again only when the score changes. */
export function ScoreLabelView(bindings: ScoreLabelViewBindings): Container {
    const scoreText = createComputed({
        watch: bindings.score,
        compute: (score) => `Score ${score}`,
    });

    return <text text={scoreText} style={LABEL_STYLE} />;
}

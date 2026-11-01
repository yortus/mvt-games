/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { createComputed } from '@mvtjs/utils';
import { HEADING_STYLE, SCREEN_HEIGHT, SCREEN_WIDTH, TEXT_STYLE } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameOverViewBindings {
    readonly score: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The end of a round, and its score. */
export function GameOverView(bindings: GameOverViewBindings): Container {
    const scoreText = createComputed({
        watch: bindings.score,
        compute: (score) => `You hit the target ${score} ${score === 1 ? 'time' : 'times'}`,
    });

    return (
        <container>
            <text text="GAME OVER" anchor={0.5} x={SCREEN_WIDTH / 2} y={SCREEN_HEIGHT / 2 - 30} style={HEADING_STYLE} />
            <text text={scoreText} anchor={0.5} x={SCREEN_WIDTH / 2} y={SCREEN_HEIGHT / 2 + 30} style={TEXT_STYLE} />
        </container>
    );
}

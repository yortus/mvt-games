import { Container, Text } from 'pixi.js';
import { createWatch } from '../utils';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HudViewBindings {
    getScore(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createHudView(bindings: HudViewBindings): Container {
    // ---- Change detection -------------------------------------------------------
    const watchScore = createWatch(bindings.getScore);

    // ---- Scene elements -------------------------------------------------------
    const container = new Container();
    const scoreText = new Text({
        text: 'Score: 0',
        style: {
            fontFamily: 'monospace',
            fontSize: 18,
            fill: 0xffffff,
        },
    });
    scoreText.position.set(8, 4);
    container.addChild(scoreText);

    container.onRender = refresh;
    return container;

    function refresh(): void {
        if (watchScore.changed()) {
            scoreText.text = `Score: ${watchScore.value}`;
        }
    }
}

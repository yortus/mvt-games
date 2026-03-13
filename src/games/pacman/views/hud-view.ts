import { Container, Text } from 'pixi.js';
import { createWatcher } from '#utils';

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
    const watched = createWatcher({ score: bindings.getScore });

    // ---- Scene elements -------------------------------------------------------
    const view = new Container();
    const scoreText = new Text({
        text: 'Score: 0',
        style: {
            fontFamily: 'monospace',
            fontSize: 18,
            fill: 0xffffff,
        },
    });
    scoreText.position.set(8, 4);
    view.addChild(scoreText);

    view.onRender = refresh;
    return view;

    function refresh(): void {
        watched.poll();

        if (watched.score.changed) {
            scoreText.text = `Score: ${watched.score.value}`;
        }
    }
}

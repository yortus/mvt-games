import { Container, Text } from 'pixi.js';
import { watch } from '#common';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HudViewBindings {
    getScore(): number;
    getScreenWidth(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createHudView(bindings: HudViewBindings): Container {
    const watcher = watch({ score: bindings.getScore });
    let scoreText: Text;

    const view = new Container();
    initialiseView();
    view.onRender = refresh;
    return view;

    function initialiseView(): void {
        scoreText = new Text({
            text: 'Score: 0',
            style: { fontFamily: 'monospace', fontSize: 70, fill: 0xffffff },
        });
        scoreText.position.set(40, 40);
        view.addChild(scoreText);
    }

    function refresh(): void {
        const watched = watcher.poll();
        if (watched.score.changed) {
            scoreText.text = `Score: ${watched.score.value}`;
        }
    }
}

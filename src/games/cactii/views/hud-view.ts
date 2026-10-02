import { Container, Text } from 'pixi.js';
import { watch } from '#mvt-utils';
import { onTick } from '../../../pixi-mvt';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HudViewBindings {
    score: () => number;
    screenWidth: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function HudView(bindings: HudViewBindings): Container {
    const watcher = watch({ score: bindings.score });
    let scoreText: Text;

    const view = new Container();
    initialiseView();
    onTick(view, { refresh });
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

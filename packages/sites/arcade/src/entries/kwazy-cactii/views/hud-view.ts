import { Container, Text } from 'pixi.js';
import { createReaction } from '@mvtjs/utils';
import { setRefresh } from '@mvtjs/pixi';

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
    let scoreText: Text;
    const writeScoreWhenScoreChanges = createReaction({ watch: bindings.score, react: (score) => writeScore(score) });

    const view = new Container();
    initialiseView();
    setRefresh(view, refresh);
    return view;

    function initialiseView(): void {
        scoreText = new Text({
            text: '',
            style: { fontFamily: 'monospace', fontSize: 70, fill: 0xffffff },
        });
        scoreText.position.set(40, 40);
        view.addChild(scoreText);
        writeScore(bindings.score());
    }

    function refresh(): void {
        writeScoreWhenScoreChanges();
    }

    function writeScore(score: number): void {
        scoreText.text = `Score: ${score}`;
    }
}

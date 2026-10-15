import { Container, Text } from 'pixi.js';
import { watch } from '@mvtjs/utils';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HudViewBindings {
    score: () => number;
    /** A line on how to play, at the right, such as how to steer on a touch screen. Read once. Empty for none. */
    hint: string;
    /** The HUD's width, in pixels, for the hint to sit against its right edge. Read once. */
    width: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The strip below the maze: the score at the left, and a hint on how to play at the right. */
export function HudView(bindings: HudViewBindings): Container {
    const watcher = watch({ score: bindings.score });
    let scoreText: Text;

    const view = new Container();
    initialiseView();
    setRefresh(view, refresh);
    return view;

    function initialiseView(): void {
        scoreText = new Text({ text: 'Score: 0', style: TEXT_STYLE });
        scoreText.position.set(8, 4);
        view.addChild(scoreText);

        if (bindings.hint === '') return;
        const hintText = new Text({ text: bindings.hint, style: { ...TEXT_STYLE, fill: HINT_COLOR } });
        hintText.anchor.set(1, 0);
        hintText.position.set(bindings.width - 8, 4);
        view.addChild(hintText);
    }

    function refresh(): void {
        const watched = watcher.poll();

        if (watched.score.changed) {
            scoreText.text = `Score: ${watched.score.value}`;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TEXT_STYLE = {
    fontFamily: 'monospace',
    fontSize: 18,
    fill: 0xffffff,
};

/** The hint is quieter than the score. */
const HINT_COLOR = 0x9aa4b2;

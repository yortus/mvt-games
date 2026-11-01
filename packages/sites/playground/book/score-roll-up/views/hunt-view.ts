import { Container, Rectangle, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createComputed } from '@mvtjs/utils';
import type { GemModel } from '../models';
import { ScoreView } from './score-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HuntViewBindings {
    readonly model: GemModel;
    /** The size of the play area, which takes clicks. Read once. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The model's score as it is, and below it the score rolling up. Click, or
 * press Space, to find a gem now.
 */
export function HuntView({ model, width, height }: HuntViewBindings): Container {
    const view = new Container();

    const modelScore = makeText(width / 2, 50, 20, 0x8899bb);
    const score = ScoreView({ score: () => model.score });
    score.position.set(width / 2, 130);
    const caption = makeText(width / 2, 192, 14, 0xffd166);
    caption.text = 'ScoreView, rolling up to it';
    const hint = makeText(width / 2, 240, 14, 0x55607a);
    hint.text = 'click, or press Space, to find a gem now';
    view.addChild(modelScore, score, caption, hint);

    view.eventMode = 'static';
    view.cursor = 'pointer';
    view.hitArea = new Rectangle(0, 0, width, height);
    view.on('pointertap', () => model.findGem());
    window.addEventListener('keydown', onKeyDown);
    view.on('destroyed', () => window.removeEventListener('keydown', onKeyDown));

    const modelScoreText = createComputed({ watch: () => model.score, compute: (points) => `the model's score: ${points}` });

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        modelScore.text = modelScoreText();
    }

    function onKeyDown(e: KeyboardEvent): void {
        if (e.key !== ' ' || e.repeat) return;
        // Stops Space scrolling the page
        e.preventDefault();
        model.findGem();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function makeText(x: number, y: number, fontSize: number, fill: number): Text {
    const text = new Text({ text: '', style: { fontFamily: 'monospace', fontSize, fill } });
    text.anchor.set(0.5, 0.5);
    text.position.set(x, y);
    return text;
}

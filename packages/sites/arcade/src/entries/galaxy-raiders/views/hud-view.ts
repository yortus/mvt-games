import { Container, Sprite } from 'pixi.js';
import { createComputed, createReaction } from '@mvtjs/utils';
import { PixelTextView } from '#shared';
import { textures } from '../data';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HudViewBindings {
    score: () => number;
    lives: () => number;
    stage: () => number;
    screenWidth: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function HudView(bindings: HudViewBindings): Container {
    const scoreText = createComputed({ watch: bindings.score, compute: (score) => `SCORE: ${score}` });
    const stageText = createComputed({ watch: bindings.stage, compute: (stage) => `STAGE ${stage}` });
    const drawLivesWhenLivesChange = createReaction({ watch: bindings.lives, react: drawLives });
    let stageLine: Container;
    let livesContainer: Container;

    const view = new Container();
    initialiseView();
    setRefresh(view, refresh);
    return view;

    function initialiseView(): void {
        // Score - left
        const scoreLine = PixelTextView({ text: scoreText, color: TEXT_COLOR, scale: TEXT_SCALE });
        scoreLine.position.set(8, 8);
        view.addChild(scoreLine);

        // Stage - right
        stageLine = PixelTextView({ text: stageText, color: TEXT_COLOR, scale: TEXT_SCALE, anchorX: 1 });
        view.addChild(stageLine);

        // Lives - centre (ship icons)
        livesContainer = new Container();
        view.addChild(livesContainer);
        drawLives();
    }

    function refresh(): void {
        layOut();
        drawLivesWhenLivesChange();
    }

    function layOut(): void {
        const width = bindings.screenWidth();
        stageLine.position.set(width - 8, 8);
        livesContainer.position.set(width / 2 - 20, 6);
    }

    function drawLives(): void {
        livesContainer.removeChildren();
        const lives = bindings.lives();
        for (let i = 0; i < lives; i++) {
            const icon = new Sprite({ texture: textures.get().ship.icon });
            icon.position.set(i * 14, 0);
            livesContainer.addChild(icon);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TEXT_COLOR = 0xffffff;
/** The glyphs at their own size, as an arcade's 8-pixel font: the screen is too narrow for more beside the lives. */
const TEXT_SCALE = 1;

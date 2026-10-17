import { Container, Sprite } from 'pixi.js';
import { watch } from '@mvtjs/utils';
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
    const watcher = watch({
        score: bindings.score,
        lives: bindings.lives,
        stage: bindings.stage,
    });

    // The text each line shows, written when its number changes
    let scoreText = 'SCORE: 0';
    let stageText = 'STAGE 1';
    let stageLine: Container;
    let livesContainer: Container;

    const view = new Container();
    initialiseView();
    setRefresh(view, refresh);
    return view;

    function initialiseView(): void {
        // Score - left
        const scoreLine = PixelTextView({ text: () => scoreText, color: TEXT_COLOR, scale: TEXT_SCALE });
        scoreLine.position.set(8, 8);
        view.addChild(scoreLine);

        // Stage - right
        stageLine = PixelTextView({ text: () => stageText, color: TEXT_COLOR, scale: TEXT_SCALE, anchorX: 1 });
        view.addChild(stageLine);

        // Lives - centre (ship icons)
        livesContainer = new Container();
        view.addChild(livesContainer);
    }

    function refresh(): void {
        const watched = watcher.poll();

        if (watched.score.changed) {
            scoreText = `SCORE: ${watched.score.value}`;
        }
        if (watched.stage.changed) {
            stageText = `STAGE ${watched.stage.value}`;
            updateStageLayout();
        }
        if (watched.lives.changed) {
            updateLives();
        }
    }

    function updateStageLayout(): void {
        const width = bindings.screenWidth();
        stageLine.position.set(width - 8, 8);
        livesContainer.position.set(width / 2 - 20, 6);
    }

    function updateLives(): void {
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

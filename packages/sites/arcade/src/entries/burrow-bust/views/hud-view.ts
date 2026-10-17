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
    level: () => number;
    tileSize: () => number;
    cols: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function HudView(bindings: HudViewBindings): Container {
    const watcher = watch({
        score: bindings.score,
        lives: bindings.lives,
        level: bindings.level,
    });

    // The text each line shows, written when its number changes
    let scoreText = 'SCORE: 0';
    let levelText = 'LV 1';
    let levelLine: Container;
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

        // Level - right
        levelLine = PixelTextView({ text: () => levelText, color: TEXT_COLOR, scale: TEXT_SCALE, anchorX: 1 });
        view.addChild(levelLine);

        // Lives - center (small icons)
        livesContainer = new Container();
        view.addChild(livesContainer);
    }

    function refresh(): void {
        const watched = watcher.poll();

        if (watched.score.changed) {
            scoreText = `SCORE: ${watched.score.value}`;
        }
        if (watched.level.changed) {
            levelText = `LV ${watched.level.value}`;
            updateLevelLayout();
        }
        if (watched.lives.changed) {
            updateLives();
        }
    }

    function updateLevelLayout(): void {
        const width = bindings.cols() * bindings.tileSize();
        levelLine.position.set(width - 8, 8);
        livesContainer.position.set(width / 2 - 20, 4);
    }

    function updateLives(): void {
        livesContainer.removeChildren();
        const lives = bindings.lives();
        for (let i = 0; i < lives; i++) {
            const icon = new Sprite({ texture: textures.get().digger.icon });
            icon.position.set(i * 16, 0);
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

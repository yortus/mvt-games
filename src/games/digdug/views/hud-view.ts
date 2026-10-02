import { Container, Sprite, Text } from 'pixi.js';
import { watch } from '@mvtjs/utils';
import { textures } from '../data';
import { setTickMethods } from '../../../pixi-mvt';

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

    let scoreText: Text;
    let levelText: Text;
    let livesContainer: Container;

    const view = new Container();
    initialiseView();
    setTickMethods(view, { refresh });
    return view;

    function initialiseView(): void {
        // Score - left
        scoreText = new Text({
            text: 'Score: 0',
            style: { fontFamily: 'monospace', fontSize: 16, fill: 0xffffff },
        });
        scoreText.position.set(8, 4);
        view.addChild(scoreText);

        // Level - right
        levelText = new Text({
            text: 'LV 1',
            style: { fontFamily: 'monospace', fontSize: 16, fill: 0xffffff },
        });
        view.addChild(levelText);

        // Lives - center (small icons)
        livesContainer = new Container();
        view.addChild(livesContainer);
    }

    function refresh(): void {
        const watched = watcher.poll();

        if (watched.score.changed) {
            scoreText.text = `Score: ${watched.score.value}`;
        }
        if (watched.level.changed) {
            levelText.text = `LV ${watched.level.value}`;
            updateLevelLayout();
        }
        if (watched.lives.changed) {
            updateLives();
        }
    }

    function updateLevelLayout(): void {
        const width = bindings.cols() * bindings.tileSize();
        levelText.position.set(width - 60, 4);
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

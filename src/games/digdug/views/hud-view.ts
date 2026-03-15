import { Container, Sprite, Text, type Texture } from 'pixi.js';
import { watch } from '#common';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HudViewBindings {
    getScore(): number;
    getLives(): number;
    getLevel(): number;
    getTileSize(): number;
    getCols(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createHudView(bindings: HudViewBindings, diggerIconTexture: Texture): Container {
    const watcher = watch({
        score: bindings.getScore,
        lives: bindings.getLives,
        level: bindings.getLevel,
    });

    let scoreText: Text;
    let levelText: Text;
    let livesContainer: Container;

    const view = new Container();
    initialiseView();
    view.onRender = refresh;
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
        const width = bindings.getCols() * bindings.getTileSize();
        levelText.position.set(width - 60, 4);
        livesContainer.position.set(width / 2 - 20, 4);
    }

    function updateLives(): void {
        livesContainer.removeChildren();
        const lives = bindings.getLives();
        for (let i = 0; i < lives; i++) {
            const icon = new Sprite({ texture: diggerIconTexture });
            icon.position.set(i * 16, 0);
            livesContainer.addChild(icon);
        }
    }
}

import { Container, Graphics, Text } from 'pixi.js';
import { createWatch } from '#utils';

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

export function createHudView(bindings: HudViewBindings): Container {
    const watchScore = createWatch(bindings.getScore);
    const watchLives = createWatch(bindings.getLives);
    const watchLevel = createWatch(bindings.getLevel);

    const container = new Container();

    // Score — left
    const scoreText = new Text({
        text: 'Score: 0',
        style: { fontFamily: 'monospace', fontSize: 16, fill: 0xffffff },
    });
    scoreText.position.set(8, 4);
    container.addChild(scoreText);

    // Level — right
    const levelText = new Text({
        text: 'LV 1',
        style: { fontFamily: 'monospace', fontSize: 16, fill: 0xffffff },
    });
    container.addChild(levelText);

    // Lives — center (small icons)
    const livesContainer = new Container();
    container.addChild(livesContainer);

    updateLevelLayout();
    updateLives();

    container.onRender = refresh;
    return container;

    function refresh(): void {
        if (watchScore.changed()) {
            scoreText.text = `Score: ${watchScore.value}`;
        }
        if (watchLevel.changed()) {
            levelText.text = `LV ${watchLevel.value}`;
            updateLevelLayout();
        }
        if (watchLives.changed()) {
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
            const icon = new Graphics();
            icon.circle(i * 16, 8, 5).fill(0xffffff);
            icon.circle(i * 16, 8, 3).fill(0x4488ff);
            livesContainer.addChild(icon);
        }
    }
}

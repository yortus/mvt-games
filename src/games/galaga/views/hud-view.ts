import { Container, Sprite, Text, type Texture } from 'pixi.js';
import { createWatcher } from '#utils';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HudViewBindings {
    getScore(): number;
    getLives(): number;
    getStage(): number;
    getScreenWidth(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createHudView(bindings: HudViewBindings, shipIconTexture: Texture): Container {
    const watched = createWatcher({
        score: bindings.getScore,
        lives: bindings.getLives,
        stage: bindings.getStage,
    });

    const container = new Container();

    // Score — left
    const scoreText = new Text({
        text: 'Score: 0',
        style: { fontFamily: 'monospace', fontSize: 14, fill: 0xffffff },
    });
    scoreText.position.set(8, 6);
    container.addChild(scoreText);

    // Stage — right
    const stageText = new Text({
        text: 'Stage 1',
        style: { fontFamily: 'monospace', fontSize: 14, fill: 0xffffff },
    });
    container.addChild(stageText);

    // Lives — centre (ship icons)
    const livesContainer = new Container();
    container.addChild(livesContainer);

    updateStageLayout();
    updateLives();

    container.onRender = refresh;
    return container;

    function refresh(): void {
        watched.poll();

        if (watched.score.changed) {
            scoreText.text = `Score: ${watched.score.value}`;
        }
        if (watched.stage.changed) {
            stageText.text = `Stage ${watched.stage.value}`;
            updateStageLayout();
        }
        if (watched.lives.changed) {
            updateLives();
        }
    }

    function updateStageLayout(): void {
        const width = bindings.getScreenWidth();
        stageText.position.set(width - 72, 6);
        livesContainer.position.set(width / 2 - 20, 6);
    }

    function updateLives(): void {
        livesContainer.removeChildren();
        const lives = bindings.getLives();
        for (let i = 0; i < lives; i++) {
            const icon = new Sprite({ texture: shipIconTexture, anchor: { x: 0, y: 0 } });
            icon.position.set(i * 14, 0);
            livesContainer.addChild(icon);
        }
    }
}

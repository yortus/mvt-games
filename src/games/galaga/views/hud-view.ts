import { Container, Graphics, Text } from 'pixi.js';
import { createWatch } from '#utils';

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

export function createHudView(bindings: HudViewBindings): Container {
    const watchScore = createWatch(bindings.getScore);
    const watchLives = createWatch(bindings.getLives);
    const watchStage = createWatch(bindings.getStage);

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
        if (watchScore.changed()) {
            scoreText.text = `Score: ${watchScore.value}`;
        }
        if (watchStage.changed()) {
            stageText.text = `Stage ${watchStage.value}`;
            updateStageLayout();
        }
        if (watchLives.changed()) {
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
            const icon = new Graphics();
            // Tiny ship icon
            icon.moveTo(i * 14, 0)
                .lineTo(i * 14 + 4, 10)
                .lineTo(i * 14 - 4, 10)
                .closePath()
                .fill(0x88ccff);
            livesContainer.addChild(icon);
        }
    }
}

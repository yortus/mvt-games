import { Container, Sprite, Text, type Texture } from 'pixi.js';
import { watch } from '#utils';

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
    const watcher = watch({
        score: bindings.getScore,
        lives: bindings.getLives,
        stage: bindings.getStage,
    });

    const view = new Container();

    // Score — left
    const scoreText = new Text({
        text: 'Score: 0',
        style: { fontFamily: 'monospace', fontSize: 14, fill: 0xffffff },
    });
    scoreText.position.set(8, 6);
    view.addChild(scoreText);

    // Stage — right
    const stageText = new Text({
        text: 'Stage 1',
        style: { fontFamily: 'monospace', fontSize: 14, fill: 0xffffff },
    });
    view.addChild(stageText);

    // Lives — centre (ship icons)
    const livesContainer = new Container();
    view.addChild(livesContainer);


    view.onRender = refresh;
    return view;

    function refresh(): void {
        const watched = watcher.poll();

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

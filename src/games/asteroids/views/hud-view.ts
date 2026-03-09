import { Container, Graphics, Text } from 'pixi.js';
import { createWatch } from '#utils';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HudViewBindings {
    getScore(): number;
    getLives(): number;
    getWave(): number;
    getScreenWidth(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createHudView(bindings: HudViewBindings): Container {
    const watchScore = createWatch(bindings.getScore);
    const watchLives = createWatch(bindings.getLives);
    const watchWave = createWatch(bindings.getWave);

    const container = new Container();

    // Score — left
    const scoreText = new Text({
        text: 'Score: 0',
        style: { fontFamily: 'monospace', fontSize: 14, fill: 0xffffff },
    });
    scoreText.position.set(8, 6);
    container.addChild(scoreText);

    // Wave — right
    const waveText = new Text({
        text: 'Wave 1',
        style: { fontFamily: 'monospace', fontSize: 14, fill: 0xffffff },
    });
    container.addChild(waveText);

    // Lives — centre (ship icons)
    const livesContainer = new Container();
    container.addChild(livesContainer);

    updateWaveLayout();
    updateLives();

    container.onRender = refresh;
    return container;

    function refresh(): void {
        if (watchScore.changed()) {
            scoreText.text = `Score: ${watchScore.value}`;
        }
        if (watchWave.changed()) {
            waveText.text = `Wave ${watchWave.value}`;
            updateWaveLayout();
        }
        if (watchLives.changed()) {
            updateLives();
        }
    }

    function updateWaveLayout(): void {
        const width = bindings.getScreenWidth();
        waveText.position.set(width - 72, 6);
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

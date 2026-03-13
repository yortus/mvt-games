import { Container, Graphics, Text } from 'pixi.js';
import { createWatcher } from '#utils';

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
    const watcher = createWatcher({
        score: bindings.getScore,
        lives: bindings.getLives,
        wave: bindings.getWave,
    });

    const view = new Container();

    // Score — left
    const scoreText = new Text({
        text: 'Score: 0',
        style: { fontFamily: 'monospace', fontSize: 14, fill: 0xffffff },
    });
    scoreText.position.set(8, 6);
    view.addChild(scoreText);

    // Wave — right
    const waveText = new Text({
        text: 'Wave 1',
        style: { fontFamily: 'monospace', fontSize: 14, fill: 0xffffff },
    });
    view.addChild(waveText);

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
        if (watched.wave.changed) {
            waveText.text = `Wave ${watched.wave.value}`;
            updateWaveLayout();
        }
        if (watched.lives.changed) {
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

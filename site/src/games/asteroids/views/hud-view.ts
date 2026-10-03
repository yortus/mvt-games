import { Container, Graphics, Text } from 'pixi.js';
import { watch } from '@mvtjs/utils';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HudViewBindings {
    score: () => number;
    lives: () => number;
    wave: () => number;
    screenWidth: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function HudView(bindings: HudViewBindings): Container {
    const watcher = watch({
        score: bindings.score,
        lives: bindings.lives,
        wave: bindings.wave,
    });
    let scoreText: Text;
    let waveText: Text;
    let livesContainer: Container;

    const view = new Container();
    initialiseView();
    setRefresh(view, refresh);
    return view;

    function initialiseView(): void {
        // Score - left
        scoreText = new Text({
            text: 'Score: 0',
            style: { fontFamily: 'monospace', fontSize: 14, fill: 0xffffff },
        });
        scoreText.position.set(8, 6);
        view.addChild(scoreText);

        // Wave - right
        waveText = new Text({
            text: 'Wave 1',
            style: { fontFamily: 'monospace', fontSize: 14, fill: 0xffffff },
        });
        view.addChild(waveText);

        // Lives - centre (ship icons)
        livesContainer = new Container();
        view.addChild(livesContainer);
    }

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
        const width = bindings.screenWidth();
        waveText.position.set(width - 72, 6);
        livesContainer.position.set(width / 2 - 20, 6);
    }

    function updateLives(): void {
        livesContainer.removeChildren();
        const lives = bindings.lives();
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

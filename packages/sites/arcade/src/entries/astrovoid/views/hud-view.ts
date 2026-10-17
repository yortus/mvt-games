import { Container, Graphics } from 'pixi.js';
import { watch } from '@mvtjs/utils';
import { setRefresh } from '@mvtjs/pixi';
import { PixelTextView } from '#shared';

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
    // The text each line shows, written when its number changes
    let scoreText = 'SCORE: 0';
    let waveText = 'WAVE 1';
    let waveLine: Container;
    let livesContainer: Container;

    const view = new Container();
    initialiseView();
    setRefresh(view, refresh);
    return view;

    function initialiseView(): void {
        // Score - left
        const scoreLine = PixelTextView({ text: () => scoreText, color: TEXT_COLOR, scale: TEXT_SCALE });
        scoreLine.position.set(8, 6);
        view.addChild(scoreLine);

        // Wave - right
        waveLine = PixelTextView({ text: () => waveText, color: TEXT_COLOR, scale: TEXT_SCALE, anchorX: 1 });
        view.addChild(waveLine);

        // Lives - centre (ship icons)
        livesContainer = new Container();
        view.addChild(livesContainer);
    }

    function refresh(): void {
        const watched = watcher.poll();

        if (watched.score.changed) {
            scoreText = `SCORE: ${watched.score.value}`;
        }
        if (watched.wave.changed) {
            waveText = `WAVE ${watched.wave.value}`;
            updateWaveLayout();
        }
        if (watched.lives.changed) {
            updateLives();
        }
    }

    function updateWaveLayout(): void {
        const width = bindings.screenWidth();
        waveLine.position.set(width - 8, 6);
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

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TEXT_COLOR = 0xffffff;
/** The glyphs at twice their size: capitals 14 pixels tall. */
const TEXT_SCALE = 2;

import { Container, Graphics, type Texture } from 'pixi.js';
import { createKeyboardInputView, createOverlayView, watch } from '#common';
import type { GameModel } from '../models';
import { SCREEN_WIDTH, PLAY_HEIGHT } from '../data';
import { createShipView } from './ship-view';
import { createEnemyView, type EnemyViewTextures } from './enemy-view';
import { createBulletView } from './bullet-view';
import { createHudView } from './hud-view';

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

export interface GameViewTextures {
    readonly boss: Texture;
    readonly butterfly: Texture;
    readonly bee: Texture;
    readonly ship: Texture;
    readonly 'ship-icon': Texture;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameView(game: GameModel, textures: GameViewTextures): Container {
    const watcher = watch({
        enemyCount: () => game.enemies.length,
        pBulletCount: () => game.playerBullets.length,
        eBulletCount: () => game.enemyBullets.length,
    });

    const enemyTextures: EnemyViewTextures = {
        boss: textures.boss,
        butterfly: textures.butterfly,
        bee: textures.bee,
    };

    let enemyContainers: Container[] = [];
    let pBulletContainers: Container[] = [];
    let eBulletContainers: Container[] = [];

    const view = new Container();
    initialiseView();
    view.onRender = refresh;
    return view;

    // ---- initialiseView ----------------------------------------------------

    function initialiseView(): void {
        // Static star backdrop
        const starsGfx = new Graphics();
        view.addChild(starsGfx);
        drawStars(starsGfx, SCREEN_WIDTH, PLAY_HEIGHT);

        // Enemy views - dynamic list
        buildEnemies();

        // Player bullet views
        buildPlayerBullets();

        // Enemy bullet views
        buildEnemyBullets();

        // Ship
        const shipContainer = createShipView({
            getX: () => game.ship.x,
            getY: () => game.ship.y,
            isAlive: () => game.ship.alive,
        }, textures.ship);
        view.addChild(shipContainer);

        // HUD
        const hudContainer = createHudView({
            getScore: () => game.score.score,
            getLives: () => game.score.lives,
            getStage: () => game.score.stage,
            getScreenWidth: () => SCREEN_WIDTH,
        }, textures['ship-icon']);
        hudContainer.position.set(0, PLAY_HEIGHT);
        view.addChild(hudContainer);

        // Overlay
        const overlayView = createOverlayView({
            getWidth: () => SCREEN_WIDTH,
            getHeight: () => PLAY_HEIGHT,
            isVisible: () => game.phase === 'game-over' || game.phase === 'stage-clear',
            getText: () => game.phase === 'game-over'
                ? 'GAME OVER\n\nPress Enter to restart'
                : 'STAGE CLEAR!',
        });
        view.addChild(overlayView);

        // Keyboard input
        view.addChild(createKeyboardInputView({
            onXDirectionChanged: (dir) => { game.playerInput.direction = dir;},
            onPrimaryButtonChanged: (pressed) => { game.playerInput.firePressed = pressed; },
            onRestartButtonChanged: (pressed) => { game.playerInput.restartPressed = pressed; },
        }));
    }

    // ---- refresh -----------------------------------------------------------

    function refresh(): void {
        const watched = watcher.poll();

        if (watched.enemyCount.changed) buildEnemies();
        if (watched.pBulletCount.changed) buildPlayerBullets();
        if (watched.eBulletCount.changed) buildEnemyBullets();
    }

    // ---- builder helpers ---------------------------------------------------

    function buildEnemies(): void {
        for (let i = 0; i < enemyContainers.length; i++) {
            enemyContainers[i].destroy();
        }
        enemyContainers = [];

        const count = game.enemies.length;
        for (let i = 0; i < count; i++) {
            const idx = i;
            const c = createEnemyView({
                getX: () => game.enemies[idx].x,
                getY: () => game.enemies[idx].y,
                getKind: () => game.enemies[idx].kind,
                getPhase: () => game.enemies[idx].phase,
                isAlive: () => game.enemies[idx].alive,
            }, enemyTextures);
            view.addChild(c);
            enemyContainers.push(c);
        }
    }

    function buildPlayerBullets(): void {
        for (let i = 0; i < pBulletContainers.length; i++) {
            pBulletContainers[i].destroy();
        }
        pBulletContainers = [];

        const count = game.playerBullets.length;
        for (let i = 0; i < count; i++) {
            const idx = i;
            const c = createBulletView({
                getX: () => game.playerBullets[idx].x,
                getY: () => game.playerBullets[idx].y,
                isActive: () => game.playerBullets[idx].active,
                getColor: () => 0xffffff,
            });
            view.addChild(c);
            pBulletContainers.push(c);
        }
    }

    function buildEnemyBullets(): void {
        for (let i = 0; i < eBulletContainers.length; i++) {
            eBulletContainers[i].destroy();
        }
        eBulletContainers = [];

        const count = game.enemyBullets.length;
        for (let i = 0; i < count; i++) {
            const idx = i;
            const c = createBulletView({
                getX: () => game.enemyBullets[idx].x,
                getY: () => game.enemyBullets[idx].y,
                isActive: () => game.enemyBullets[idx].active,
                getColor: () => 0xff4444,
            });
            view.addChild(c);
            eBulletContainers.push(c);
        }
    }
}

// ---------------------------------------------------------------------------
// Static stars
// ---------------------------------------------------------------------------

function drawStars(gfx: Graphics, width: number, height: number): void {
    // Deterministic pseudo-random via simple LCG seeded at 42
    let seed = 42;
    function rand(): number {
        seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
        return seed / 0x7fffffff;
    }

    for (let i = 0; i < 50; i++) {
        const x = rand() * width;
        const y = rand() * height;
        const brightness = 0.3 + rand() * 0.7;
        const gray = (brightness * 255) | 0;
        const color = (gray << 16) | (gray << 8) | gray;
        gfx.circle(x, y, 0.5 + rand() * 0.8).fill(color);
    }
}

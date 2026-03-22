import { Container, Graphics } from 'pixi.js';
import { createKeyboardInputView, createOverlayView, watch } from '#common';
import type { GameModel } from '../models';
import { ARENA_WIDTH, ARENA_HEIGHT } from '../data';
import { createShipView } from './ship-view';
import { createAsteroidView } from './asteroid-view';
import { createBulletView } from './bullet-view';
import { createDebrisView } from './debris-view';
import { createHudView } from './hud-view';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameView(game: GameModel): Container {
    const watcher = watch({
        asteroidCount: () => game.asteroids.length,
        bulletCount: () => game.bullets.length,
    });
    let asteroidContainers: Container[] = [];
    let bulletContainers: Container[] = [];

    const view = new Container();
    initialiseView();
    view.onRender = refresh;
    return view;

    function initialiseView(): void {
        // Static star backdrop
        const starsGfx = new Graphics();
        view.addChild(starsGfx);
        drawStars(starsGfx, ARENA_WIDTH, ARENA_HEIGHT);

        // Asteroid views - dynamic list
        buildAsteroids();

        // Bullet views
        buildBullets();

        // Ship
        const shipContainer = createShipView({
            getX: () => game.ship.x,
            getY: () => game.ship.y,
            getAngle: () => game.ship.angle,
            isAlive: () => game.ship.isAlive,
            isThrusting: () => game.ship.isThrusting,
        });
        view.addChild(shipContainer);

        // Debris (rendered above ship layer)
        const debrisContainer = createDebrisView({
            getParticles: () => game.debris.particles,
            isActive: () => game.debris.isActive,
        });
        view.addChild(debrisContainer);

        // HUD
        const hudContainer = createHudView({
            getScore: () => game.score,
            getLives: () => game.lives,
            getWave: () => game.wave,
            getScreenWidth: () => ARENA_WIDTH,
        });
        hudContainer.position.set(0, ARENA_HEIGHT);
        view.addChild(hudContainer);

        // Overlay
        const overlayView = createOverlayView({
            getWidth: () => ARENA_WIDTH,
            getHeight: () => ARENA_HEIGHT,
            isVisible: () => game.phase === 'game-over' || game.phase === 'wave-clear',
            getText: () => (game.phase === 'game-over' ? 'GAME OVER\n\nPress Enter to restart' : 'WAVE CLEAR!'),
        });
        view.addChild(overlayView);

        // Keyboard input
        view.addChild(
            createKeyboardInputView({
                onXDirectionChanged: (dir) => {
                    game.playerInput.rotationDirection = dir;
                },
                onYDirectionChanged: (dir) => {
                    game.playerInput.thrustPressed = dir === 'up';
                },
                onPrimaryButtonChanged: (pressed) => {
                    game.playerInput.firePressed = pressed;
                },
                onRestartButtonChanged: (pressed) => {
                    game.playerInput.restartPressed = pressed;
                },
            }),
        );
    }

    function refresh(): void {
        const watched = watcher.poll();

        if (watched.asteroidCount.changed) buildAsteroids();
        if (watched.bulletCount.changed) buildBullets();
    }

    function buildAsteroids(): void {
        for (let i = 0; i < asteroidContainers.length; i++) {
            asteroidContainers[i].destroy();
        }
        asteroidContainers = [];

        const count = game.asteroids.length;
        for (let i = 0; i < count; i++) {
            const idx = i;
            const c = createAsteroidView({
                getX: () => game.asteroids[idx].x,
                getY: () => game.asteroids[idx].y,
                getAngle: () => game.asteroids[idx].angle,
                getSize: () => game.asteroids[idx].size,
                getRadius: () => game.asteroids[idx].radius,
                isAlive: () => game.asteroids[idx].isAlive,
                getShapeSeed: () => game.asteroids[idx].shapeSeed,
            });
            view.addChild(c);
            asteroidContainers.push(c);
        }
    }

    function buildBullets(): void {
        for (let i = 0; i < bulletContainers.length; i++) {
            bulletContainers[i].destroy();
        }
        bulletContainers = [];

        const count = game.bullets.length;
        for (let i = 0; i < count; i++) {
            const idx = i;
            const c = createBulletView({
                getX: () => game.bullets[idx].x,
                getY: () => game.bullets[idx].y,
                isActive: () => game.bullets[idx].isActive,
            });
            view.addChild(c);
            bulletContainers.push(c);
        }
    }
}

// ---------------------------------------------------------------------------
// Static stars
// ---------------------------------------------------------------------------

function drawStars(gfx: Graphics, width: number, height: number): void {
    // Deterministic pseudo-random via simple LCG seeded at 99
    let seed = 99;
    function rand(): number {
        seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
        return seed / 0x7fffffff;
    }

    for (let i = 0; i < 60; i++) {
        const x = rand() * width;
        const y = rand() * height;
        const brightness = 0.3 + rand() * 0.7;
        const gray = (brightness * 255) | 0;
        const color = (gray << 16) | (gray << 8) | gray;
        gfx.circle(x, y, 0.5 + rand() * 0.8).fill(color);
    }
}

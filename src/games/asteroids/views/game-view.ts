import { Container, Graphics } from 'pixi.js';
import { OverlayView, isTouchDevice, watch } from '#common';
import type { GameModel } from '../models';
import { ARENA_WIDTH, ARENA_HEIGHT } from '../data';
import { ShipView } from './ship-view';
import { AsteroidView } from './asteroid-view';
import { BulletView } from './bullet-view';
import { DebrisView } from './debris-view';
import { HudView } from './hud-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    model: GameModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function GameView(bindings: GameViewBindings): Container {
    const game = bindings.model;
    const watcher = watch({
        bulletCount: () => game.bullets.length,
    });
    const asteroidContainers: Container[] = [];
    let bulletContainers: Container[] = [];

    const view = new Container();
    initialiseView();
    view.onRefresh = refresh;
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
        const shipContainer = ShipView({
            x: () => game.ship.x,
            y: () => game.ship.y,
            angle: () => game.ship.angle,
            isAlive: () => game.ship.isAlive,
            isThrusting: () => game.ship.isThrusting,
        });
        view.addChild(shipContainer);

        // Debris (rendered above ship layer)
        const debrisContainer = DebrisView({
            particles: () => game.debris.particles,
            isActive: () => game.debris.isActive,
        });
        view.addChild(debrisContainer);

        // HUD
        const hudContainer = HudView({
            score: () => game.score,
            lives: () => game.lives,
            wave: () => game.wave,
            screenWidth: () => ARENA_WIDTH,
        });
        hudContainer.position.set(0, ARENA_HEIGHT);
        view.addChild(hudContainer);

        // Overlay
        const restartHint = isTouchDevice() ? 'Tap to restart' : 'Press Enter to restart';
        const overlayView = OverlayView({
            width: ARENA_WIDTH,
            height: ARENA_HEIGHT,
            isVisible: () => game.phase === 'game-over' || game.phase === 'wave-clear',
            text: () => (game.phase === 'game-over' ? `GAME OVER\n\n${restartHint}` : 'WAVE CLEAR!'),
            onRestartPressed: (pressed) => {
                game.playerInput.restartPressed = pressed;
            },
        });
        view.addChild(overlayView);
    }

    function refresh(): void {
        const watched = watcher.poll();

        // Grow the asteroid pool to cover new storage slots; existing views
        // re-read their slot each frame, so a length change rebuilds nothing.
        buildAsteroids();
        if (watched.bulletCount.changed) buildBullets();
    }

    function buildAsteroids(): void {
        while (asteroidContainers.length < game.asteroids.slots.length) {
            const idx = asteroidContainers.length;
            const c = AsteroidView({
                isPresent: () => game.asteroids.slots.at(idx) !== undefined,
                x: () => game.asteroids.slots.at(idx)?.value.x ?? 0,
                y: () => game.asteroids.slots.at(idx)?.value.y ?? 0,
                angle: () => game.asteroids.slots.at(idx)?.value.angle ?? 0,
                size: () => game.asteroids.slots.at(idx)?.value.size ?? 'large',
                radius: () => game.asteroids.slots.at(idx)?.value.radius ?? 0,
                isAlive: () => game.asteroids.slots.at(idx)?.value.isAlive ?? false,
                shapeSeed: () => game.asteroids.slots.at(idx)?.value.shapeSeed ?? -1,
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
            const c = BulletView({
                x: () => game.bullets[idx].x,
                y: () => game.bullets[idx].y,
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

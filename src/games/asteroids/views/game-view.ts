import { Container, Graphics, Text } from 'pixi.js';
import { createWatch } from '#utils';
import type {
    AsteroidSize,
    GamePhase,
    PlayerInputModel,
} from '../models';
import { createShipView } from './ship-view';
import { createAsteroidView } from './asteroid-view';
import { createBulletView } from './bullet-view';
import { createHudView } from './hud-view';
import { createKeyboardPlayerInputView } from './keyboard-player-input-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    // Screen
    getScreenWidth(): number;
    getPlayHeight(): number;
    // Ship
    getShipX(): number;
    getShipY(): number;
    getShipAngle(): number;
    isShipAlive(): boolean;
    isShipThrusting(): boolean;
    // Asteroids
    getAsteroidCount(): number;
    getAsteroidX(index: number): number;
    getAsteroidY(index: number): number;
    getAsteroidAngle(index: number): number;
    getAsteroidSize(index: number): AsteroidSize;
    getAsteroidRadius(index: number): number;
    isAsteroidAlive(index: number): boolean;
    getAsteroidShapeSeed(index: number): number;
    // Bullets
    getBulletCount(): number;
    getBulletX(index: number): number;
    getBulletY(index: number): number;
    isBulletActive(index: number): boolean;
    // HUD
    getScore(): number;
    getLives(): number;
    getWave(): number;
    // State
    getGamePhase(): GamePhase;
    // Input
    getPlayerInput(): PlayerInputModel;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameView(bindings: GameViewBindings): Container {
    const watchAsteroidCount = createWatch(bindings.getAsteroidCount);
    const watchBulletCount = createWatch(bindings.getBulletCount);
    const watchPhase = createWatch(bindings.getGamePhase);

    const container = new Container();

    // Static star backdrop
    const starsGfx = new Graphics();
    container.addChild(starsGfx);
    drawStars(starsGfx, bindings.getScreenWidth(), bindings.getPlayHeight());

    // Asteroid views — dynamic list
    let asteroidContainers: Container[] = [];
    buildAsteroids();

    // Bullet views
    let bulletContainers: Container[] = [];
    buildBullets();

    // Ship
    const shipContainer = createShipView({
        getX: bindings.getShipX,
        getY: bindings.getShipY,
        getAngle: bindings.getShipAngle,
        isAlive: bindings.isShipAlive,
        isThrusting: bindings.isShipThrusting,
    });
    container.addChild(shipContainer);

    // HUD
    const playHeight = bindings.getPlayHeight();
    const hudContainer = createHudView({
        getScore: bindings.getScore,
        getLives: bindings.getLives,
        getWave: bindings.getWave,
        getScreenWidth: bindings.getScreenWidth,
    });
    hudContainer.position.set(0, playHeight);
    container.addChild(hudContainer);

    // Overlay (game over / wave clear)
    const overlay = new Container();
    overlay.visible = false;
    const overlayBg = new Graphics();
    overlay.addChild(overlayBg);
    const overlayText = new Text({
        text: '',
        style: { fontFamily: 'monospace', fontSize: 22, fill: 0xffffff, align: 'center' },
    });
    overlayText.anchor.set(0.5);
    overlay.addChild(overlayText);
    container.addChild(overlay);

    updateOverlayLayout();

    // Keyboard input
    container.addChild(createKeyboardPlayerInputView(bindings.getPlayerInput()));

    container.onRender = refresh;
    return container;

    // ---- refresh -----------------------------------------------------------

    function refresh(): void {
        if (watchAsteroidCount.changed()) buildAsteroids();
        if (watchBulletCount.changed()) buildBullets();

        if (watchPhase.changed()) {
            const phase = watchPhase.value;
            if (phase === 'playing' || phase === 'dying') {
                overlay.visible = false;
            } else if (phase === 'game-over') {
                overlay.visible = true;
                overlayText.text = 'GAME OVER\n\nPress Enter to restart';
            } else if (phase === 'wave-clear') {
                overlay.visible = true;
                overlayText.text = 'WAVE CLEAR!';
            }
        }
    }

    // ---- layout helpers ----------------------------------------------------

    function updateOverlayLayout(): void {
        const w = bindings.getScreenWidth();
        const h = bindings.getPlayHeight();
        overlayBg.clear();
        overlayBg.rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.6 });
        overlayText.position.set(w / 2, h / 2);
    }

    // ---- builder helpers ---------------------------------------------------

    function buildAsteroids(): void {
        for (let i = 0; i < asteroidContainers.length; i++) {
            asteroidContainers[i].destroy();
        }
        asteroidContainers = [];

        const count = bindings.getAsteroidCount();
        for (let i = 0; i < count; i++) {
            const idx = i;
            const c = createAsteroidView({
                getX: () => bindings.getAsteroidX(idx),
                getY: () => bindings.getAsteroidY(idx),
                getAngle: () => bindings.getAsteroidAngle(idx),
                getSize: () => bindings.getAsteroidSize(idx),
                getRadius: () => bindings.getAsteroidRadius(idx),
                isAlive: () => bindings.isAsteroidAlive(idx),
                getShapeSeed: () => bindings.getAsteroidShapeSeed(idx),
            });
            container.addChild(c);
            asteroidContainers.push(c);
        }
    }

    function buildBullets(): void {
        for (let i = 0; i < bulletContainers.length; i++) {
            bulletContainers[i].destroy();
        }
        bulletContainers = [];

        const count = bindings.getBulletCount();
        for (let i = 0; i < count; i++) {
            const idx = i;
            const c = createBulletView({
                getX: () => bindings.getBulletX(idx),
                getY: () => bindings.getBulletY(idx),
                isActive: () => bindings.isBulletActive(idx),
            });
            container.addChild(c);
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

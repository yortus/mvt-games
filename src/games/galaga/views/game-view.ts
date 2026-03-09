import { Container, Graphics, Text } from 'pixi.js';
import { createWatch } from '#utils';
import type {
    EnemyKind,
    EnemyPhase,
    GamePhase,
    PlayerInputModel,
} from '../models';
import { createShipView } from './ship-view';
import { createEnemyView } from './enemy-view';
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
    isShipAlive(): boolean;
    // Enemies
    getEnemyCount(): number;
    getEnemyX(index: number): number;
    getEnemyY(index: number): number;
    getEnemyKind(index: number): EnemyKind;
    getEnemyPhase(index: number): EnemyPhase;
    isEnemyAlive(index: number): boolean;
    // Player Bullets
    getPlayerBulletCount(): number;
    getPlayerBulletX(index: number): number;
    getPlayerBulletY(index: number): number;
    isPlayerBulletActive(index: number): boolean;
    // Enemy Bullets
    getEnemyBulletCount(): number;
    getEnemyBulletX(index: number): number;
    getEnemyBulletY(index: number): number;
    isEnemyBulletActive(index: number): boolean;
    // HUD
    getScore(): number;
    getLives(): number;
    getStage(): number;
    // State
    getGamePhase(): GamePhase;
    // Input
    getPlayerInput(): PlayerInputModel;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameView(bindings: GameViewBindings): Container {
    const watchEnemyCount = createWatch(bindings.getEnemyCount);
    const watchPBulletCount = createWatch(bindings.getPlayerBulletCount);
    const watchEBulletCount = createWatch(bindings.getEnemyBulletCount);
    const watchPhase = createWatch(bindings.getGamePhase);

    const container = new Container();

    // Static star backdrop
    const starsGfx = new Graphics();
    container.addChild(starsGfx);
    drawStars(starsGfx, bindings.getScreenWidth(), bindings.getPlayHeight());

    // Enemy views — dynamic list
    let enemyContainers: Container[] = [];
    buildEnemies();

    // Player bullet views
    let pBulletContainers: Container[] = [];
    buildPlayerBullets();

    // Enemy bullet views
    let eBulletContainers: Container[] = [];
    buildEnemyBullets();

    // Ship
    const shipContainer = createShipView({
        getX: bindings.getShipX,
        getY: bindings.getShipY,
        isAlive: bindings.isShipAlive,
    });
    container.addChild(shipContainer);

    // HUD
    const playHeight = bindings.getPlayHeight();
    const hudContainer = createHudView({
        getScore: bindings.getScore,
        getLives: bindings.getLives,
        getStage: bindings.getStage,
        getScreenWidth: bindings.getScreenWidth,
    });
    hudContainer.position.set(0, playHeight);
    container.addChild(hudContainer);

    // Overlay (game over / stage clear)
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
        if (watchEnemyCount.changed()) buildEnemies();
        if (watchPBulletCount.changed()) buildPlayerBullets();
        if (watchEBulletCount.changed()) buildEnemyBullets();

        if (watchPhase.changed()) {
            const phase = watchPhase.value;
            if (phase === 'playing' || phase === 'dying') {
                overlay.visible = false;
            } else if (phase === 'game-over') {
                overlay.visible = true;
                overlayText.text = 'GAME OVER\n\nPress Enter to restart';
            } else if (phase === 'stage-clear') {
                overlay.visible = true;
                overlayText.text = 'STAGE CLEAR!';
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

    function buildEnemies(): void {
        for (let i = 0; i < enemyContainers.length; i++) {
            enemyContainers[i].destroy();
        }
        enemyContainers = [];

        const count = bindings.getEnemyCount();
        for (let i = 0; i < count; i++) {
            const idx = i;
            const c = createEnemyView({
                getX: () => bindings.getEnemyX(idx),
                getY: () => bindings.getEnemyY(idx),
                getKind: () => bindings.getEnemyKind(idx),
                getPhase: () => bindings.getEnemyPhase(idx),
                isAlive: () => bindings.isEnemyAlive(idx),
            });
            container.addChild(c);
            enemyContainers.push(c);
        }
    }

    function buildPlayerBullets(): void {
        for (let i = 0; i < pBulletContainers.length; i++) {
            pBulletContainers[i].destroy();
        }
        pBulletContainers = [];

        const count = bindings.getPlayerBulletCount();
        for (let i = 0; i < count; i++) {
            const idx = i;
            const c = createBulletView({
                getX: () => bindings.getPlayerBulletX(idx),
                getY: () => bindings.getPlayerBulletY(idx),
                isActive: () => bindings.isPlayerBulletActive(idx),
                getColor: () => 0xffffff,
            });
            container.addChild(c);
            pBulletContainers.push(c);
        }
    }

    function buildEnemyBullets(): void {
        for (let i = 0; i < eBulletContainers.length; i++) {
            eBulletContainers[i].destroy();
        }
        eBulletContainers = [];

        const count = bindings.getEnemyBulletCount();
        for (let i = 0; i < count; i++) {
            const idx = i;
            const c = createBulletView({
                getX: () => bindings.getEnemyBulletX(idx),
                getY: () => bindings.getEnemyBulletY(idx),
                isActive: () => bindings.isEnemyBulletActive(idx),
                getColor: () => 0xff4444,
            });
            container.addChild(c);
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

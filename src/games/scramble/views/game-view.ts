import { Container, Graphics } from 'pixi.js';
import { createOverlayView, isTouchDevice, type StatefulPixiView } from '#common';
import type { GameModel } from '../models';
import { VISIBLE_COLS, VISIBLE_ROWS } from '../data';
import { TILE_SIZE, SCREEN_WIDTH, PLAY_HEIGHT } from './view-constants';
import { createTerrainView } from './terrain-view';
import { createShipView } from './ship-view';
import { createBulletView } from './bullet-view';
import { createBombView } from './bomb-view';
import { createRocketView } from './rocket-view';
import { createUfoView } from './ufo-view';
import { createFuelTankView } from './fuel-tank-view';
import { createExplosionView } from './explosion-view';
import { createSectionAnnouncementView } from './section-announcement-view';
import { createDeathFlashView } from './death-flash-view';
import { createBaseAlertView } from './base-alert-view';
import { createBaseTargetView } from './base-target-view';
import { createHudView } from './hud-view';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameView(game: GameModel): StatefulPixiView {
    const bulletContainers: Container[] = [];
    const bombContainers: Container[] = [];
    const rocketContainers: Container[] = [];
    const ufoContainers: Container[] = [];
    const fuelTankContainers: Container[] = [];
    const explosionContainers: Container[] = [];
    let deathFlashView: StatefulPixiView;
    let sectionAnnouncementView: StatefulPixiView;
    const view = new Container();

    initialiseView();
    return Object.assign(view, { update });

    // ---- initialiseView ----------------------------------------------------

    function initialiseView(): void {
        // Masked play area - clips all game content to the visible screen
        const playArea = new Container();
        const playMask = new Graphics();
        playMask.rect(0, 0, SCREEN_WIDTH, PLAY_HEIGHT).fill(0xffffff);
        playArea.addChild(playMask);
        playArea.mask = playMask;
        view.addChild(playArea);

        // Terrain (handles its own scroll positioning)
        playArea.addChild(
            createTerrainView({
                getScrollCol: () => game.scrollCol,
                getVisibleCols: () => VISIBLE_COLS,
                getVisibleRows: () => VISIBLE_ROWS,
                getTileSize: () => TILE_SIZE,
                isSolid: (col, row) => game.terrain.isSolid(col, row),
                getSectionIndex: (col) => game.terrain.getSectionIndex(col),
            }),
        );

        // Ship
        playArea.addChild(
            createShipView({
                getScreenX: () => (game.ship.worldCol - game.scrollCol) * TILE_SIZE,
                getScreenY: () => game.ship.worldRow * TILE_SIZE,
                isAlive: () => game.ship.isAlive,
            }),
        );

        // Bullet views (fixed pool)
        for (let i = 0; i < game.bullets.length; i++) {
            const idx = i;
            const c = createBulletView({
                getScreenX: () => (game.bullets[idx].worldCol - game.scrollCol) * TILE_SIZE,
                getScreenY: () => game.bullets[idx].worldRow * TILE_SIZE,
                isActive: () => game.bullets[idx].isActive,
            });
            playArea.addChild(c);
            bulletContainers.push(c);
        }

        // Bomb views (fixed pool)
        for (let i = 0; i < game.bombs.length; i++) {
            const idx = i;
            const c = createBombView({
                getScreenX: () => (game.bombs[idx].worldCol - game.scrollCol) * TILE_SIZE,
                getScreenY: () => game.bombs[idx].worldRow * TILE_SIZE,
                isActive: () => game.bombs[idx].isActive,
            });
            playArea.addChild(c);
            bombContainers.push(c);
        }

        // Rocket views (fixed pool)
        for (let i = 0; i < game.rockets.length; i++) {
            const idx = i;
            const c = createRocketView({
                getScreenX: () => (game.rockets[idx].worldCol - game.scrollCol) * TILE_SIZE,
                getScreenY: () => game.rockets[idx].worldRow * TILE_SIZE,
                isActive: () => game.rockets[idx].isActive,
                isAlive: () => game.rockets[idx].isAlive,
                getPhase: () => game.rockets[idx].phase,
            });
            playArea.addChild(c);
            rocketContainers.push(c);
        }

        // UFO views (fixed pool)
        for (let i = 0; i < game.ufos.length; i++) {
            const idx = i;
            const c = createUfoView({
                getScreenX: () => (game.ufos[idx].worldCol - game.scrollCol) * TILE_SIZE,
                getScreenY: () => game.ufos[idx].worldRow * TILE_SIZE,
                isActive: () => game.ufos[idx].isActive,
                isAlive: () => game.ufos[idx].isAlive,
            });
            playArea.addChild(c);
            ufoContainers.push(c);
        }

        // Fuel tank views (fixed pool)
        for (let i = 0; i < game.fuelTanks.length; i++) {
            const idx = i;
            const c = createFuelTankView({
                getScreenX: () => (game.fuelTanks[idx].worldCol - game.scrollCol) * TILE_SIZE,
                getScreenY: () => game.fuelTanks[idx].worldRow * TILE_SIZE,
                isActive: () => game.fuelTanks[idx].isActive,
                isAlive: () => game.fuelTanks[idx].isAlive,
            });
            playArea.addChild(c);
            fuelTankContainers.push(c);
        }

        // Base target (large distinct structure at end of section 3)
        playArea.addChild(
            createBaseTargetView({
                getScreenX: () => (game.baseWorldCol - game.scrollCol) * TILE_SIZE,
                getScreenY: () => game.baseWorldRow * TILE_SIZE,
                isBaseAlive: () => game.isBaseAlive,
                getTileSize: () => TILE_SIZE,
            }),
        );

        // Explosion views (fixed pool)
        for (let i = 0; i < game.explosions.length; i++) {
            const idx = i;
            const c = createExplosionView({
                getScreenX: () => (game.explosions[idx].worldCol - game.scrollCol) * TILE_SIZE,
                getScreenY: () => game.explosions[idx].worldRow * TILE_SIZE,
                isActive: () => game.explosions[idx].isActive,
                getProgress: () => game.explosions[idx].progress,
            });
            playArea.addChild(c);
            explosionContainers.push(c);
        }

        // HUD
        const hudContainer = createHudView({
            getScore: () => game.score,
            getLives: () => game.lives,
            getFuel: () => game.fuel.fuel,
            getSectionIndex: () => game.sectionIndex,
            getLoop: () => game.loop,
            getScreenWidth: () => SCREEN_WIDTH,
        });
        hudContainer.position.set(0, PLAY_HEIGHT);
        view.addChild(hudContainer);

        // Overlay (section clear + game over)
        const restartHint = isTouchDevice() ? 'Tap to restart' : 'Press Enter to restart';
        view.addChild(
            createOverlayView({
                getWidth: () => SCREEN_WIDTH,
                getHeight: () => PLAY_HEIGHT,
                getVisible: () => game.phase === 'game-over' || game.phase === 'section-clear',
                getText: () => {
                    if (game.phase === 'section-clear') return 'SECTION CLEAR!';
                    return `GAME OVER\n\n${restartHint}`;
                },
                onRestartPressed: (pressed) => {
                    game.playerInput.restartPressed = pressed;
                },
            }),
        );

        // Section announcement (shows section name on entry)
        sectionAnnouncementView = createSectionAnnouncementView({
            getScreenWidth: () => SCREEN_WIDTH,
            getScreenHeight: () => PLAY_HEIGHT,
            getSectionIndex: () => game.sectionIndex,
        });
        view.addChild(sectionAnnouncementView);

        // Death flash (white flash on ship death)
        deathFlashView = createDeathFlashView({
            getScreenWidth: () => SCREEN_WIDTH,
            getScreenHeight: () => PLAY_HEIGHT,
            isDying: () => game.phase === 'dying',
        });
        view.addChild(deathFlashView);

        // Base alert (flashing "DESTROY THE BASE!" when scroll is clamped)
        view.addChild(
            createBaseAlertView({
                isScrollClamped: () => game.isScrollClamped,
                isBaseAlive: () => game.isBaseAlive,
                getScreenWidth: () => SCREEN_WIDTH,
                getScreenHeight: () => PLAY_HEIGHT,
            }),
        );
    }

    // ---- Update presentation state ----------------------------------------------------
    function update(deltaMs: number): void {
        deathFlashView.update(deltaMs);
        sectionAnnouncementView.update(deltaMs);
    }
}

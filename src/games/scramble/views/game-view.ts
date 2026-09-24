import { Container, Graphics } from 'pixi.js';
import { createOverlayView, isTouchDevice } from '#common';
import {
    type GameModel,
    MAX_BULLETS,
    MAX_BOMBS,
    MAX_ROCKETS,
    MAX_UFOS,
    MAX_FUEL_TANKS,
    MAX_EXPLOSIONS,
} from '../models';
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

export function createGameView(game: GameModel): Container {
    const view = new Container();

    initialiseView();
    return view;

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

        // Bullet views (fixed pool over the bullet SlotList's storage slots)
        for (let i = 0; i < MAX_BULLETS; i++) {
            const idx = i;
            playArea.addChild(createBulletView({
                getScreenX: () => ((game.bullets.slots.at(idx)?.value.worldCol ?? 0) - game.scrollCol) * TILE_SIZE,
                getScreenY: () => (game.bullets.slots.at(idx)?.value.worldRow ?? 0) * TILE_SIZE,
                isPresent: () => game.bullets.slots.at(idx) !== undefined,
            }));
        }

        // Bomb views (fixed pool over the bomb SlotList's storage slots)
        for (let i = 0; i < MAX_BOMBS; i++) {
            const idx = i;
            playArea.addChild(createBombView({
                getScreenX: () => ((game.bombs.slots.at(idx)?.value.worldCol ?? 0) - game.scrollCol) * TILE_SIZE,
                getScreenY: () => (game.bombs.slots.at(idx)?.value.worldRow ?? 0) * TILE_SIZE,
                isPresent: () => game.bombs.slots.at(idx) !== undefined,
            }));
        }

        // Rocket views (fixed pool over the rocket SlotList's storage slots)
        for (let i = 0; i < MAX_ROCKETS; i++) {
            const idx = i;
            playArea.addChild(createRocketView({
                getScreenX: () => ((game.rockets.slots.at(idx)?.value.worldCol ?? 0) - game.scrollCol) * TILE_SIZE,
                getScreenY: () => (game.rockets.slots.at(idx)?.value.worldRow ?? 0) * TILE_SIZE,
                isPresent: () => game.rockets.slots.at(idx) !== undefined,
                getPhase: () => game.rockets.slots.at(idx)?.value.phase ?? 'idle',
            }));
        }

        // UFO views (fixed pool over the UFO SlotList's storage slots)
        for (let i = 0; i < MAX_UFOS; i++) {
            const idx = i;
            playArea.addChild(createUfoView({
                getScreenX: () => ((game.ufos.slots.at(idx)?.value.worldCol ?? 0) - game.scrollCol) * TILE_SIZE,
                getScreenY: () => (game.ufos.slots.at(idx)?.value.worldRow ?? 0) * TILE_SIZE,
                isPresent: () => game.ufos.slots.at(idx) !== undefined,
            }));
        }

        // Fuel tank views (fixed pool over the fuel-tank SlotList's storage slots)
        for (let i = 0; i < MAX_FUEL_TANKS; i++) {
            const idx = i;
            playArea.addChild(createFuelTankView({
                getScreenX: () => ((game.fuelTanks.slots.at(idx)?.value.worldCol ?? 0) - game.scrollCol) * TILE_SIZE,
                getScreenY: () => (game.fuelTanks.slots.at(idx)?.value.worldRow ?? 0) * TILE_SIZE,
                isPresent: () => game.fuelTanks.slots.at(idx) !== undefined,
            }));
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

        // Explosion views (fixed pool over the explosion SlotList's storage slots)
        for (let i = 0; i < MAX_EXPLOSIONS; i++) {
            const idx = i;
            playArea.addChild(createExplosionView({
                getScreenX: () => ((game.explosions.slots.at(idx)?.value.worldCol ?? 0) - game.scrollCol) * TILE_SIZE,
                getScreenY: () => (game.explosions.slots.at(idx)?.value.worldRow ?? 0) * TILE_SIZE,
                isPresent: () => game.explosions.slots.at(idx) !== undefined,
                getProgress: () => game.explosions.slots.at(idx)?.value.progress ?? 0,
            }));
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
        view.addChild(
            createSectionAnnouncementView({
                getScreenWidth: () => SCREEN_WIDTH,
                getScreenHeight: () => PLAY_HEIGHT,
                getSectionIndex: () => game.sectionIndex,
            }),
        );

        // Death flash (white flash on ship death)
        view.addChild(
            createDeathFlashView({
                getScreenWidth: () => SCREEN_WIDTH,
                getScreenHeight: () => PLAY_HEIGHT,
                isDying: () => game.phase === 'dying',
            }),
        );

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
}

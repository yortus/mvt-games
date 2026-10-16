/** @jsxImportSource @mvtjs/pixi */

import { type Container, Graphics } from 'pixi.js';
import { isTouchDevice, OverlayView } from '#shared';
import { List } from '@mvtjs/pixi';
import type { Audio80 } from '@mvtjs/audio';
import type { GameModel } from '../models';
import { VISIBLE_COLS, VISIBLE_ROWS } from '../data';
import { TILE_SIZE, SCREEN_WIDTH, PLAY_HEIGHT } from './view-constants';
import { TerrainView } from './terrain-view';
import { ShipView } from './ship-view';
import { BulletView } from './bullet-view';
import { BombView } from './bomb-view';
import { RocketView } from './rocket-view';
import { UfoView } from './ufo-view';
import { FuelTankView } from './fuel-tank-view';
import { ExplosionView } from './explosion-view';
import { SectionAnnouncementView } from './section-announcement-view';
import { DeathFlashView } from './death-flash-view';
import { BaseAlertView } from './base-alert-view';
import { BaseTargetView } from './base-target-view';
import { HudView } from './hud-view';
import { GameAudioView } from './game-audio-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    model: GameModel;
    /** The chip the game's audio view plays on. It is the view's output, not model state, so it is read once. */
    sound: Audio80;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The whole game: the play area, clipped to the screen, then the HUD below it
 * and the overlays above. The top-level view, so it takes the model itself.
 * Each pool of game objects is a `<List>` over the model's `SlotList`, whose
 * empty slots hide themselves.
 */
export function GameView(bindings: GameViewBindings): Container {
    const { model, sound } = bindings;
    const gameOverText = `GAME OVER\n\n${isTouchDevice() ? 'Tap to restart' : 'Press Enter to restart'}`;
    const playMask = new Graphics().rect(0, 0, SCREEN_WIDTH, PLAY_HEIGHT).fill(0xffffff);

    return (
        <container>
            <GameAudioView
                sound={sound}
                phase={() => model.phase}
                shotsFired={() => model.shotsFired}
                bombsDropped={() => model.bombsDropped}
                rocketsLaunched={() => model.rocketsLaunched}
                enemiesDestroyed={() => model.enemiesDestroyed}
                fuelTanksDestroyed={() => model.fuelTanksDestroyed}
                basesDestroyed={() => model.basesDestroyed}
                fuel={() => model.fuel.fuel}
                saucersFlying={() => model.ufos.liveCount}
                isWaitingAtBase={() => model.isScrollClamped && model.isBaseAlive}
            />
            {/* Masked play area - clips all game content to the visible screen */}
            <container ref={(c) => { c.mask = playMask; }}>
                {playMask}
                <TerrainView
                    scrollCol={() => model.scrollCol}
                    visibleCols={VISIBLE_COLS}
                    visibleRows={VISIBLE_ROWS}
                    tileSize={TILE_SIZE}
                    isSolidAt={(col, row) => model.terrain.isSolid(col, row)}
                    sectionIndexAt={(col) => model.terrain.getSectionIndex(col)}
                />
                <ShipView
                    screenX={() => toScreenX(model.ship.worldCol)}
                    screenY={() => model.ship.worldRow * TILE_SIZE}
                    isAlive={() => model.ship.isAlive}
                />
                <List items={model.bullets.slots}>
                    {(slot) => (
                        <BulletView
                            screenX={() => toScreenX(slot().value.worldCol)}
                            screenY={() => slot().value.worldRow * TILE_SIZE}
                        />
                    )}
                </List>
                <List items={model.bombs.slots}>
                    {(slot) => (
                        <BombView
                            screenX={() => toScreenX(slot().value.worldCol)}
                            screenY={() => slot().value.worldRow * TILE_SIZE}
                        />
                    )}
                </List>
                <List items={model.rockets.slots}>
                    {(slot) => (
                        <RocketView
                            screenX={() => toScreenX(slot().value.worldCol)}
                            screenY={() => slot().value.worldRow * TILE_SIZE}
                            phase={() => slot().value.phase}
                        />
                    )}
                </List>
                <List items={model.ufos.slots}>
                    {(slot) => (
                        <UfoView
                            screenX={() => toScreenX(slot().value.worldCol)}
                            screenY={() => slot().value.worldRow * TILE_SIZE}
                        />
                    )}
                </List>
                <List items={model.fuelTanks.slots}>
                    {(slot) => (
                        <FuelTankView
                            screenX={() => toScreenX(slot().value.worldCol)}
                            screenY={() => slot().value.worldRow * TILE_SIZE}
                        />
                    )}
                </List>
                {/* The base: a large, distinct structure at the end of section 3 */}
                <BaseTargetView
                    screenX={() => toScreenX(model.baseWorldCol)}
                    screenY={() => model.baseWorldRow * TILE_SIZE}
                    isBaseAlive={() => model.isBaseAlive}
                    tileSize={TILE_SIZE}
                />
                <List items={model.explosions.slots}>
                    {(slot) => (
                        <ExplosionView
                            screenX={() => toScreenX(slot().value.worldCol)}
                            screenY={() => slot().value.worldRow * TILE_SIZE}
                            progress={() => slot().value.progress}
                        />
                    )}
                </List>
            </container>

            <container y={PLAY_HEIGHT}>
                <HudView
                    score={() => model.score}
                    lives={() => model.lives}
                    fuel={() => model.fuel.fuel}
                    sectionIndex={() => model.sectionIndex}
                    loop={() => model.loop}
                    screenWidth={SCREEN_WIDTH}
                />
            </container>

            {/* Section clear and game over */}
            <OverlayView
                width={SCREEN_WIDTH}
                height={PLAY_HEIGHT}
                isVisible={() => model.phase === 'game-over' || model.phase === 'section-clear'}
                text={() => (model.phase === 'section-clear' ? 'SECTION CLEAR!' : gameOverText)}
                onRestartPressed={(pressed) => { model.playerInput.restartPressed = pressed; }}
            />

            <SectionAnnouncementView
                screenWidth={SCREEN_WIDTH}
                screenHeight={PLAY_HEIGHT}
                sectionIndex={() => model.sectionIndex}
            />
            <DeathFlashView width={SCREEN_WIDTH} height={PLAY_HEIGHT} isDying={() => model.phase === 'dying'} />
            {/* Flashes "DESTROY THE BASE!" while the scroll is held at the base */}
            <BaseAlertView
                isScrollClamped={() => model.isScrollClamped}
                isBaseAlive={() => model.isBaseAlive}
                screenWidth={SCREEN_WIDTH}
                screenHeight={PLAY_HEIGHT}
            />
        </container>
    );

    /** A world column's x on screen, given how far the terrain has scrolled. */
    function toScreenX(worldCol: number): number {
        return (worldCol - model.scrollCol) * TILE_SIZE;
    }
}

/** @jsxImportSource @mvtjs/pixi */

import { type Container, Graphics } from 'pixi.js';
import { memoiseLast } from '@mvtjs/utils';
import { List } from '@mvtjs/pixi';
import { isTouchDevice, OverlayView } from '#shared';
import { textures } from '../data';
import type { GameModel, GamePhase } from '../models';
import { BombFlashView } from './bomb-flash-view';
import { BossHealthView } from './boss-health-view';
import { BossView } from './boss-view';
import { BulletLayerView } from './bullet-layer-view';
import { CityView } from './city-view';
import { EnemyView } from './enemy-view';
import { ExplosionView } from './explosion-view';
import { HitboxView } from './hitbox-view';
import { HudView } from './hud-view';
import { ItemView } from './item-view';
import { RainView } from './rain-view';
import { TrafficView } from './traffic-view';
import { ShipView } from './ship-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './view-constants';
import { WarningView } from './warning-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    model: GameModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The whole game. The top-level view, so it takes the model itself and wires
 * each leaf view's bindings to it.
 *
 * Layered back to front: the city, its traffic and the rain; everything flying; then the
 * enemy bullets above every enemy, so none is ever hidden; then the hitbox,
 * the HUD and the overlays. Each pool of game objects is a `<List>` over the
 * model's slot list. The three bullet fields are far larger, so each is one
 * `BulletLayerView`, reading its field by index.
 */
export function GameView(bindings: GameViewBindings): Container {
    const { model } = bindings;
    const { scoring, ship, boss, stage, enemyBullets, playerShots, gems } = model;
    const tex = textures.get();
    const arenaMask = new Graphics().rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill(0xffffff);
    const overlayText = memoiseLast((phase: GamePhase) => describePhase(phase, model.tallyBonus));

    return (
        <container>
            {/* The arena, clipped to the screen and shaken by bombs and the boss's death */}
            <container mask={arenaMask}>
                {arenaMask}
                <container x={() => shakeX(model)} y={() => shakeY(model)}>
                    <CityView
                        scrollY={() => stage.scrollY}
                        timeMs={() => stage.timeMs}
                        width={SCREEN_WIDTH}
                        height={SCREEN_HEIGHT}
                    />
                    <TrafficView scrollY={() => stage.scrollY} timeMs={() => stage.timeMs} height={SCREEN_HEIGHT} />
                    <List items={model.groundEnemies.slots}>
                        {(slot) => (
                            <EnemyView
                                texture={() => tex.enemy[slot().value.kind]}
                                x={() => slot().value.x}
                                y={() => slot().value.y}
                                msSinceHit={() => slot().value.msSinceHit}
                                hasShadow={false}
                            />
                        )}
                    </List>
                    <RainView timeMs={() => stage.timeMs} width={SCREEN_WIDTH} height={SCREEN_HEIGHT} />

                    {/*
                      * Each field's own methods are the layer's query bindings, passed
                      * as they are: no wrapping closure, at thousands of reads a frame.
                      */}
                    <BulletLayerView
                        capacity={gems.capacity}
                        textures={{ gem: tex.gem }}
                        width={SCREEN_WIDTH}
                        height={SCREEN_HEIGHT}
                        count={() => gems.count}
                        xAt={gems.xOf}
                        yAt={gems.yOf}
                        kindAt={gemKind}
                    />
                    <BulletLayerView
                        capacity={playerShots.capacity}
                        textures={tex.shot}
                        width={SCREEN_WIDTH}
                        height={SCREEN_HEIGHT}
                        alpha={0.55}
                        count={() => playerShots.count}
                        xAt={playerShots.xOf}
                        yAt={playerShots.yOf}
                        kindAt={playerShots.kindOf}
                        angleAt={playerShots.angleOf}
                    />

                    <List items={model.airEnemies.slots}>
                        {(slot) => (
                            <EnemyView
                                texture={() => tex.enemy[slot().value.kind]}
                                x={() => slot().value.x}
                                y={() => slot().value.y}
                                msSinceHit={() => slot().value.msSinceHit}
                                hasShadow
                            />
                        )}
                    </List>
                    <BossView
                        x={() => boss.x}
                        y={() => boss.y}
                        isShown={() => boss.phase !== 'absent' && boss.phase !== 'defeated'}
                        isExploding={() => boss.phase === 'exploding'}
                        attackIndex={() => boss.attackIndex}
                        msSinceHit={() => boss.msSinceHit}
                        stepCount={() => model.stepCount}
                    />
                    <List items={model.items.slots}>
                        {(slot) => (
                            <ItemView
                                kind={() => slot().value.kind}
                                x={() => slot().value.x}
                                y={() => slot().value.y}
                                ageMs={() => slot().value.ageMs}
                            />
                        )}
                    </List>
                    <ShipView
                        x={() => ship.x}
                        y={() => ship.y}
                        isAlive={() => ship.isAlive}
                        invulnerableMs={() => ship.invulnerableMs}
                        stepCount={() => model.stepCount}
                    />
                    <List items={model.explosions.slots}>
                        {(slot) => (
                            <ExplosionView
                                size={() => slot().value.size}
                                x={() => slot().value.x}
                                y={() => slot().value.y}
                                progress={() => slot().value.progress}
                            />
                        )}
                    </List>

                    <BulletLayerView
                        capacity={enemyBullets.capacity}
                        textures={tex.bullet}
                        width={SCREEN_WIDTH}
                        height={SCREEN_HEIGHT}
                        count={() => enemyBullets.count}
                        xAt={enemyBullets.xOf}
                        yAt={enemyBullets.yOf}
                        kindAt={enemyBullets.kindOf}
                        angleAt={enemyBullets.angleOf}
                        ageAt={enemyBullets.ageOf}
                    />
                    <HitboxView
                        x={() => ship.x}
                        y={() => ship.y}
                        isShown={() => ship.isFocused}
                        radius={ship.hitRadius}
                    />
                    <BombFlashView
                        isBombing={() => model.isBombing}
                        elapsedMs={() => model.bombElapsedMs}
                        x={() => ship.x}
                        y={() => ship.y}
                        width={SCREEN_WIDTH}
                        height={SCREEN_HEIGHT}
                    />
                </container>
            </container>

            <BossHealthView
                isShown={() => boss.phase === 'attacking'}
                healthFraction={() => boss.healthFraction}
                attacksLeft={() => boss.attackCount - boss.attackIndex - 1}
                timeLeftMs={() => boss.attackTimeLeftMs}
                width={SCREEN_WIDTH}
            />
            <HudView
                score={() => scoring.score}
                highScore={() => scoring.highScore}
                lives={() => model.lives}
                bombs={() => model.bombs}
                chain={() => scoring.chain}
                chainFraction={() => scoring.chainFraction}
                grazeCount={() => scoring.grazeCount}
                loop={() => model.loop}
                width={SCREEN_WIDTH}
                height={SCREEN_HEIGHT}
            />
            <WarningView elapsedMs={() => model.warningElapsedMs} width={SCREEN_WIDTH} height={SCREEN_HEIGHT} />
            <OverlayView
                width={SCREEN_WIDTH}
                height={SCREEN_HEIGHT}
                isVisible={() => model.phase === 'tally' || model.phase === 'game-over' || model.phase === 'all-clear'}
                text={() => overlayText(model.phase)}
                onRestartPressed={(pressed) => { model.playerInput.restartPressed = pressed; }}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const RESTART_PROMPT = isTouchDevice() ? 'Tap to play again' : 'Press Enter to play again';

function describePhase(phase: GamePhase, tallyBonus: number): string {
    switch (phase) {
        case 'tally': return `STAGE CLEAR\n\nBOMB BONUS ${tallyBonus}`;
        case 'game-over': return `GAME OVER\n\n${RESTART_PROMPT}`;
        case 'all-clear': return `ALL CLEAR!\n\nThe storm is over.\n\n${RESTART_PROMPT}`;
        default: return '';
    }
}

/** Gems are all one kind, so their layer has one texture. */
function gemKind(): 'gem' {
    return 'gem';
}

/** How hard the arena shakes: while a bomb goes off, and while the boss explodes. */
function shakeAmount(model: GameModel): number {
    if (model.boss.phase === 'exploding') return 3;
    if (model.isBombing) return Math.max(0, 3 * (1 - model.bombElapsedMs / 600));
    return 0;
}

// Whole pixels, so the pixel art stays crisp; driven by the step count, so a
// replay shakes the same way.
function shakeX(model: GameModel): number {
    return Math.round(Math.sin(model.stepCount * 2.1) * shakeAmount(model));
}

function shakeY(model: GameModel): number {
    return Math.round(Math.cos(model.stepCount * 1.7) * shakeAmount(model));
}

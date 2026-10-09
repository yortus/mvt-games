/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { isTouchDevice, OverlayView } from '#shared';
import { List } from '@mvtjs/pixi';
import type { Audio80 } from '@mvtjs/audio';
import { FIELD_ROWS, FIELD_COLS, DEPTH_LAYERS } from '../data';
import { TILE_SIZE } from './view-constants';
import type { GameModel } from '../models';
import { FieldView } from './field-view';
import { DiggerView } from './digger-view';
import { EnemyView } from './enemy-view';
import { RockView } from './rock-view';
import { HudView } from './hud-view';
import { EnemyAudioView } from './enemy-audio-view';
import { GameAudioView } from './game-audio-view';
import { RockAudioView } from './rock-audio-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    model: GameModel;
    /** The chip the game's audio views play on. It is an output, so it is read once. */
    sound: Audio80;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The whole game: the field, the digger, the enemies and the rocks, then the
 * HUD below and the overlay above. The enemies and rocks are each a `<List>`,
 * whose item views are reused as the collection changes.
 */
export function GameView(bindings: GameViewBindings): Container {
    const { model, sound } = bindings;
    const canvasW = FIELD_COLS * TILE_SIZE;
    const canvasH = FIELD_ROWS * TILE_SIZE;
    const restartHint = isTouchDevice() ? 'Tap to restart' : 'Press Enter to restart';
    const gameOverText = `GAME OVER\n\n${restartHint}`;

    return (
        <container>
            <GameAudioView
                sound={sound}
                phase={() => model.phase}
                isDiggerMoving={() => model.digger.isMoving}
                harpoonShots={() => model.digger.harpoonShots}
                isEnemyFleeing={isEnemyFleeing}
            />
            <FieldView
                tileSize={() => TILE_SIZE}
                rows={() => FIELD_ROWS}
                cols={() => FIELD_COLS}
                tileKindAt={(r, c) => model.field.tileAt(r, c)}
                depthLayers={() => DEPTH_LAYERS}
                tunnelCount={() => model.field.tunnelCount}
                gamePhase={() => model.phase}
            />
            <DiggerView
                row={() => model.digger.row}
                col={() => model.digger.col}
                direction={() => model.digger.direction}
                isAlive={() => model.digger.isAlive}
                isHarpoonExtended={() => model.digger.isHarpoonExtended}
                harpoonDistance={() => model.digger.harpoonDistance}
                tileSize={() => TILE_SIZE}
            />
            <List items={() => model.enemies}>
                {(enemy) => (
                    <container>
                        <EnemyView
                            row={() => enemy().row}
                            col={() => enemy().col}
                            kind={() => enemy().kind}
                            phase={() => enemy().phase}
                            inflationStage={() => enemy().inflationStage}
                            direction={() => enemy().direction}
                            isFireActive={() => enemy().isFireActive}
                            isFireTelegraph={() => enemy().isFireTelegraph}
                            tileSize={() => TILE_SIZE}
                        />
                        <EnemyAudioView
                            sound={sound}
                            phase={() => enemy().phase}
                            inflationStage={() => enemy().inflationStage}
                            hasEscaped={() => enemy().hasEscaped}
                            isFireTelegraph={() => enemy().isFireTelegraph}
                            isFireActive={() => enemy().isFireActive}
                        />
                    </container>
                )}
            </List>
            <List items={() => model.rocks}>
                {(rock) => (
                    <container>
                        <RockView
                            col={() => rock().smoothCol}
                            row={() => rock().smoothRow}
                            phase={() => rock().phase}
                            isAlive={() => rock().isAlive}
                            tileSize={() => TILE_SIZE}
                        />
                        <RockAudioView sound={sound} phase={() => rock().phase} />
                    </container>
                )}
            </List>
            <container y={canvasH}>
                <HudView
                    score={() => model.score}
                    lives={() => model.lives}
                    level={() => model.level}
                    tileSize={() => TILE_SIZE}
                    cols={() => FIELD_COLS}
                />
            </container>
            <OverlayView
                width={canvasW}
                height={canvasH}
                isVisible={() => model.phase === 'game-over' || model.phase === 'level-clear'}
                text={() => (model.phase === 'game-over' ? gameOverText : 'LEVEL CLEAR!')}
                onRestartPressed={(pressed) => { model.playerInput.restartPressed = pressed; }}
            />
        </container>
    );

    function isEnemyFleeing(): boolean {
        const enemies = model.enemies;
        for (let i = 0; i < enemies.length; i++) if (enemies[i].isFleeing) return true;
        return false;
    }
}

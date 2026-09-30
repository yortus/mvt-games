/** @jsxImportSource #pixi-mvt/jsx */

import type { Container } from 'pixi.js';
import { isTouchDevice, OverlayView } from '#common';
import { List } from '#pixi-mvt/jsx';
import { FIELD_ROWS, FIELD_COLS, DEPTH_LAYERS } from '../data';
import { TILE_SIZE } from './view-constants';
import type { GameModel } from '../models';
import { FieldView } from './field-view';
import { DiggerView } from './digger-view';
import { EnemyView } from './enemy-view';
import { RockView } from './rock-view';
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

/**
 * The whole game: the field, the digger, the enemies and the rocks, then the
 * HUD below and the overlay above. The enemies and rocks are each a `<List>`,
 * whose item views are reused as the collection changes.
 */
export function GameView(bindings: GameViewBindings): Container {
    const { model } = bindings;
    const canvasW = FIELD_COLS * TILE_SIZE;
    const canvasH = FIELD_ROWS * TILE_SIZE;
    const restartHint = isTouchDevice() ? 'Tap to restart' : 'Press Enter to restart';
    const gameOverText = `GAME OVER\n\n${restartHint}`;

    return (
        <container>
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
                )}
            </List>
            <List items={() => model.rocks}>
                {(rock) => (
                    <RockView
                        col={() => rock().smoothCol}
                        row={() => rock().smoothRow}
                        phase={() => rock().phase}
                        isAlive={() => rock().isAlive}
                        tileSize={() => TILE_SIZE}
                    />
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
}

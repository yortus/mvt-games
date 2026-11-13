/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { isTouchDevice } from '@mvtjs/site-kit/device';
import { type ArcadeControls, describeControl } from '@mvtjs/site-kit/input';
import { ArcadeControlsInputView, SwipeInputView } from '@mvtjs/site-kit/input/pixi';
import { OverlayView } from '@mvtjs/site-kit/shared';
import type { MusicChip, SfxChip } from '@mvtjs/site-kit/sound';
import { List } from '@mvtjs/pixi';
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
    /** The chip the game's music plays on. It is the view's output, not model state, so the view reads it once. */
    music: MusicChip<'audio80'>;
    /** The chip the game's sound effects play on, read once as `music` is. */
    sfx: SfxChip<'audio80'>;
    /** The arcade controls, which the host passes to the game as it starts. */
    controls: ArcadeControls;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The whole game. It draws the field, the digger, the enemies and the rocks.
 * The HUD is below, and the overlay is above. It also plays the game's
 * sound, and wires its controls. The enemies and rocks are each a `<List>`,
 * whose item views are reused as the collection changes.
 */
export function GameView(bindings: GameViewBindings): Container {
    const { model, music, sfx, controls } = bindings;
    const canvasW = FIELD_COLS * TILE_SIZE;
    const canvasH = FIELD_ROWS * TILE_SIZE;
    const isTouch = isTouchDevice();
    const restartHint = isTouch ? 'Tap to restart' : `Press ${describeControl('restart')} to restart`;
    const gameOverText = `GAME OVER\n\n${restartHint}`;

    return (
        <container>
            {/*
                The keys, or the host's touch controls. The d-pad digs. The axis pressed last wins.
                When it is let go, the digger digs in the direction the other axis holds, if any.
                The primary button pumps as it is pressed, and keeps the harpoon out while held
            */}
            <ArcadeControlsInputView
                controls={controls}
                onXDirectionChanged={(direction) => { model.direction = direction !== 'none' ? direction : controls.yDirection; }}
                onYDirectionChanged={(direction) => { model.direction = direction !== 'none' ? direction : controls.xDirection; }}
                onPrimaryButtonChanged={(pressed) => { model.isHarpoonOut = pressed; }}
                onPrimaryPressed={model.pump}
                onRestartPressed={model.startNewRun}
            />
            {/* Behind everything, so the overlay takes its own taps; it reaches past the screen, to the space round it */}
            <SwipeInputView
                isEnabled={isTouch}
                x={-canvasW * 2}
                y={-canvasH}
                width={canvasW * 5}
                height={canvasH * 4}
                swipeDistance={SWIPE_DISTANCE}
                // A swipe digs that way for as long as the finger stays down, and letting go stops
                onSwiped={(direction) => { model.direction = direction; }}
                onLifted={() => { model.direction = 'none'; }}
            />
            <GameAudioView
                music={music}
                sfx={sfx}
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
                            sfx={sfx}
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
                        <RockAudioView sfx={sfx} phase={() => rock().phase} />
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
                font="pixel"
                width={canvasW}
                height={canvasH}
                isVisible={() => model.phase === 'game-over' || model.phase === 'level-clear'}
                text={() => (model.phase === 'game-over' ? gameOverText : 'LEVEL CLEAR!')}
                onPressed={model.startNewRun}
            />
        </container>
    );

    function isEnemyFleeing(): boolean {
        const enemies = model.enemies;
        for (let i = 0; i < enemies.length; i++) if (enemies[i].isFleeing) return true;
        return false;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far a finger must slide to swipe, in the game's pixels: most of a tile. */
const SWIPE_DISTANCE = 14;

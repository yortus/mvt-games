/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { List } from '@mvtjs/pixi';
import type { Audio80 } from 'audio90';
import { memoiseLast } from '@mvtjs/utils';
import { isTouchDevice, OverlayView, SwipeInputView } from '#shared';
import { BLOW_OUT_POINTS, FIELD_COLS, FIELD_ROWS, SHEEP_POINTS } from '../data';
import type { GameModel, GamePhase } from '../models';
import { BeetleView } from './beetle-view';
import { DustDevilView } from './dust-devil-view';
import { FarmFencedView } from './farm-fenced-view';
import { FarmhandView } from './farmhand-view';
import { FenceView } from './fence-view';
import { GameAudioView } from './game-audio-view';
import { HudView } from './hud-view';
import { MeadowView } from './meadow-view';
import { PointsPopupView } from './points-popup-view';
import { SheepView } from './sheep-view';
import {
    CELL_SIZE, COLOURS, FIELD_HEIGHT, FIELD_WIDTH, FIELD_X, FIELD_Y, findFarmLook, SCREEN_HEIGHT, SCREEN_WIDTH,
} from './view-constants';
import { WireView } from './wire-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    model: GameModel;
    /** The chip the game's sound plays on. It is the view's output, not model state, so the view reads it once. */
    sound: Audio80;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The whole game. The top-level view, so it takes the model itself and wires
 * each leaf view's bindings to it.
 *
 * It is layered from back to front. The ground and the fences come first,
 * then the sheep, then the wire, the beetles and the farmhand. The dust
 * devils, which tower over everything, and the points come last. The HUD
 * runs across the top, and the overlay covers the meadow between rounds.
 * When a whole farm is fenced, its celebration covers the meadow instead.
 * Each farm's dry grass has its own colours. On a touch screen, a swipe
 * anywhere on the screen sets the farmhand going that way, and a tap stops
 * them, but the overlay's own taps come first.
 */
export function GameView(bindings: GameViewBindings): Container {
    const { model, sound } = bindings;
    const overlayText = memoiseLast((phase: GamePhase) => describePhase(phase, model));

    return (
        <container>
            <GameAudioView
                sound={sound}
                phase={() => model.phase}
                wireSteps={() => model.farmhand.wireStepCount}
                closures={() => model.field.closureCount}
                sheepPenned={() => model.sheepPennedCount}
                devilsBlownOut={() => model.devilsBlownOut}
                beetlesHatched={() => model.beetlesHatched}
                extraLivesEarned={() => model.extraLivesEarned}
                isSlackRunning={() => model.farmhand.slackDistance > 0}
                share={() => model.field.claimedShare}
                targetShare={() => model.targetShare}
            />
            <graphics ref={(g) => g.rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill(COLOURS.earth)} />
            {/* Behind everything, so the overlay takes its own taps; it reaches past the screen, to the touch controls' space */}
            <SwipeInputView
                isEnabled={isTouchDevice()}
                x={-SCREEN_WIDTH * 2}
                y={-SCREEN_HEIGHT}
                width={SCREEN_WIDTH * 5}
                height={SCREEN_HEIGHT * 4}
                swipeDistance={SWIPE_DISTANCE}
                onSwiped={(direction) => model.steer(direction)}
                onTapped={() => model.stop()}
            />
            <container x={FIELD_X} y={FIELD_Y}>
                <MeadowView
                    rows={FIELD_ROWS}
                    cols={FIELD_COLS}
                    cellSize={CELL_SIZE}
                    cellKindAt={(row, col) => model.field.cellKindAt(row, col)}
                    closureAt={(row, col) => model.field.closureAt(row, col)}
                    closureCount={() => model.field.closureCount}
                    round={() => model.round}
                    grass={() => findFarmLook(model.farm).grass}
                />
                <FenceView
                    rows={FIELD_ROWS}
                    cols={FIELD_COLS}
                    cellSize={CELL_SIZE}
                    hasFence={(row, col, direction) => model.field.hasFence(row, col, direction)}
                    isWalkable={(row, col, direction) => model.field.isWalkable(row, col, direction)}
                    closureCount={() => model.field.closureCount}
                    round={() => model.round}
                />
                <List items={() => model.sheep}>
                    {(sheep) => (
                        <SheepView
                            row={() => sheep().row}
                            col={() => sheep().col}
                            cellSize={CELL_SIZE}
                            spriteScale={SPRITE_SCALES.sheep}
                            phase={() => sheep().phase}
                            isFacingLeft={() => sheep().isFacingLeft}
                            penPoints={SHEEP_POINTS}
                        />
                    )}
                </List>
                <WireView
                    cellSize={CELL_SIZE}
                    wireLength={() => model.farmhand.wireLength}
                    wireRowAt={(index) => model.farmhand.wireRows[index]}
                    wireColAt={(index) => model.farmhand.wireCols[index]}
                    endRow={() => model.farmhand.row}
                    endCol={() => model.farmhand.col}
                    slackDistance={() => model.farmhand.slackDistance}
                    isSnapped={() => model.phase === 'snapped'}
                />
                <List items={() => model.beetles}>
                    {(beetle) => (
                        <BeetleView
                            row={() => beetle().row}
                            col={() => beetle().col}
                            cellSize={CELL_SIZE}
                            spriteScale={SPRITE_SCALES.beetle}
                            direction={() => beetle().direction}
                            phase={() => beetle().phase}
                            hatchProgress={() => beetle().hatchProgress}
                        />
                    )}
                </List>
                <FarmhandView
                    row={() => model.farmhand.row}
                    col={() => model.farmhand.col}
                    cellSize={CELL_SIZE}
                    spriteScale={SPRITE_SCALES.farmhand}
                    direction={() => model.farmhand.direction}
                    isMoving={() => model.farmhand.isMoving}
                    isStringing={() => model.farmhand.phase === 'stringing'}
                    isSnapped={() => model.phase === 'snapped'}
                />
                <List items={() => model.devils}>
                    {(devil) => (
                        <DustDevilView
                            row={() => devil().row}
                            col={() => devil().col}
                            cellSize={CELL_SIZE}
                            size={() => devil().size}
                            isStarving={() => devil().isStarving}
                            blowOutProgress={() => devil().blowOutProgress}
                            isShown={() => devil().phase !== 'gone'}
                            blowOutPoints={BLOW_OUT_POINTS}
                        />
                    )}
                </List>
                <PointsPopupView
                    closureCount={() => model.field.closureCount}
                    points={() => model.lastClosurePoints}
                    row={() => model.field.lastClosureRow}
                    col={() => model.field.lastClosureCol}
                    cellSize={CELL_SIZE}
                />
                <OverlayView
                    font="pixel"
                    width={FIELD_WIDTH}
                    height={FIELD_HEIGHT}
                    isVisible={() => model.phase === 'ready' || model.phase === 'round-clear' || model.phase === 'game-over'}
                    text={() => overlayText(model.phase)}
                    onPressed={model.startNewRun}
                />
                <FarmFencedView
                    width={FIELD_WIDTH}
                    height={FIELD_HEIGHT}
                    isShown={() => model.phase === 'farm-fenced'}
                    farm={() => model.farm}
                    elapsedMs={() => model.phaseMs}
                />
            </container>
            <HudView
                score={() => model.score}
                round={() => model.round}
                lives={() => model.lives}
                share={() => model.field.claimedShare}
                targetShare={() => model.targetShare}
                sheepPenned={() => model.sheepPennedThisRound}
                sheepCount={() => model.sheep.length}
                width={SCREEN_WIDTH}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const RESTART_PROMPT = isTouchDevice() ? 'Tap to play again' : 'Press Enter to play again';

/** How to steer, shown as each round starts on a touch screen, where there are no controls to see. */
const STEERING_HINT = isTouchDevice() ? '\n\nSwipe to steer, tap to stop' : '';

/** How far a finger must slide to swipe, in the game's pixels. */
const SWIPE_DISTANCE = 14;

/**
 * How large to draw the small characters. A phone shows the play area at
 * under its own size, so there they are drawn larger, to be seen.
 */
const SPRITE_SCALES = isTouchDevice()
    ? { farmhand: 1.5, beetle: 2, sheep: 1.25 }
    : { farmhand: 1, beetle: 1, sheep: 1 };

function describePhase(phase: GamePhase, model: GameModel): string {
    switch (phase) {
        case 'ready':
            return `${findFarmLook(model.farm).name.toUpperCase()}\nROUND ${model.round}\n\nFence off ${Math.round(model.targetShare * 100)}% of the meadow${STEERING_HINT}`;
        case 'round-clear':
            return [
                'ROUND CLEAR!',
                '',
                `Sheep penned: ${model.sheepPennedThisRound} of ${model.sheep.length}`,
                `Bonus: ${model.roundBonus}`,
            ].join('\n');
        case 'game-over':
            return `GAME OVER\n\nScore ${model.score}\n\n${RESTART_PROMPT}`;
        default:
            return '';
    }
}

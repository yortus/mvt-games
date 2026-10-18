import { isTouchDevice } from '#shared';
import { definePixiLoader, type EntrySession } from '../../../entry-types';
import { FIELD_COLS, FIELD_ROWS, ROUNDS } from '../data';
import { createGameModel, type HeldDirection } from '../models';
import { GameView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns how to start Fenceline. It draws all its art itself, so there is nothing to load. */
export const load = definePixiLoader(async () => {
    return {
        kind: 'pixi',
        soundChip: 'audio80',
        pixelArt: true,
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        integerScale: true,
        // Long enough to fence off one paddock and start on another
        thumbnailAdvanceMs: THUMBNAIL_ADVANCE_MS,
        thumbnailInput: (session, elapsedMs) => {
            let move = THUMBNAIL_MOVES[0];
            for (let i = 1; i < THUMBNAIL_MOVES.length && THUMBNAIL_MOVES[i].atMs <= elapsedMs; i++) move = THUMBNAIL_MOVES[i];
            const input = session.inputConfig;
            input?.onXDirectionChanged?.(move.x);
            input?.onYDirectionChanged?.(move.y);
        },

        start({ stage, sound }): EntrySession {
            const gameModel = createGameModel({ rounds: ROUNDS, rows: FIELD_ROWS, cols: FIELD_COLS });
            const gameView = GameView({ model: gameModel, sound });
            stage.addChild(gameView);
            const input = gameModel.playerInput;

            // The way held is the latest of the two axes pressed, so a new press turns at once
            let xDirection: HeldDirection = 'none';
            let yDirection: HeldDirection = 'none';
            let isYLatest = false;
            const updateDirection = (): void => {
                const latest = isYLatest ? yDirection : xDirection;
                input.direction = latest !== 'none' ? latest : isYLatest ? xDirection : yDirection;
            };

            return {
                // The host ticks the view with the rest of the stage
                update(deltaMs: number): void {
                    gameModel.update(deltaMs);
                },
                destroy(): void {
                    stage.removeChild(gameView);
                    gameView.destroy({ children: true });
                },
                // A run ends only at game over: a farm fenced moves on to the next
                scoring: {
                    score: () => gameModel.score,
                    isOver: () => gameModel.phase === 'game-over',
                },
                saveGame: gameModel.save,
                loadGame: gameModel.load,
                inputConfig: {
                    // On a touch screen, the game view's swipes and taps steer, so no controls are drawn.
                    // Pushing off a fence strings wire, so there is no button.
                    showDpad: !isTouchDevice(),
                    onXDirectionChanged: (direction) => {
                        if (direction !== xDirection && direction !== 'none') isYLatest = false;
                        xDirection = direction;
                        updateDirection();
                    },
                    onYDirectionChanged: (direction) => {
                        if (direction !== yDirection && direction !== 'none') isYLatest = true;
                        yDirection = direction;
                        updateDirection();
                    },
                    onRestartButtonChanged: (pressed) => { input.restartPressed = pressed; },
                },
            };
        },
    };
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * The thumbnail's moves, each from its time on. After the round's opening
 * moment, the farmhand walks left along the bottom, strings a wire up and
 * across to fence off the bottom left corner, walks up the left fence, and
 * is partway across with a second wire as the picture is taken.
 */
const THUMBNAIL_MOVES: readonly {
    readonly atMs: number;
    readonly x: 'left' | 'none' | 'right';
    readonly y: 'up' | 'none' | 'down';
}[] = [
    { atMs: 0, x: 'none', y: 'none' },
    { atMs: 1800, x: 'left', y: 'none' },
    { atMs: 2900, x: 'none', y: 'up' },
    { atMs: 4000, x: 'left', y: 'none' },
    { atMs: 5650, x: 'none', y: 'up' },
    { atMs: 7300, x: 'right', y: 'none' },
];

const THUMBNAIL_ADVANCE_MS = 8500;

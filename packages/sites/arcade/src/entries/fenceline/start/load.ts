import { definePixiLoader, type EntrySession } from '@mvtjs/site-kit/entry-types';
import { FIELD_COLS, FIELD_ROWS, ROUNDS } from '../data';
import { createGameModel } from '../models';
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
        // On a touch screen, the game view's swipes and taps steer, so no touch controls are drawn.
        // Pushing off a fence strings wire, so there is no button
        arcadeControls: 'keys-only',
        // Long enough to fence off one paddock and start on another
        thumbnailAdvanceMs: THUMBNAIL_ADVANCE_MS,
        thumbnailInput: (controls, elapsedMs) => {
            let move = THUMBNAIL_MOVES[0];
            for (let i = 1; i < THUMBNAIL_MOVES.length && THUMBNAIL_MOVES[i].atMs <= elapsedMs; i++) move = THUMBNAIL_MOVES[i];
            controls.setXDirection('script', move.x);
            controls.setYDirection('script', move.y);
        },

        start({ stage, music, sfx, controls }): EntrySession {
            const gameModel = createGameModel({ rounds: ROUNDS, rows: FIELD_ROWS, cols: FIELD_COLS });
            const gameView = GameView({ model: gameModel, music, sfx, controls });
            stage.addChild(gameView);

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

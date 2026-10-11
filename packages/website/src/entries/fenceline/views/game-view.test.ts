import { describe, expect, it } from 'vitest';
import { type Container, Text } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { createHeadlessAudio80 } from '@mvtjs/audio/headless';
import { FIELD_COLS, FIELD_ROWS, type RoundConfig, ROUNDS } from '../data';
import { createGameModel, type HeldDirection, SHEEP_POINTS } from '../models';
import { GameView } from './game-view';

const STEP_MS = 1000 / 60;

describe('GameView', () => {
    it('shows a whole game, from the first round to game over, and the next game', () => {
        const game = createGameModel({ rounds: ROUNDS, rows: FIELD_ROWS, cols: FIELD_COLS, seed: 5 });
        const { audio80, controls } = createHeadlessAudio80();
        const view = GameView({ model: game, sound: audio80 });
        const tick = (): void => {
            game.update(STEP_MS);
            controls.update(STEP_MS);
            updateView(view, STEP_MS);
            refreshView(view);
        };

        tick();
        expect(listTexts(view)).toContain('ROUND 1\n\nFence off 70% of the meadow');

        // Wander, stringing wire, turning every so often, until the game ends
        let frame = 0;
        let mostClosures = 0;
        while (game.phase !== 'game-over' && frame < 60 * 60 * 10) {
            game.playerInput.stringPressed = true;
            game.playerInput.direction = WANDER[Math.floor(frame / 40) % WANDER.length];
            tick();
            mostClosures = Math.max(mostClosures, game.field.closureCount);
            frame++;
        }
        expect(mostClosures).toBeGreaterThan(0);
        expect(game.phase).toBe('game-over');
        tick();
        expect(listTexts(view).some((text) => text.startsWith('GAME OVER'))).toBe(true);

        game.playerInput.restartPressed = true;
        tick();
        game.playerInput.restartPressed = false;
        tick();
        expect(listTexts(view)).toContain('ROUND 1\n\nFence off 70% of the meadow');
        view.destroy({ children: true });
    });

    it('shows the points of a sheep penned, rising from it', () => {
        // One still dust devil far off, and a sheep in the bottom left corner
        const round: RoundConfig = {
            ...ROUNDS[0],
            devilSpeed: 0,
            startBeetles: 0,
            maxBeetles: 0,
            sheepCount: 1,
            devilStarts: [{ row: 10, col: 45 }],
            sheepStarts: [{ row: 38.5, col: 3.5 }],
        };
        const game = createGameModel({ rounds: [round], rows: FIELD_ROWS, cols: FIELD_COLS });
        const { audio80, controls } = createHeadlessAudio80();
        const view = GameView({ model: game, sound: audio80 });
        const tick = (): void => {
            game.update(STEP_MS);
            controls.update(STEP_MS);
            updateView(view, STEP_MS);
            refreshView(view);
        };

        // From the bottom middle, left along the edge, then a wire up and across the corner
        const input = game.playerInput;
        const moves: readonly [HeldDirection, number][] = [['none', 1800], ['left', 2200], ['up', 700], ['left', 1200]];
        input.stringPressed = true;
        for (const [direction, ms] of moves) {
            input.direction = direction;
            for (let elapsed = 0; elapsed < ms && game.sheepPennedCount === 0; elapsed += STEP_MS) tick();
        }
        expect(game.sheepPennedCount).toBe(1);
        for (let i = 0; i < 10; i++) tick();
        expect(listTexts(view)).toContain(`+${SHEEP_POINTS}`);
        view.destroy({ children: true });
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WANDER: readonly HeldDirection[] = ['up', 'left', 'up', 'right', 'down', 'right', 'up', 'left', 'down'];

/** The text of every visible text object in the view. */
function listTexts(view: Container): string[] {
    const texts: string[] = [];
    walk(view);
    return texts;

    function walk(node: Container): void {
        if (!node.visible) return;
        if (node instanceof Text) texts.push(node.text);
        for (const child of node.children) walk(child);
    }
}

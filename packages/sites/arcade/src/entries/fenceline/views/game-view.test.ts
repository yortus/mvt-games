import { describe, expect, it, vi } from 'vitest';
import { type Container, type FederatedPointerEvent, Text } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { createHeadlessAudio80 } from '@mvtjs/chiptune/headless';
import { FIELD_COLS, FIELD_ROWS, type RoundConfig, ROUNDS, SHEEP_POINTS } from '../data';
import { createGameModel, type GameModel, type HeldDirection } from '../models';
import { GameView } from './game-view';
import { SCREEN_WIDTH } from './view-constants';

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
        expect(listTexts(view)).toContain('BREEZY ACRES\nROUND 1\n\nFence off 70% of the meadow');

        // Wander, stringing wire, turning every so often, until the game ends
        let frame = 0;
        let mostClosures = 0;
        while (game.phase !== 'game-over' && frame < 60 * 60 * 10) {
            hold(game, WANDER[Math.floor(frame / 40) % WANDER.length]);
            tick();
            mostClosures = Math.max(mostClosures, game.field.closureCount);
            frame++;
        }
        expect(mostClosures).toBeGreaterThan(0);
        expect(game.phase).toBe('game-over');
        tick();
        expect(listTexts(view).some((text) => text.startsWith('GAME OVER'))).toBe(true);

        game.startNewRun();
        tick();
        tick();
        expect(listTexts(view)).toContain('BREEZY ACRES\nROUND 1\n\nFence off 70% of the meadow');
        view.destroy({ children: true });
    });

    it('shows lives past the three hats that fit as a count', () => {
        const game = createGameModel({ rounds: ROUNDS, rows: FIELD_ROWS, cols: FIELD_COLS, startLives: 5 });
        const view = GameView({ model: game, sound: createHeadlessAudio80().audio80 });
        updateView(view, STEP_MS);
        refreshView(view);
        expect(listTexts(view)).toContain('x5');
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
        const moves: readonly [HeldDirection, number][] = [['none', 1800], ['left', 2200], ['up', 700], ['left', 1200]];
        for (const [direction, ms] of moves) {
            hold(game, direction);
            for (let elapsed = 0; elapsed < ms && game.sheepPennedCount === 0; elapsed += STEP_MS) tick();
        }
        expect(game.sheepPennedCount).toBe(1);
        for (let i = 0; i < 10; i++) tick();
        expect(listTexts(view)).toContain(`+${SHEEP_POINTS}`);
        view.destroy({ children: true });
    });

    it('celebrates the farm fenced after its last round, then starts on the next farm', () => {
        // A farm of one round, cleared by fencing off the bottom left corner
        const round: RoundConfig = {
            ...ROUNDS[0],
            devilSpeed: 0,
            startBeetles: 0,
            maxBeetles: 0,
            sheepCount: 0,
            targetShare: 0.01,
            devilStarts: [{ row: 10, col: 45 }],
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

        const moves: readonly [HeldDirection, number][] = [['none', 1800], ['left', 2200], ['up', 700], ['left', 1200]];
        for (const [direction, ms] of moves) {
            hold(game, direction);
            for (let elapsed = 0; elapsed < ms && game.phase !== 'round-clear'; elapsed += STEP_MS) tick();
        }
        game.stop();
        expect(game.phase).toBe('round-clear');
        while (game.phase === 'round-clear') tick();
        expect(game.phase).toBe('farm-fenced');
        for (let elapsed = 0; elapsed < 6000; elapsed += STEP_MS) tick();
        const texts = listTexts(view);
        expect(texts).toContain('FARM FENCED!');
        expect(texts).toContain('BREEZY ACRES IS ALL FENCED IN!');
        expect(texts).toContain('NEXT JOB: GUSTY GULLY.');

        while (game.phase === 'farm-fenced') tick();
        tick();
        expect(listTexts(view)).toContain('GUSTY GULLY\nROUND 2\n\nFence off 1% of the meadow');
        expect(listTexts(view)).not.toContain('FARM FENCED!');
        view.destroy({ children: true });
    });

    it('steers the farmhand the way swiped on a touch screen, and stops them on a tap', () => {
        // A touch screen, where the view takes swipes and taps
        vi.stubGlobal('ontouchstart', vi.fn());
        try {
            const round: RoundConfig = { ...ROUNDS[0], devilSpeed: 0, startBeetles: 0, maxBeetles: 0 };
            const game = createGameModel({ rounds: [round], rows: FIELD_ROWS, cols: FIELD_COLS });
            const { audio80, controls } = createHeadlessAudio80();
            const view = GameView({ model: game, sound: audio80 });
            const tick = (): void => {
                game.update(STEP_MS);
                controls.update(STEP_MS);
                updateView(view, STEP_MS);
                refreshView(view);
            };
            const swipes = findByLabel(view, 'swipe-input');
            while (game.phase !== 'playing') tick();

            // A swipe left along the bottom fence, well past how far a finger must slide
            const startCol = game.farmhand.col;
            swipes.emit('pointerdown', touch(SCREEN_WIDTH / 2, 0));
            swipes.emit('pointerup', touch(SCREEN_WIDTH / 4, 0));
            for (let i = 0; i < 60; i++) tick();
            expect(game.farmhand.isMoving).toBe(true);
            expect(game.farmhand.col).toBeLessThan(startCol);

            // A tap, which stops them at the next grid point
            swipes.emit('pointerdown', touch(SCREEN_WIDTH / 2, 0));
            swipes.emit('pointerup', touch(SCREEN_WIDTH / 2, 0));
            for (let i = 0; i < 60; i++) tick();
            expect(game.farmhand.isMoving).toBe(false);
            expect(Number.isInteger(game.farmhand.col)).toBe(true);
            view.destroy({ children: true });
        }
        finally {
            vi.unstubAllGlobals();
        }
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WANDER: readonly HeldDirection[] = ['up', 'left', 'up', 'right', 'down', 'right', 'up', 'left', 'down'];

/** Steers the farmhand `way`, or stops them for none, as a key held or let go does. */
function hold(game: GameModel, way: HeldDirection): void {
    if (way === 'none') game.stop();
    else game.steer(way);
}

/** A touch of the first finger at (x, y), in the view's pixels. */
function touch(x: number, y: number): FederatedPointerEvent {
    return { pointerId: 1, getLocalPosition: () => ({ x, y }) } as unknown as FederatedPointerEvent;
}

/** Returns the first display object in the view labelled `label`. */
function findByLabel(view: Container, label: string): Container {
    const found = search(view);
    if (found === undefined) throw new Error(`Nothing is labelled ${label}`);
    return found;

    function search(node: Container): Container | undefined {
        if (node.label === label) return node;
        for (const child of node.children) {
            const inChild = search(child);
            if (inChild !== undefined) return inChild;
        }
        return undefined;
    }
}

/** The text of every visible text object in the view, and every visible label, which is how pixel text tells what it spells. */
function listTexts(view: Container): string[] {
    const texts: string[] = [];
    walk(view);
    return texts;

    function walk(node: Container): void {
        if (!node.visible) return;
        if (node instanceof Text) texts.push(node.text);
        else if (typeof node.label === 'string') texts.push(node.label);
        for (const child of node.children) walk(child);
    }
}

import { describe, expect, it } from 'vitest';
import { createHeadlessAudio80 } from 'audio90/headless';
import { createArcadeControls } from '@mvtjs/site-kit/input';
import { ARENA_HEIGHT, ARENA_WIDTH } from '../data';
import { createGameModel } from '../models';
import { GameView } from './game-view';

describe('GameView', () => {
    it('keeps the ship thrusting while the secondary button is held, after Up is let go', () => {
        const model = createGameModel({ arenaWidth: ARENA_WIDTH, arenaHeight: ARENA_HEIGHT });
        const controls = createArcadeControls();
        GameView({ model, sfx: createHeadlessAudio80(), controls });
        controls.setYDirection('keyboard', 'up');
        controls.setHeld('touch', 'secondary', true);
        controls.setYDirection('keyboard', 'none');
        expect(model.isThrusting).toBe(true);
        controls.setHeld('touch', 'secondary', false);
        expect(model.isThrusting).toBe(false);
    });
});

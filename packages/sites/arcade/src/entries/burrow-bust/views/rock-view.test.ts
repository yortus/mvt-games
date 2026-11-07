import { afterEach, describe, expect, it, vi } from 'vitest';
import { Texture } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { textures } from '../data';
import type { RockPhase } from '../models';
import { RockView } from './rock-view';

const TILE_SIZE = 20;
const REST_X = TILE_SIZE / 2;
/** Long enough for a wobble to have moved the rock well off its rest. */
const WOBBLE_STEP_MS = 30;

describe('RockView', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('wobbles with game time, and stands still with no time passing', () => {
        const { view } = setUp('wobbling');
        updateView(view, WOBBLE_STEP_MS);
        refreshView(view);
        const wobbled = view.position.x;
        expect(wobbled).not.toBe(REST_X);

        updateView(view, 0);
        refreshView(view);
        expect(view.position.x).toBe(wobbled);
    });

    it('rests where its tile is unless it is wobbling', () => {
        const { view } = setUp('stable');
        updateView(view, WOBBLE_STEP_MS);
        refreshView(view);
        expect(view.position.x).toBe(REST_X);
    });
});

function setUp(phase: RockPhase) {
    vi.spyOn(textures, 'get').mockReturnValue({ rock: { normal: Texture.EMPTY, shattered: Texture.EMPTY } } as unknown as ReturnType<typeof textures.get>);
    const view = RockView({
        col: () => 0,
        row: () => 0,
        phase: () => phase,
        isAlive: () => true,
        tileSize: () => TILE_SIZE,
    });
    return { view };
}

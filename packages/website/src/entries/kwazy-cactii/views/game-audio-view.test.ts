import { describe, expect, it } from 'vitest';
import { refreshView, updateView } from '@mvtjs/pixi';
import type { SoundEffect } from '@mvtjs/audio';
import { createHeadlessAudio80 } from '@mvtjs/audio/headless';
import { BIG_MATCH, CASCADE_FANFARES, FIREWORKS, GAME_OVER, LAND, MATCH_BURST, NEW_GAME, SWAP, SWAP_BACK } from '../data';
import type { BoardPhase, GamePhase } from '../models';
import { GameAudioView } from './game-audio-view';
import { MIN_CASCADE_FOR_FIREWORKS, MIN_CELLS_FOR_BIG_MATCH } from './view-constants';

// Each test checks the effects that each tick plays, in order. The chip's log
// holds each effect played, itself, so a check tells every effect apart, even
// two that share an instrument or a first note.

const TICK_MS = 1000 / 60;
const SMALL_MATCH_CELLS = 3;

describe('GameAudioView', () => {
    it('plays a new game\'s notes on its first tick, then nothing while nothing changes', () => {
        const { tick } = setUp();
        expect(tick()).toEqual([NEW_GAME]);
        for (let i = 0; i < 60; i++) expect(tick()).toEqual([]);
    });

    it('whoops as a swap starts, knocks as a swap that makes no line is undone, and is quiet as the board goes idle', () => {
        const { state, tick } = setUp();
        tick();
        state.boardPhase = 'swapping';
        expect(tick()).toEqual([SWAP]);
        state.boardPhase = 'reversing';
        expect(tick()).toEqual([SWAP_BACK]);
        state.boardPhase = 'idle';
        expect(tick()).toEqual([]);
    });

    it('plays each step of a long cascade: a tock as the cactii land, a burst, the step\'s fanfare, and fireworks from the step that sets them off', () => {
        const { state, tick } = setUp();
        tick();
        state.matchedCellCount = SMALL_MATCH_CELLS;
        state.boardPhase = 'swapping';
        expect(tick()).toEqual([SWAP]);
        // One step more than there are fanfares, so the last step replays the top one
        const stepCount = CASCADE_FANFARES.length + 1;
        for (let step = 1; step <= stepCount; step++) {
            state.cascadeStep = step;
            state.boardPhase = 'matching';
            const fanfare = CASCADE_FANFARES[Math.min(step, CASCADE_FANFARES.length) - 1];
            const expected: SoundEffect[] = step === 1 ? [] : [LAND];
            expected.push(MATCH_BURST, fanfare);
            if (step >= MIN_CASCADE_FOR_FIREWORKS) expected.push(FIREWORKS);
            expect(tick()).toEqual(expected);

            state.boardPhase = 'settling';
            expect(tick()).toEqual([]);
        }
        state.boardPhase = 'idle';
        expect(tick()).toEqual([LAND]);
    });

    it('sparkles for a match that clears enough cactii, and not for one that clears one fewer', () => {
        const { state, tick } = setUp();
        tick();
        state.cascadeStep = 1;
        state.matchedCellCount = MIN_CELLS_FOR_BIG_MATCH - 1;
        state.boardPhase = 'matching';
        expect(tick()).toEqual([MATCH_BURST, CASCADE_FANFARES[0]]);

        state.boardPhase = 'settling';
        tick();
        state.boardPhase = 'idle';
        tick();
        state.boardPhase = 'swapping';
        tick();
        state.matchedCellCount = MIN_CELLS_FOR_BIG_MATCH;
        state.boardPhase = 'matching';
        expect(tick()).toEqual([MATCH_BURST, CASCADE_FANFARES[0], BIG_MATCH]);
    });

    it('plays the end as the last cactii land with no moves left, and a new game\'s notes on a restart', () => {
        const { state, tick } = setUp();
        tick();
        state.boardPhase = 'settling';
        tick();
        // The board goes idle, and the game ends, in the same tick
        state.boardPhase = 'idle';
        state.gamePhase = 'game-over';
        expect(tick()).toEqual([GAME_OVER, LAND]);
        expect(tick()).toEqual([]);

        // A restart makes a new board, which starts idle as the old one ended
        state.gamePhase = 'playing';
        expect(tick()).toEqual([NEW_GAME]);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface State {
    gamePhase: GamePhase;
    boardPhase: BoardPhase;
    cascadeStep: number;
    matchedCellCount: number;
}

/**
 * Creates the view on a recording chip, for a game that has not yet had its
 * first tick. Its `tick` runs one tick and returns the effects it played.
 */
function setUp() {
    const state: State = { gamePhase: 'playing', boardPhase: 'idle', cascadeStep: 0, matchedCellCount: 0 };
    const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
    const view = GameAudioView({
        sound: chip,
        gamePhase: () => state.gamePhase,
        boardPhase: () => state.boardPhase,
        cascadeStep: () => state.cascadeStep,
        matchedCellCount: () => state.matchedCellCount,
    });
    const tick = (): SoundEffect[] => {
        chip.clear();
        controls.update(TICK_MS);
        updateView(view, TICK_MS);
        refreshView(view);
        const played: SoundEffect[] = [];
        for (const write of chip.log) {
            if (write.kind === 'play') played.push(write.effect);
        }
        return played;
    };
    return { state, tick };
}

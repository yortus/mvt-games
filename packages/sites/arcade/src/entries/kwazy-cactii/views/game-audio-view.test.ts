import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshView, updateView } from '@mvtjs/pixi';
import type { Audio80Sound } from 'audio90';
import { createHeadlessAudio80, type HeadlessAudio80 } from 'audio90/headless';
import { BIG_MATCH, CASCADE_CRACKLES, CASCADE_WHISTLES, GAME_OVER, LAND, NEW_GAME, SWAP, SWAP_BACK } from '../data';
import type { BoardPhase, GamePhase } from '../models';
import { GameAudioView } from './game-audio-view';
import { MIN_CELLS_FOR_BIG_MATCH } from './view-constants';

// Each test checks the effects that each tick plays, in order. The test spies
// on the chip's `play`, which is given each effect itself, so a check tells
// every effect apart, even two that share an instrument or a first note.

const TICK_MS = 1000 / 60;
const SMALL_MATCH_CELLS = 3;

afterEach(() => {
    vi.restoreAllMocks();
});

describe('GameAudioView', () => {
    it('plays a new game\'s notes as it is made, and nothing on its first tick', () => {
        const { chip, tick } = setUp();
        expect(listPlayed(chip)).toEqual([NEW_GAME]);
        expect(tick()).toEqual([]);
    });

    it('blips as a swap that makes a line starts, says nothing for one that makes none until it knocks as it is undone', () => {
        const { state, tick } = setUp();
        tick();
        state.isSwapMatching = true;
        state.boardPhase = 'swapping';
        expect(tick()).toEqual([SWAP]);
        state.boardPhase = 'idle';
        tick();

        // A swap that makes no line: nothing as it starts, and the knocks as it is undone
        state.isSwapMatching = false;
        state.boardPhase = 'swapping';
        expect(tick()).toEqual([]);
        state.boardPhase = 'reversing';
        expect(tick()).toEqual([SWAP_BACK]);
        state.boardPhase = 'idle';
        expect(tick()).toEqual([]);
    });

    it('plays each step of a long cascade: a tock as the cactii land, the step\'s whistle, higher at each step, and the crackle beside it once the fireworks start', () => {
        const { state, tick } = setUp();
        tick();
        state.matchedCellCount = SMALL_MATCH_CELLS;
        state.isSwapMatching = true;
        state.boardPhase = 'swapping';
        expect(tick()).toEqual([SWAP]);
        // One step more than the cascade has sounds, so the last step replays the top one
        const stepCount = CASCADE_WHISTLES.length + 1;
        for (let step = 1; step <= stepCount; step++) {
            state.cascadeStep = step;
            state.boardPhase = 'matching';
            const index = Math.min(step, CASCADE_WHISTLES.length) - 1;
            const expected: Audio80Sound[] = step === 1 ? [] : [LAND];
            expected.push(CASCADE_WHISTLES[index]);
            const crackle = CASCADE_CRACKLES[index];
            if (crackle !== undefined) expected.push(crackle);
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
        expect(tick()).toEqual([CASCADE_WHISTLES[0]]);

        state.boardPhase = 'settling';
        tick();
        state.boardPhase = 'idle';
        tick();
        state.boardPhase = 'swapping';
        tick();
        state.matchedCellCount = MIN_CELLS_FOR_BIG_MATCH;
        state.boardPhase = 'matching';
        expect(tick()).toEqual([CASCADE_WHISTLES[0], BIG_MATCH]);
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
    isSwapMatching: boolean;
    cascadeStep: number;
    matchedCellCount: number;
}

/**
 * Creates the view on a spied chip, for a game that has not yet had its
 * first tick. Its `tick` runs one tick and returns the effects it played.
 */
function setUp() {
    const state: State = { gamePhase: 'playing', boardPhase: 'idle', isSwapMatching: false, cascadeStep: 0, matchedCellCount: 0 };
    const chip = createSpiedChip();
    const view = GameAudioView({
        sfx: chip,
        gamePhase: () => state.gamePhase,
        boardPhase: () => state.boardPhase,
        isSwapMatching: () => state.isSwapMatching,
        cascadeStep: () => state.cascadeStep,
        matchedCellCount: () => state.matchedCellCount,
    });
    const tick = (): unknown[] => {
        vi.clearAllMocks();
        chip.update(TICK_MS);
        updateView(view, TICK_MS);
        refreshView(view);
        return listPlayed(chip);
    };
    return { state, chip, tick };
}

/** Creates a headless chip whose `play`, `queue` and `stop` are spied on, so a test can read what a view asked of it. */
function createSpiedChip(): HeadlessAudio80 {
    const chip = createHeadlessAudio80();
    vi.spyOn(chip, 'play');
    vi.spyOn(chip, 'queue');
    vi.spyOn(chip, 'stop');
    return chip;
}

/** The songs and sounds played on `chip`, oldest first. */
function listPlayed(chip: HeadlessAudio80): unknown[] {
    return vi.mocked(chip.play).mock.calls.map((call) => call[0]);
}

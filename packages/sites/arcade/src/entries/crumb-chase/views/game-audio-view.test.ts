import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshView, updateView } from '@mvtjs/pixi';
import { createHeadlessAudio80, type HeadlessAudio80 } from 'audio90/headless';
import { CAUGHT, CLEARED, GAME_START, NIBBLE_HIGH, NIBBLE_LOW, SNEAK } from '../data';
import type { GamePhase } from '../models';
import { GameAudioView, SNEAK_SPEED_UP } from './game-audio-view';

// The view is tested by what it asks of its chips: which songs and sounds it plays, and at what tempo. How a chip
// plays a song is the chip's own concern, tested with it.

const TICK_MS = 1000 / 60;
const TOTAL_CRUMBS = 100;

afterEach(() => {
    vi.restoreAllMocks();
});

describe('GameAudioView', () => {
    it('plays the start\'s tune at its own tempo as a game starts, and queues the sneaking tune after it', () => {
        const { music } = setUp();
        expect(listPlayed(music)).toEqual([GAME_START]);
        expect(music.queue).toHaveBeenCalledWith(SNEAK);
        expect(music.tempoScale).toBe(1);
    });

    it.each([
        { remainingCrumbs: TOTAL_CRUMBS, left: 'every crumb left' },
        { remainingCrumbs: TOTAL_CRUMBS / 2, left: 'half the crumbs left' },
        { remainingCrumbs: 1, left: 'one crumb left' },
    ])('plays the sneaking tune faster the fewer crumbs are left, with $left', ({ remainingCrumbs }) => {
        const { music, state, tickFor } = setUpSneaking();
        state.remainingCrumbs = remainingCrumbs;
        tickFor(TICK_MS);
        const tempoScale = 1 + (1 - remainingCrumbs / TOTAL_CRUMBS) * SNEAK_SPEED_UP;
        expect(music.tempoScale).toBeCloseTo(tempoScale);
    });

    it.each([
        { phase: 'game-over', song: CAUGHT, remainingCrumbs: 1, ending: 'caught' },
        { phase: 'won', song: CLEARED, remainingCrumbs: 0, ending: 'won' },
    ] as const)('plays its tune at its own tempo as the game ends $ending, after the sneaking tune has sped up', ({ phase, song, remainingCrumbs }) => {
        const { music, state, tickFor } = setUpSneaking();
        state.remainingCrumbs = remainingCrumbs;
        tickFor(TICK_MS);
        expect(music.tempoScale).toBeGreaterThan(1);
        vi.clearAllMocks();
        state.phase = phase;
        tickFor(TICK_MS);
        expect(listPlayed(music)).toEqual([song]);
        expect(music.tempoScale).toBe(1);
    });

    it('plays the start\'s tune again, and no nibble, as a game starts after one ends', () => {
        const { music, sfx, state, tickFor } = setUp();
        state.remainingCrumbs = 40;
        tickFor(TICK_MS);
        state.phase = 'game-over';
        tickFor(TICK_MS);
        vi.clearAllMocks();
        state.phase = 'playing';
        state.remainingCrumbs = TOTAL_CRUMBS;
        tickFor(TICK_MS);
        expect(sfx.play).not.toHaveBeenCalled();
        expect(listPlayed(music)).toEqual([GAME_START]);
        expect(music.queue).toHaveBeenCalledWith(SNEAK);
        expect(music.tempoScale).toBe(1);
    });

    it('nibbles for each crumb, low and high by turns', () => {
        const { sfx, state, tickFor } = setUp();
        for (const remaining of [99, 98, 97]) {
            state.remainingCrumbs = remaining;
            tickFor(TICK_MS);
        }
        expect(listPlayed(sfx)).toEqual([NIBBLE_HIGH, NIBBLE_LOW, NIBBLE_HIGH]);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Sets up a view as a game starts, and runs its first tick. */
function setUp() {
    const state = { phase: 'playing' as GamePhase, remainingCrumbs: TOTAL_CRUMBS };
    const music = createSpiedChip();
    const sfx = createSpiedChip();
    const view = GameAudioView({
        music,
        sfx,
        phase: () => state.phase,
        remainingCrumbs: () => state.remainingCrumbs,
        totalCrumbs: TOTAL_CRUMBS,
    });
    const tickFor = (ms: number) => {
        for (let elapsed = 0; elapsed < ms; elapsed += TICK_MS) {
            music.update(TICK_MS);
            sfx.update(TICK_MS);
            updateView(view, TICK_MS);
            refreshView(view);
        }
    };
    tickFor(TICK_MS);
    return { music, sfx, state, tickFor };
}

/** Sets up a view as a game starts, and runs it until the sneaking tune has played for a second. */
function setUpSneaking() {
    const setup = setUp();
    setup.tickFor(GAME_START.durationMs + 1000);
    return setup;
}

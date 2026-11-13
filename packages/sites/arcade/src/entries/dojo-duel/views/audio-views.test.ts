import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Container } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { createHeadlessAudio80, type HeadlessAudio80 } from 'audio90/headless';
import {
    FIGHT_THEME,
    type FighterPhase,
    type GamePhase,
    GONG,
    KICK_SWISH,
    type MoveKind,
    POINTS_TO_WIN_ROUND,
    ROUND_WON,
    TICK,
} from '../data';
import { FighterAudioView } from './fighter-audio-view';
import { MatchAudioView, TICKING_SECONDS } from './match-audio-view';

const TICK_MS = 1000 / 60;

/** A clock reading far above the seconds that tick, as at the start of a round. */
const FULL_CLOCK_SECONDS = 30;

// The views are tested by what they ask of their chips: which songs and sounds they play, and when they stop the
// music. How a chip plays a song is the chip's own concern, tested with it.

afterEach(() => {
    vi.restoreAllMocks();
});

describe('FighterAudioView', () => {
    it('swishes again when the same move starts a second time', () => {
        const { chip, state, tick } = setUpFighterAudio();
        for (let i = 0; i < 2; i++) {
            state.move = 'mid-kick';
            tick();
            state.move = undefined;
            tick();
        }
        expect(listPlayed(chip).filter((sound) => sound === KICK_SWISH)).toHaveLength(2);
    });

    it('plays nothing for the state it starts in', () => {
        const { chip } = setUpFighterAudio({ phase: 'defeated', move: 'jump' });
        expect(chip.play).not.toHaveBeenCalled();
    });
});

describe('MatchAudioView', () => {
    it('plays the tune on through a point, without starting it again', () => {
        const { music, state, tick } = setUpMatchAudio();
        vi.clearAllMocks();
        state.phase = 'fighting';
        tick();
        state.phase = 'point-scored';
        tick();
        state.phase = 'fighting';
        tick();
        expect(listPlayed(music)).toEqual([FIGHT_THEME]);
        expect(music.stop).not.toHaveBeenCalled();
    });

    it('stops the tune for the gong, then plays it from the top as the next round starts', () => {
        const { music, sfx, state, tick } = setUpMatchAudio();
        state.phase = 'fighting';
        tick();
        vi.clearAllMocks();
        state.phase = 'round-intro';
        tick();
        expect(listPlayed(sfx)).toEqual([GONG]);
        expect(music.stop).toHaveBeenCalledOnce();
        vi.clearAllMocks();
        state.phase = 'fighting';
        tick();
        expect(listPlayed(music)).toEqual([FIGHT_THEME]);
    });

    it('plays no point\'s notes for the points that end a round when the clock runs out, only the round\'s jingle', () => {
        const { music, sfx, state, tick } = setUpMatchAudio();
        state.phase = 'fighting';
        state.playerPoints = 1;
        tick();
        vi.clearAllMocks();
        state.playerPoints = POINTS_TO_WIN_ROUND;
        state.secondsLeft = 0;
        state.hasPlayerWon = true;
        state.phase = 'round-over';
        tick();
        expect(sfx.play).not.toHaveBeenCalled();
        expect(listPlayed(music)).toEqual([ROUND_WON]);
    });

    it('ticks in each of the round\'s last seconds, and not at 0 or as the clock goes back up', () => {
        const { sfx, state, tick } = setUpMatchAudio();
        state.phase = 'fighting';
        tick();
        vi.clearAllMocks();
        for (let seconds = TICKING_SECONDS + 2; seconds >= 0; seconds--) {
            state.secondsLeft = seconds;
            tick();
        }
        state.secondsLeft = FULL_CLOCK_SECONDS;
        tick();
        expect(listPlayed(sfx)).toEqual(Array.from({ length: TICKING_SECONDS }, () => TICK));
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

/**
 * Returns a function that runs one tick as the Arcade does. It advances the
 * chips' clocks, then updates and refreshes the view.
 */
function createTicker(options: { chips: readonly HeadlessAudio80[]; view: Container }): () => void {
    const { chips, view } = options;
    return () => {
        for (const chip of chips) chip.update(TICK_MS);
        updateView(view, TICK_MS);
        refreshView(view);
    };
}

function setUpFighterAudio(initial: Partial<{ phase: FighterPhase; move: MoveKind }> = {}) {
    const state = {
        phase: initial.phase ?? 'idle' as FighterPhase,
        move: initial.move as MoveKind | undefined,
    };
    const chip = createSpiedChip();
    const view = FighterAudioView({ sfx: chip, phase: () => state.phase, move: () => state.move });
    const tick = createTicker({ chips: [chip], view });
    tick();
    return { chip, state, tick };
}

function setUpMatchAudio() {
    const state = {
        phase: 'round-intro' as GamePhase,
        playerPoints: 0,
        opponentPoints: 0,
        secondsLeft: FULL_CLOCK_SECONDS,
        hasPlayerWon: false,
    };
    const music = createSpiedChip();
    const sfx = createSpiedChip();
    const view = MatchAudioView({
        music,
        sfx,
        phase: () => state.phase,
        playerPoints: () => state.playerPoints,
        opponentPoints: () => state.opponentPoints,
        secondsLeft: () => state.secondsLeft,
        hasPlayerWon: () => state.hasPlayerWon,
    });
    const tick = createTicker({ chips: [music, sfx], view });
    tick();
    return { music, sfx, state, tick };
}

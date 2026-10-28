import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Container } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { createHeadlessAudio80, type HeadlessAudio80 } from 'audio90/headless';
import {
    CARRIER_HIT,
    DIVE,
    RESPAWN,
    SCOUT_HIT,
    SHIP_HIT,
    SHOT,
    STAGE_CLEAR,
    STAGE_FANFARE,
    STAGE_TUNE,
    STRIKER_HIT,
    WAVES,
} from '../data';
import type { EnemyKind, EnemyPhase, GamePhase } from '../models';
import { EnemyAudioView } from './enemy-audio-view';
import { GameAudioView, HURRY_AT_MOST, HURRY_TEMPO } from './game-audio-view';

// The views are tested by what they ask of their chips: which songs and sounds they play, and at what tempo. How a
// chip plays a song is the chip's own concern, tested with it.

const TICK_MS = 1000 / 60;

afterEach(() => {
    vi.restoreAllMocks();
});

describe('GameAudioView', () => {
    it('plays the fanfare at its own tempo as the game starts, and queues the stage\'s tune, on the music chip', () => {
        const { music, sfx } = setUpGameAudio();
        expect(listPlayed(music)).toEqual([STAGE_FANFARE]);
        expect(music.queue).toHaveBeenCalledWith(STAGE_TUNE);
        expect(music.tempoScale).toBe(1);
        expect(sfx.play).not.toHaveBeenCalled();
    });

    it('plays a shot once for each rise in the count, on the sound effects chip', () => {
        const { music, sfx, state, tick } = setUpGameAudio();
        state.shotsFired = 1;
        tick();
        tick();
        state.shotsFired = 2;
        tick();
        expect(listPlayedOf(sfx, SHOT)).toHaveLength(2);
        expect(listPlayedOf(music, SHOT)).toHaveLength(0);
    });

    it('stops the music and plays the ship\'s loss, then its return and the tune', () => {
        const { music, sfx, state, tick } = setUpGameAudio();
        state.phase = 'dying';
        tick();
        expect(listPlayedOf(sfx, SHIP_HIT)).toHaveLength(1);
        expect(music.stop).toHaveBeenCalledTimes(1);
        vi.clearAllMocks();
        state.phase = 'playing';
        tick();
        expect(listPlayedOf(sfx, RESPAWN)).toHaveLength(1);
        // The ship's return goes straight to the tune, with no fanfare
        expect(listPlayed(music)).toEqual([STAGE_TUNE]);
        expect(music.tempoScale).toBe(1);
    });

    it('plays the fanfare again, and no shot, when a game starts after one ends', () => {
        const { music, sfx, state, tick } = setUpGameAudio({ shotsFired: 30 });
        state.phase = 'game-over';
        tick();
        vi.clearAllMocks();
        state.phase = 'playing';
        state.shotsFired = 0;
        tick();
        expect(listPlayedOf(sfx, SHOT)).toHaveLength(0);
        expect(listPlayed(music)).toEqual([STAGE_FANFARE]);
        expect(music.queue).toHaveBeenCalledWith(STAGE_TUNE);
    });

    it.each([
        { enemiesLeft: HURRY_AT_MOST + 1, tempoScale: 1 },
        { enemiesLeft: HURRY_AT_MOST, tempoScale: HURRY_TEMPO },
    ])('plays the tune at $tempoScale times its tempo with $enemiesLeft raiders left', ({ enemiesLeft, tempoScale }) => {
        const { music, state, tick } = setUpGameAudio({ phase: 'dying', enemiesLeft });
        state.phase = 'playing';
        tick();
        expect(music.tempoScale).toBe(tempoScale);
    });

    it('plays the stage-clear jingle at its own tempo, though no raiders are left', () => {
        // The tune is hurrying as the last raider goes
        const { music, state, tick } = setUpGameAudio({ phase: 'dying', enemiesLeft: 0 });
        state.phase = 'playing';
        tick();
        expect(music.tempoScale).toBe(HURRY_TEMPO);
        vi.clearAllMocks();
        state.phase = 'stage-clear';
        tick();
        expect(listPlayed(music)).toEqual([STAGE_CLEAR]);
        expect(music.tempoScale).toBe(1);
    });
});

describe('EnemyAudioView', () => {
    it.each([
        { kind: 'scout', effect: SCOUT_HIT },
        { kind: 'striker', effect: STRIKER_HIT },
        { kind: 'carrier', effect: CARRIER_HIT },
    ] as const)('plays the $kind\'s explosion as it is destroyed', ({ kind, effect }) => {
        const { chip, state, tick } = setUpEnemyAudio({ kind });
        state.isAlive = false;
        tick();
        expect(listPlayed(chip)).toEqual([effect]);
    });

    it('whistles as the raider dives', () => {
        const { chip, state, tick } = setUpEnemyAudio({ phase: 'formation' });
        state.phase = 'diving';
        tick();
        expect(listPlayed(chip)).toEqual([DIVE]);
    });

    it('plays nothing on its first poll, or when its slot\'s raider comes alive', () => {
        const { chip, state, tick } = setUpEnemyAudio({ isAlive: false, phase: 'dead', kind: 'scout' });
        expect(chip.play).not.toHaveBeenCalled();
        state.isAlive = true;
        state.phase = 'entering';
        tick();
        expect(chip.play).not.toHaveBeenCalled();
        state.isAlive = false;
        tick();
        expect(listPlayed(chip)).toEqual([SCOUT_HIT]);
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

/** Each play of `sound` on `chip`. */
function listPlayedOf(chip: HeadlessAudio80, sound: unknown): unknown[] {
    return listPlayed(chip).filter((played) => played === sound);
}

/** Returns a function that runs one tick as the Arcade does: the chips' clocks, then the view's update and refresh. */
function createTicker(options: { chips: readonly HeadlessAudio80[]; view: Container }): () => void {
    const { chips, view } = options;
    return () => {
        for (const chip of chips) chip.update(TICK_MS);
        updateView(view, TICK_MS);
        refreshView(view);
    };
}

function setUpGameAudio(initial: Partial<{ phase: GamePhase; shotsFired: number; enemiesLeft: number }> = {}) {
    const state = {
        phase: initial.phase ?? 'playing',
        shotsFired: initial.shotsFired ?? 0,
        enemiesLeft: initial.enemiesLeft ?? WAVES[0].slots.length,
    };
    const music = createSpiedChip();
    const sfx = createSpiedChip();
    const view = GameAudioView({
        music,
        sfx,
        phase: () => state.phase,
        shotsFired: () => state.shotsFired,
        enemiesLeft: () => state.enemiesLeft,
    });
    const tick = createTicker({ chips: [music, sfx], view });
    tick();
    return { music, sfx, state, tick };
}

function setUpEnemyAudio(initial: Partial<{ isAlive: boolean; phase: EnemyPhase; kind: EnemyKind }> = {}) {
    const state = {
        isAlive: initial.isAlive ?? true,
        phase: initial.phase ?? 'formation',
        kind: initial.kind ?? 'striker',
    };
    const chip = createSpiedChip();
    const view = EnemyAudioView({
        sfx: chip,
        isAlive: () => state.isAlive,
        phase: () => state.phase,
        kind: () => state.kind,
    });
    const tick = createTicker({ chips: [chip], view });
    tick();
    return { chip, state, tick };
}

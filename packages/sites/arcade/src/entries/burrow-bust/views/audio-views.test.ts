import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Container } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { createHeadlessAudio80, type HeadlessAudio80 } from 'audio90/headless';
import { POP, PUMP_1, PUMP_2, PUMP_3, PUMP_4, ROCK_CRASH, ROCK_FALL, ROCK_WOBBLE } from '../data';
import type { EnemyPhase, GamePhase, InflationStage, RockPhase } from '../models';
import { EnemyAudioView } from './enemy-audio-view';
import { GameAudioView, HURRY_TEMPO } from './game-audio-view';
import { RockAudioView } from './rock-audio-view';

// The views are tested by what they ask of their chips: which songs and sounds they play, and at what tempo. How a
// chip plays a song is the chip's own concern, tested with it.

const TICK_MS = 1000 / 60;

afterEach(() => {
    vi.restoreAllMocks();
});

describe('GameAudioView', () => {
    it.each([
        { isDiggerMoving: false, isEnemyFleeing: false },
        { isDiggerMoving: true, isEnemyFleeing: true },
    ])('plays the level\'s jingle at its own tempo, with the digger moving $isDiggerMoving and the last creature fleeing $isEnemyFleeing', (initial) => {
        const { music } = setUpGameAudio(initial);
        expect(music.tempoScale).toBe(1);
    });

    it('holds the walking tune while the digger stands, and moves it on as the digger moves', () => {
        const { music, state, tick } = setUpGameAudio({ phase: 'dying' });
        state.phase = 'playing';
        tick();
        expect(music.tempoScale).toBe(0);
        state.isDiggerMoving = true;
        tick();
        expect(music.tempoScale).toBe(1);
    });

    it.each([
        { isEnemyFleeing: false, tempoScale: 1 },
        { isEnemyFleeing: true, tempoScale: HURRY_TEMPO },
    ])('plays the walking tune at $tempoScale times its tempo, with the last creature fleeing $isEnemyFleeing', ({ isEnemyFleeing, tempoScale }) => {
        const { music, state, tick } = setUpGameAudio({ phase: 'dying', isDiggerMoving: true, isEnemyFleeing });
        state.phase = 'playing';
        tick();
        expect(music.tempoScale).toBe(tempoScale);
    });
});

describe('EnemyAudioView', () => {
    it('plays each stage\'s pump as the creature is pumped up, then pops it', () => {
        const { chip, state, tick } = setUpEnemyAudio();
        state.phase = 'inflating';
        for (let stage = 1; stage <= 4; stage++) {
            state.inflationStage = stage as InflationStage;
            if (stage === 4) state.phase = 'popped';
            tick();
        }
        expect(listPlayed(chip)).toEqual([PUMP_1, PUMP_2, PUMP_3, PUMP_4, POP]);
    });

    it('plays no pop as a creature gets away', () => {
        const { chip, state, tick } = setUpEnemyAudio({ phase: 'fleeing' });
        state.phase = 'popped';
        state.hasEscaped = true;
        tick();
        expect(chip.play).not.toHaveBeenCalled();
    });

    it.each([
        { phase: 'popped', inflationStage: 4, isFireTelegraph: false, isFireActive: false },
        { phase: 'ghosting', inflationStage: 2, isFireTelegraph: true, isFireActive: true },
    ] as const)('plays nothing as it is made $phase, or as its slot then takes a new creature', (initial) => {
        const { chip, state, tick } = setUpEnemyAudio(initial);
        expect(chip.play).not.toHaveBeenCalled();
        state.phase = 'patrol';
        state.inflationStage = 0;
        state.isFireTelegraph = false;
        state.isFireActive = false;
        tick();
        expect(chip.play).not.toHaveBeenCalled();
    });
});

describe('RockAudioView', () => {
    it('creaks, whistles and crashes as it works loose, falls and breaks', () => {
        const { chip, state, tick } = setUpRockAudio();
        const phases: RockPhase[] = ['wobbling', 'falling', 'shattered'];
        for (let i = 0; i < phases.length; i++) {
            state.phase = phases[i];
            tick();
            tick();
        }
        expect(listPlayed(chip)).toEqual([ROCK_WOBBLE, ROCK_FALL, ROCK_CRASH]);
    });

    it('plays nothing as it is made, or as its slot takes a new rock', () => {
        const { chip, state, tick } = setUpRockAudio({ phase: 'shattered' });
        expect(chip.play).not.toHaveBeenCalled();
        state.phase = 'stable';
        tick();
        expect(chip.play).not.toHaveBeenCalled();
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

/** Returns a function that runs one tick as the host does: the chips' clocks, then the view's update and refresh. */
function createTicker(chips: readonly HeadlessAudio80[], view: Container): () => void {
    return () => {
        for (const chip of chips) chip.update(TICK_MS);
        updateView(view, TICK_MS);
        refreshView(view);
    };
}

function setUpGameAudio(initial: Partial<{ phase: GamePhase; isDiggerMoving: boolean; harpoonShots: number; isEnemyFleeing: boolean }> = {}) {
    const state = {
        phase: initial.phase ?? 'playing',
        isDiggerMoving: initial.isDiggerMoving ?? false,
        harpoonShots: initial.harpoonShots ?? 0,
        isEnemyFleeing: initial.isEnemyFleeing ?? false,
    };
    const music = createSpiedChip();
    const sfx = createSpiedChip();
    const view = GameAudioView({
        music,
        sfx,
        phase: () => state.phase,
        isDiggerMoving: () => state.isDiggerMoving,
        harpoonShots: () => state.harpoonShots,
        isEnemyFleeing: () => state.isEnemyFleeing,
    });
    const tick = createTicker([music, sfx], view);
    tick();
    return { music, sfx, state, tick };
}

function setUpEnemyAudio(initial: Partial<{ phase: EnemyPhase; inflationStage: InflationStage; isFireTelegraph: boolean; isFireActive: boolean }> = {}) {
    const state = {
        phase: initial.phase ?? 'patrol',
        inflationStage: initial.inflationStage ?? 0,
        hasEscaped: false,
        isFireTelegraph: initial.isFireTelegraph ?? false,
        isFireActive: initial.isFireActive ?? false,
    };
    const chip = createSpiedChip();
    const view = EnemyAudioView({
        sfx: chip,
        phase: () => state.phase,
        inflationStage: () => state.inflationStage,
        hasEscaped: () => state.hasEscaped,
        isFireTelegraph: () => state.isFireTelegraph,
        isFireActive: () => state.isFireActive,
    });
    const tick = createTicker([chip], view);
    tick();
    return { chip, state, tick };
}

function setUpRockAudio(initial: Partial<{ phase: RockPhase }> = {}) {
    const state = { phase: initial.phase ?? 'stable' };
    const chip = createSpiedChip();
    const view = RockAudioView({ sfx: chip, phase: () => state.phase });
    const tick = createTicker([chip], view);
    tick();
    return { chip, state, tick };
}

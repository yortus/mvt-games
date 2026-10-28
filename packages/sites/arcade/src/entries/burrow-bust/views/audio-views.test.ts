import { describe, expect, it } from 'vitest';
import type { Container } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import type { Audio80Song, Audio80Sound } from 'audio90';
import { type Audio80Write, createHeadlessAudio80, type HeadlessAudio80 } from 'audio90/headless';
import {
    DEATH, FIRE, FIRE_WARNING, GAME_OVER, GHOST, HARPOON, LEVEL_CLEAR, LEVEL_START, POP, PUMP_1, PUMP_2, PUMP_3,
    PUMP_4, ROCK_CRASH, ROCK_FALL, ROCK_WOBBLE, SQUASH, WALK_TUNE,
} from '../data';
import type { EnemyPhase, GamePhase, InflationStage, RockPhase } from '../models';
import { EnemyAudioView } from './enemy-audio-view';
import { GameAudioView, HURRY_TEMPO } from './game-audio-view';
import { RockAudioView } from './rock-audio-view';

const TICK_MS = 1000 / 60;

/**
 * How many ticks a test listens to a song for. This is half a second, and the
 * test 'tells every song apart within the ticks it listens for' checks that
 * it is long enough.
 */
const SONG_TICKS = 30;

/** How many ticks a test holds the walking tune for, with the digger standing. */
const HOLD_TICKS = 60;

const JINGLES = [
    { phase: 'dying', song: DEATH },
    { phase: 'level-clear', song: LEVEL_CLEAR },
    { phase: 'game-over', song: GAME_OVER },
] as const;

describe('GameAudioView', () => {
    it('tells every song apart within the ticks it listens for', () => {
        const recordings = [
            recordSong({ song: LEVEL_START }),
            recordSong({ song: WALK_TUNE }),
            recordSong({ song: WALK_TUNE, tempoScale: HURRY_TEMPO }),
            recordSong({ song: DEATH }),
            recordSong({ song: LEVEL_CLEAR }),
            recordSong({ song: GAME_OVER }),
        ];
        const distinct = new Set(recordings.map((notes) => notes.join(' ')));
        expect(distinct.size).toBe(recordings.length);
    });

    it('plays the level\'s jingle as the game starts, then the walking tune', () => {
        const { music, tick } = setUpGameAudio({ isDiggerMoving: true });
        const ticks = Math.ceil(LEVEL_START.durationMs / TICK_MS) + SONG_TICKS;
        runTicks(tick, ticks);
        expect(describeNoteOns(music.log)).toEqual(recordSong({ song: LEVEL_START, then: WALK_TUNE, ticks }));
    });

    it.each([
        { isDiggerMoving: false, isEnemyFleeing: false },
        { isDiggerMoving: true, isEnemyFleeing: true },
    ])('plays the level\'s jingle at its own tempo, with the digger moving $isDiggerMoving and the last creature fleeing $isEnemyFleeing', (initial) => {
        const { music, tick } = setUpGameAudio(initial);
        runTicks(tick, SONG_TICKS);
        expect(describeNoteOns(music.log)).toEqual(recordSong({ song: LEVEL_START }));
    });

    for (const { phase, song } of JINGLES) {
        it.each([
            { isDiggerMoving: false, isEnemyFleeing: false },
            { isDiggerMoving: true, isEnemyFleeing: true },
        ])(`plays the ${phase} tune at its own tempo, with the digger moving $isDiggerMoving and the last creature fleeing $isEnemyFleeing`, (initial) => {
            const { music, sfx, state, tick } = setUpGameAudio(initial);
            music.clear();
            sfx.clear();
            state.phase = phase;
            runTicks(tick, SONG_TICKS + 1);
            expect(describeNoteOns(music.log)).toEqual(recordSong({ song }));
        });
    }

    it('holds the walking tune while the digger stands, and moves it on as the digger moves', () => {
        const { music, sfx, state, tick } = setUpGameAudio({ phase: 'dying' });
        music.clear();
        sfx.clear();
        state.phase = 'playing';
        runTicks(tick, HOLD_TICKS + 1);
        state.isDiggerMoving = true;
        runTicks(tick, SONG_TICKS);
        // The view hears the digger move as it refreshes, after the chip has played that tick, so the tune moves
        // on from the tick after: one more tick held than the digger stood still for
        expect(describeNoteOns(music.log)).toEqual(recordSong({ song: WALK_TUNE, heldTicks: HOLD_TICKS + 1 }));
    });

    it.each([
        { isEnemyFleeing: false, tempoScale: 1 },
        { isEnemyFleeing: true, tempoScale: HURRY_TEMPO },
    ])('plays the walking tune at $tempoScale times its tempo, with the last creature fleeing $isEnemyFleeing', ({ isEnemyFleeing, tempoScale }) => {
        const { music, sfx, state, tick } = setUpGameAudio({ phase: 'dying', isDiggerMoving: true, isEnemyFleeing });
        music.clear();
        sfx.clear();
        state.phase = 'playing';
        runTicks(tick, SONG_TICKS + 1);
        expect(describeNoteOns(music.log)).toEqual(recordSong({ song: WALK_TUNE, tempoScale }));
    });

    it('plays the death tune as the digger is caught, then the walking tune with no jingle', () => {
        const { music, sfx, state, tick } = setUpGameAudio({ isDiggerMoving: true });
        music.clear();
        sfx.clear();
        state.phase = 'dying';
        runTicks(tick, SONG_TICKS + 1);
        expect(describeNoteOns(music.log)).toEqual(recordSong({ song: DEATH }));
        music.clear();
        sfx.clear();
        state.phase = 'playing';
        runTicks(tick, SONG_TICKS + 1);
        expect(describeNoteOns(music.log)).toEqual(recordSong({ song: WALK_TUNE }));
    });

    it('plays no walking tune after the game-over tune when the game ends during the level\'s jingle', () => {
        const { music, sfx, state, tick } = setUpGameAudio({ isDiggerMoving: true });
        music.clear();
        sfx.clear();
        state.phase = 'game-over';
        const ticks = Math.ceil(GAME_OVER.durationMs / TICK_MS) + SONG_TICKS;
        runTicks(tick, ticks + 1);
        expect(describeNoteOns(music.log)).toEqual(recordSong({ song: GAME_OVER, ticks }));
    });

    it.each(['level-clear', 'game-over'] as const)('plays the level\'s jingle as play starts again after %s', (phase) => {
        const { music, sfx, state, tick } = setUpGameAudio({ phase, isDiggerMoving: true });
        music.clear();
        sfx.clear();
        state.phase = 'playing';
        runTicks(tick, SONG_TICKS + 1);
        expect(describeNoteOns(music.log)).toEqual(recordSong({ song: LEVEL_START }));
    });

    it('zips each time the harpoon shoots out', () => {
        const { sfx, state, tick } = setUpGameAudio();
        state.harpoonShots++;
        tick();
        tick();
        state.harpoonShots++;
        tick();
        expect(listPlays(sfx.log, HARPOON)).toHaveLength(2);
    });

    it('zips for no first count, and none as a new digger\'s count starts again at 0', () => {
        const { sfx, state, tick } = setUpGameAudio({ harpoonShots: 5 });
        expect(listPlays(sfx.log, HARPOON)).toHaveLength(0);
        state.harpoonShots = 0;
        tick();
        expect(listPlays(sfx.log, HARPOON)).toHaveLength(0);
        state.harpoonShots = 1;
        tick();
        expect(listPlays(sfx.log, HARPOON)).toHaveLength(1);
    });

    it('advances no music while it is refreshed but not updated, as when paused', () => {
        const { music, sfx, view } = setUpGameAudio({ isDiggerMoving: true });
        music.clear();
        sfx.clear();
        for (let i = 0; i < 120; i++) refreshView(view);
        expect([music.log, sfx.log]).toEqual([[], []]);
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
        expect(listPlayedEffects(chip.log)).toEqual([PUMP_1, PUMP_2, PUMP_3, PUMP_4, POP]);
    });

    it('plays no pop as a creature gets away', () => {
        const { chip, state, tick } = setUpEnemyAudio({ phase: 'fleeing' });
        state.phase = 'popped';
        state.hasEscaped = true;
        tick();
        expect(chip.log).toHaveLength(0);
    });

    it.each([
        { phase: 'crushed', effect: SQUASH },
        { phase: 'ghosting', effect: GHOST },
    ] as const)('plays its sound once as the creature\'s phase becomes $phase', ({ phase, effect }) => {
        const { chip, state, tick } = setUpEnemyAudio();
        state.phase = phase;
        tick();
        tick();
        expect(listPlayedEffects(chip.log)).toEqual([effect]);
    });

    it('hisses as a salamander draws breath, then roars as it breathes fire', () => {
        const { chip, state, tick } = setUpEnemyAudio();
        state.isFireTelegraph = true;
        tick();
        state.isFireTelegraph = false;
        state.isFireActive = true;
        tick();
        state.isFireActive = false;
        tick();
        expect(listPlayedEffects(chip.log)).toEqual([FIRE_WARNING, FIRE]);
    });

    it.each([
        { phase: 'popped', inflationStage: 4, isFireTelegraph: false, isFireActive: false },
        { phase: 'ghosting', inflationStage: 2, isFireTelegraph: true, isFireActive: true },
    ] as const)('plays nothing as it is made $phase, or as its slot then takes a new creature', (initial) => {
        const { chip, state, tick } = setUpEnemyAudio(initial);
        expect(chip.log).toHaveLength(0);
        state.phase = 'patrol';
        state.inflationStage = 0;
        state.isFireTelegraph = false;
        state.isFireActive = false;
        tick();
        expect(chip.log).toHaveLength(0);
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
        expect(listPlayedEffects(chip.log)).toEqual([ROCK_WOBBLE, ROCK_FALL, ROCK_CRASH]);
    });

    it('plays nothing as it is made, or as its slot takes a new rock', () => {
        const { chip, state, tick } = setUpRockAudio({ phase: 'shattered' });
        expect(chip.log).toHaveLength(0);
        state.phase = 'stable';
        tick();
        expect(chip.log).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Play = Extract<Audio80Write, { kind: 'play' }>;
type NoteOn = Extract<Audio80Write, { kind: 'note-on' }>;

function listPlays(log: readonly Audio80Write[], effect: Audio80Sound): Play[] {
    return log.filter((write): write is Play => write.kind === 'play' && write.sound === effect);
}

/** Lists the effects played in `log`, in order. */
function listPlayedEffects(log: readonly Audio80Write[]): Audio80Sound[] {
    return log.filter((write): write is Play => write.kind === 'play').map((write) => write.sound);
}

/**
 * Describes each note-on in `log` as its voice, its note and its time. The
 * time is in ms from the first note-on, to three decimal places. So two logs
 * of the same song match even when the song started at different chip times.
 */
function describeNoteOns(log: readonly Audio80Write[]): string[] {
    const noteOns = log.filter((write): write is NoteOn => write.kind === 'note-on');
    const startMs = noteOns.length > 0 ? noteOns[0].time : 0;
    return noteOns.map((write) => `${write.voice}:${write.note}@${(write.time - startMs).toFixed(3)}`);
}

/**
 * Plays `song` on a chip of its own, and describes the notes it
 * plays. It plays `then` after `song`, if given. It holds the song at a tempo
 * scale of 0 for its first `heldTicks` ticks, then plays it at `tempoScale`
 * for `ticks` ticks. This is what a view that plays these songs should play
 * over the same ticks.
 *
 * As the view does, it sets the tempo as it refreshes: before the song
 * starts, and then each tick for the tick after, since the chip has already
 * played the tick it refreshes in.
 */
function recordSong(options: { song: Audio80Song; then?: Audio80Song; tempoScale?: number; heldTicks?: number; ticks?: number }): string[] {
    const chip = createHeadlessAudio80({ record: true });
    const heldTicks = options.heldTicks ?? 0;
    const tempoAt = (tick: number) => (tick < heldTicks ? 0 : options.tempoScale ?? 1);
    chip.tempoScale = tempoAt(0);
    chip.play(options.song);
    if (options.then !== undefined) chip.queue(options.then);
    const ticks = heldTicks + (options.ticks ?? SONG_TICKS);
    for (let i = 0; i < ticks; i++) {
        chip.update(TICK_MS);
        chip.tempoScale = tempoAt(i + 1);
    }
    return describeNoteOns(chip.log);
}

/** Returns a function that runs one tick as the host does: the chips' clocks, then the view's update and refresh. */
function createTicker(chips: readonly HeadlessAudio80[], view: Container): () => void {
    return () => {
        for (const chip of chips) chip.update(TICK_MS);
        updateView(view, TICK_MS);
        refreshView(view);
    };
}

function runTicks(tick: () => void, count: number): void {
    for (let i = 0; i < count; i++) tick();
}

function setUpGameAudio(initial: Partial<{ phase: GamePhase; isDiggerMoving: boolean; harpoonShots: number; isEnemyFleeing: boolean }> = {}) {
    const state = {
        phase: initial.phase ?? 'playing',
        isDiggerMoving: initial.isDiggerMoving ?? false,
        harpoonShots: initial.harpoonShots ?? 0,
        isEnemyFleeing: initial.isEnemyFleeing ?? false,
    };
    const music = createHeadlessAudio80({ record: true });
    const sfx = createHeadlessAudio80({ record: true });
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
    return { music, sfx, state, view, tick };
}

function setUpEnemyAudio(initial: Partial<{ phase: EnemyPhase; inflationStage: InflationStage; isFireTelegraph: boolean; isFireActive: boolean }> = {}) {
    const state = {
        phase: initial.phase ?? 'patrol',
        inflationStage: initial.inflationStage ?? 0,
        hasEscaped: false,
        isFireTelegraph: initial.isFireTelegraph ?? false,
        isFireActive: initial.isFireActive ?? false,
    };
    const chip = createHeadlessAudio80({ record: true });
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
    const chip = createHeadlessAudio80({ record: true });
    const view = RockAudioView({ sfx: chip, phase: () => state.phase });
    const tick = createTicker([chip], view);
    tick();
    return { chip, state, tick };
}

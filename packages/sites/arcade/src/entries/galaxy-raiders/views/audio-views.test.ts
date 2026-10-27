import { describe, expect, it } from 'vitest';
import type { Container } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { type Audio80Song } from 'audio90';
import { type Audio80Write, createHeadlessAudio80, type HeadlessAudio80 } from 'audio90/headless';
import {
    CARRIER_HIT,
    DIVE,
    GAME_OVER,
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
import { createGameModel, type EnemyKind, type EnemyPhase, type GamePhase } from '../models';
import { EnemyAudioView } from './enemy-audio-view';
import { GameAudioView, HURRY_AT_MOST, HURRY_TEMPO } from './game-audio-view';

const TICK_MS = 1000 / 60;

/**
 * How many ticks a test listens to a song for. This is half a second, and the
 * test 'tells every song apart within the ticks it listens for' checks that
 * it is long enough.
 */
const SONG_TICKS = 30;

describe('GameAudioView', () => {
    it('tells every song apart within the ticks it listens for', () => {
        const recordings = [
            recordSong({ song: STAGE_FANFARE }),
            recordSong({ song: STAGE_TUNE }),
            recordSong({ song: STAGE_TUNE, tempoScale: HURRY_TEMPO }),
            recordSong({ song: STAGE_CLEAR }),
            recordSong({ song: GAME_OVER }),
        ];
        const distinct = new Set(recordings.map((notes) => notes.join(' ')));
        expect(distinct.size).toBe(recordings.length);
    });

    it('plays the fanfare as the game starts, on the music chip', () => {
        const { music, tick } = setUpGameAudio();
        runTicks(tick, SONG_TICKS);
        expect(describeNoteOns(music.log)).toEqual(recordSong({ song: STAGE_FANFARE }));
    });

    it('plays a shot each time the ship fires, on the sound effects chip', () => {
        const model = createGameModel({ waves: WAVES });
        const music = createHeadlessAudio80({ record: true });
        const sfx = createHeadlessAudio80({ record: true });
        const view = GameAudioView({
            music,
            sfx,
            phase: () => model.phase,
            shotsFired: () => model.shotsFired,
            enemiesLeft: () => model.enemiesLeft,
        });
        const tick = createTicker({ chips: [music, sfx], view, model });
        tick();
        for (let shot = 0; shot < SHOTS; shot++) {
            model.fire();
            tick();
            tick();
        }
        expect(model.shotsFired).toBe(SHOTS);
        expect(listPlays(sfx.log, SHOT)).toHaveLength(SHOTS);
        expect(listPlays(music.log, SHOT)).toHaveLength(0);
    });

    it('plays a shot once for a count that rises, and none for its first value or a fall to 0', () => {
        const { sfx, state, tick } = setUpGameAudio({ shotsFired: 7 });
        expect(listPlays(sfx.log, SHOT)).toHaveLength(0);
        state.shotsFired = 9;
        tick();
        expect(listPlays(sfx.log, SHOT)).toHaveLength(1);
        state.shotsFired = 0;
        tick();
        expect(listPlays(sfx.log, SHOT)).toHaveLength(1);
    });

    it('stops the music and plays the ship\'s loss, then its return and the tune', () => {
        const { music, sfx, state, tick } = setUpGameAudio();
        state.phase = 'dying';
        tick();
        expect(listPlays(sfx.log, SHIP_HIT)).toHaveLength(1);
        expect(music.song).toBeUndefined();
        music.clear();
        state.phase = 'playing';
        runTicks(tick, SONG_TICKS + 1);
        expect(listPlays(sfx.log, RESPAWN)).toHaveLength(1);
        expect(describeNoteOns(music.log)).toEqual(recordSong({ song: STAGE_TUNE }));
    });

    it('plays the fanfare again, and no shot, when a game starts after one ends', () => {
        const { music, sfx, state, tick } = setUpGameAudio({ shotsFired: 30 });
        state.phase = 'game-over';
        tick();
        music.clear();
        sfx.clear();
        state.phase = 'playing';
        state.shotsFired = 0;
        runTicks(tick, SONG_TICKS + 1);
        expect(listPlays(sfx.log, SHOT)).toHaveLength(0);
        expect(describeNoteOns(music.log)).toEqual(recordSong({ song: STAGE_FANFARE }));
    });

    it.each([
        { enemiesLeft: HURRY_AT_MOST + 1, tempoScale: 1 },
        { enemiesLeft: HURRY_AT_MOST, tempoScale: HURRY_TEMPO },
    ])('plays the tune at $tempoScale times its tempo with $enemiesLeft raiders left', ({ enemiesLeft, tempoScale }) => {
        const { music, state, tick } = setUpGameAudio({ phase: 'dying', enemiesLeft });
        music.clear();
        state.phase = 'playing';
        runTicks(tick, SONG_TICKS + 1);
        expect(describeNoteOns(music.log)).toEqual(recordSong({ song: STAGE_TUNE, tempoScale }));
    });

    it('plays the stage-clear jingle at its own tempo, though no raiders are left', () => {
        const { music, state, tick } = setUpGameAudio({ enemiesLeft: 0 });
        music.clear();
        state.phase = 'stage-clear';
        runTicks(tick, SONG_TICKS + 1);
        expect(describeNoteOns(music.log)).toEqual(recordSong({ song: STAGE_CLEAR }));
        const lead = listNoteOns(music.log).filter((write) => write.voice === LEAD_VOICE);
        const rowMs = 60000 / (STAGE_CLEAR.bpm * STAGE_CLEAR.rowsPerBeat);
        expect(lead[1].time - lead[0].time).toBeCloseTo(rowMs * CLEAR_LEAD_ROWS_APART);
    });

    it('advances no music while it is refreshed but not updated, as when paused', () => {
        const { music, sfx, view } = setUpGameAudio();
        music.clear();
        for (let i = 0; i < 120; i++) refreshView(view);
        expect([music.log, sfx.log]).toEqual([[], []]);
    });

    it('plays nothing twice when refreshed twice', () => {
        const { sfx, state, view, tick } = setUpGameAudio();
        state.shotsFired = 1;
        tick();
        refreshView(view);
        expect(listPlays(sfx.log, SHOT)).toHaveLength(1);
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
        expect(chip.log).toEqual([expect.objectContaining({ kind: 'play', sound: effect })]);
    });

    it('whistles as the raider dives', () => {
        const { chip, state, tick } = setUpEnemyAudio({ phase: 'formation' });
        state.phase = 'diving';
        tick();
        expect(listPlays(chip.log, DIVE)).toHaveLength(1);
    });

    it('plays nothing on its first poll, or when its slot\'s raider comes alive', () => {
        const { chip, state, tick } = setUpEnemyAudio({ isAlive: false, phase: 'dead', kind: 'scout' });
        expect(chip.log).toHaveLength(0);
        state.isAlive = true;
        state.phase = 'entering';
        tick();
        expect(chip.log).toHaveLength(0);
        state.isAlive = false;
        tick();
        expect(listPlays(chip.log, SCOUT_HIT)).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** How many times the ship fires in the test of its shots. */
const SHOTS = 2;
/** The voice that plays the songs' lead. A song plays channel n on voice n, and the lead is channel 0. */
const LEAD_VOICE = 0;
/** The stage-clear jingle's lead plays its first note on row 0, and its second on row 2. */
const CLEAR_LEAD_ROWS_APART = 2;

type Play = Extract<Audio80Write, { kind: 'play' }>;
type NoteOn = Extract<Audio80Write, { kind: 'note-on' }>;

function listPlays(log: readonly Audio80Write[], effect: Play['sound']): Play[] {
    return log.filter((write): write is Play => write.kind === 'play' && write.sound === effect);
}

function listNoteOns(log: readonly Audio80Write[]): NoteOn[] {
    return log.filter((write): write is NoteOn => write.kind === 'note-on');
}

/**
 * Describes each note-on in `log` as its voice, its note and its time. The
 * time is in ms from the first note-on, to three decimal places. So two logs
 * of the same song match even when the song started at different chip times.
 */
function describeNoteOns(log: readonly Audio80Write[]): string[] {
    const noteOns = listNoteOns(log);
    const startMs = noteOns.length > 0 ? noteOns[0].time : 0;
    return noteOns.map((write) => `${write.voice}:${write.note}@${(write.time - startMs).toFixed(3)}`);
}

/**
 * Plays `song` on a chip of its own for `SONG_TICKS` ticks after the
 * one it starts in, and describes the notes it plays. This is what a view
 * that plays `song` at `tempoScale` should play over the same ticks.
 */
function recordSong(options: { song: Audio80Song; tempoScale?: number }): string[] {
    const chip = createHeadlessAudio80({ record: true });
    chip.tempoScale = options.tempoScale ?? 1;
    chip.play(options.song);
    for (let i = 0; i < SONG_TICKS; i++) {
        chip.update(TICK_MS);
    }
    return describeNoteOns(chip.log);
}

/**
 * Returns a function that runs one tick as the Arcade does. It updates the
 * model, if there is one, and advances the chips' clocks. Then it updates
 * and refreshes the view.
 */
function createTicker(options: { chips: readonly HeadlessAudio80[]; view: Container; model?: { update: (deltaMs: number) => void } }): () => void {
    const { chips, view, model } = options;
    return () => {
        model?.update(TICK_MS);
        for (const chip of chips) chip.update(TICK_MS);
        updateView(view, TICK_MS);
        refreshView(view);
    };
}

function runTicks(tick: () => void, count: number): void {
    for (let i = 0; i < count; i++) tick();
}

function setUpGameAudio(initial: Partial<{ phase: GamePhase; shotsFired: number; enemiesLeft: number }> = {}) {
    const state = {
        phase: initial.phase ?? 'playing',
        shotsFired: initial.shotsFired ?? 0,
        enemiesLeft: initial.enemiesLeft ?? WAVES[0].slots.length,
    };
    const music = createHeadlessAudio80({ record: true });
    const sfx = createHeadlessAudio80({ record: true });
    const view = GameAudioView({
        music,
        sfx,
        phase: () => state.phase,
        shotsFired: () => state.shotsFired,
        enemiesLeft: () => state.enemiesLeft,
    });
    const tick = createTicker({ chips: [music, sfx], view });
    tick();
    return { music, sfx, state, view, tick };
}

function setUpEnemyAudio(initial: Partial<{ isAlive: boolean; phase: EnemyPhase; kind: EnemyKind }> = {}) {
    const state = {
        isAlive: initial.isAlive ?? true,
        phase: initial.phase ?? 'formation',
        kind: initial.kind ?? 'striker',
    };
    const chip = createHeadlessAudio80({ record: true });
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

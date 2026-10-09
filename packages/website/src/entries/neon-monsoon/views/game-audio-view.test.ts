import { describe, expect, it } from 'vitest';
import { refreshView, updateView } from '@mvtjs/pixi';
import { createMusicPlayer, type Song } from '@mvtjs/audio';
import { type ChipWrite, createHeadlessAudio80 } from '@mvtjs/audio/headless';
import {
    ALL_CLEAR, ATTACK_BROKEN, BOMB, BOMB_PICKUP, BOSS_HIT, BOSS_THEME, EXPLODE_HUGE, EXPLODE_LARGE, EXPLODE_SMALL,
    EXTEND, FOCUS, FOCUSED_SHOT, GAME_OVER, GEM, GRAZE, type ItemKind, POWER_UP, RESPAWN, SHIP_EXPLODE, SHOT, STAGE_CLEAR,
    STAGE_THEME, WARNING,
} from '../data';
import type { BossPhase, ExplosionSize, GamePhase } from '../models';
import { GameAudioView } from './game-audio-view';

const TICK_MS = 1000 / 60;

/**
 * How many ticks a test listens to a song for. This is half a second. The
 * test 'tells every song apart within the ticks it listens for' checks that
 * it is long enough.
 */
const SONG_TICKS = 30;

describe('GameAudioView', () => {
    it('tells every song apart within the ticks it listens for', () => {
        const songs = [STAGE_THEME, BOSS_THEME, STAGE_CLEAR, ALL_CLEAR, GAME_OVER];
        const recordings = songs.map((song) => recordSong(song).join(' '));
        expect(new Set(recordings).size).toBe(songs.length);
    });

    it('starts the stage\'s theme as the game starts', () => {
        const { chip, tick } = setUp();
        // The theme starts as the view is made, so its first tick, run by `setUp`, is one of the ticks listened to
        runTicks(tick, SONG_TICKS - 1);
        expect(describeSongNotes(chip.log)).toEqual(recordSong(STAGE_THEME));
    });

    for (const previous of ['tally', 'game-over', 'all-clear'] as const) {
        it(`starts the stage's theme again as play follows the ${previous} phase`, () => {
            const { chip, state, tick } = setUp();
            state.phase = previous;
            tick();
            state.phase = 'playing';
            runTicks(tick, SONG_TICKS + 1);
            expect(describeSongNotes(chip.log)).toEqual(recordSong(STAGE_THEME));
        });
    }

    for (const [phase, song] of [['tally', STAGE_CLEAR], ['game-over', GAME_OVER], ['all-clear', ALL_CLEAR]] as const) {
        it(`plays its own song as the game turns to the ${phase} phase`, () => {
            const { chip, state, tick } = setUp();
            state.phase = phase;
            runTicks(tick, SONG_TICKS + 1);
            expect(describeSongNotes(chip.log)).toEqual(recordSong(song));
        });
    }

    it('plays the guns\' first blip in the game\'s first tick', () => {
        const { chip } = setUp({ isFiring: true });
        expect(listPlays(chip.log, SHOT)).toHaveLength(1);
    });

    it('patters while the guns fire, focused or not, and stops when they stop', () => {
        const { chip, state, tick } = setUp();
        state.isFiring = true;
        tickFor(tick, 1000);
        expect(listPlays(chip.log, SHOT).length).toBeGreaterThan(3);
        state.isFocused = true;
        tickFor(tick, 1000);
        expect(listPlays(chip.log, FOCUSED_SHOT).length).toBeGreaterThan(3);
        state.isFiring = false;
        chip.clear();
        tickFor(tick, 1000);
        expect(listPlays(chip.log, SHOT)).toHaveLength(0);
        expect(listPlays(chip.log, FOCUSED_SHOT)).toHaveLength(0);
    });

    it('sweeps down as the ship focuses in play, and not as it lets go or after the game ends', () => {
        const { chip, state, tick } = setUp();
        state.isFocused = true;
        tick();
        state.isFocused = false;
        tick();
        expect(listPlays(chip.log, FOCUS)).toHaveLength(1);
        state.phase = 'all-clear';
        tick();
        state.isFocused = true;
        tick();
        expect(listPlays(chip.log, FOCUS)).toHaveLength(1);
    });

    it('plays each explosion by its size', () => {
        const { chip, state, tick } = setUp();
        const sizes: readonly ExplosionSize[] = ['small', 'large', 'huge'];
        for (const size of sizes) {
            state.lastExplosionSize = size;
            state.explosionsStarted++;
            tick();
        }
        expect(listPlays(chip.log, EXPLODE_SMALL)).toHaveLength(1);
        expect(listPlays(chip.log, EXPLODE_LARGE)).toHaveLength(1);
        expect(listPlays(chip.log, EXPLODE_HUGE)).toHaveLength(1);
    });

    it('plays the ship\'s loss instead of its explosion, then its return, with the music playing on', () => {
        const { chip, state, tick } = setUp();
        state.phase = 'dying';
        state.lastExplosionSize = 'large';
        state.explosionsStarted++;
        tick();
        expect(listPlays(chip.log, SHIP_EXPLODE)).toHaveLength(1);
        expect(listPlays(chip.log, EXPLODE_LARGE)).toHaveLength(0);

        chip.clear();
        state.phase = 'playing';
        tick();
        expect(listPlays(chip.log, RESPAWN)).toHaveLength(1);
        expect(listWrites(chip.log, 'reserve-voices')).toHaveLength(0);
    });

    it('chimes for each extra life, even one earned as the stage is cleared, and not as a new game starts the count again', () => {
        const { chip, state, tick } = setUp();
        state.extendsEarned++;
        tick();
        expect(listPlays(chip.log, EXTEND)).toHaveLength(1);

        state.phase = 'tally';
        state.extendsEarned++;
        tick();
        expect(listPlays(chip.log, EXTEND)).toHaveLength(2);

        state.phase = 'game-over';
        tick();
        state.phase = 'playing';
        state.extendsEarned = 0;
        tick();
        expect(listPlays(chip.log, EXTEND)).toHaveLength(2);
    });

    it('plays a sound for each kind of pickup, a gem, a graze and a bomb', () => {
        const { chip, state, tick } = setUp();
        const pickUp = (kind: ItemKind): void => {
            state.lastItemKind = kind;
            state.itemsCollected++;
            tick();
        };
        pickUp('power');
        pickUp('bomb');
        state.gemsCollected += 5;
        state.grazes++;
        state.isBombing = true;
        tick();
        expect(listPlays(chip.log, POWER_UP)).toHaveLength(1);
        expect(listPlays(chip.log, BOMB_PICKUP)).toHaveLength(1);
        expect(listPlays(chip.log, GEM)).toHaveLength(1);
        expect(listPlays(chip.log, GRAZE)).toHaveLength(1);
        expect(listPlays(chip.log, BOMB)).toHaveLength(1);
    });

    it('stops the theme and sounds the warning as it starts, sounds it again while it shows, then plays the boss\'s theme', () => {
        const { chip, state, tick } = setUp();
        chip.clear();
        runWarning(state, tick, TICK_MS);
        expect(listWrites(chip.log, 'reserve-voices')).toEqual([expect.objectContaining({ count: 0 })]);
        expect(listPlays(chip.log, WARNING)).toHaveLength(1);
        runWarning(state, tick, 2000);
        expect(listPlays(chip.log, WARNING).length).toBeGreaterThan(2);

        state.warningElapsedMs = -1;
        state.bossPhase = 'entering';
        chip.clear();
        runTicks(tick, SONG_TICKS + 1);
        expect(listPlays(chip.log, WARNING)).toHaveLength(0);
        expect(describeSongNotes(chip.log)).toEqual(recordSong(BOSS_THEME));
    });

    it('stops sounding the warning when the game ends during it', () => {
        const { chip, state, tick } = setUp();
        runWarning(state, tick, 500);
        // The game stops, and its warning timer with it, but the views still tick
        state.phase = 'game-over';
        tick();
        chip.clear();
        tickFor(tick, 3000);
        expect(listPlays(chip.log, WARNING)).toHaveLength(0);
    });

    it('ticks while shots land on the boss, and plays a break as an attack ends', () => {
        const { chip, state, tick } = setUp();
        state.bossPhase = 'attacking';
        state.bossMsSinceHit = 0;
        tickFor(tick, 500);
        expect(listPlays(chip.log, BOSS_HIT).length).toBeGreaterThan(2);
        state.bossMsSinceHit = Infinity;
        state.bossPhase = 'breaking';
        chip.clear();
        tickFor(tick, 500);
        expect(listPlays(chip.log, BOSS_HIT)).toHaveLength(0);
        expect(listPlays(chip.log, ATTACK_BROKEN)).toHaveLength(1);
    });

    it('plays a break and stops the music as the last attack ends', () => {
        const { chip, state, tick } = setUp({ bossPhase: 'attacking' });
        chip.clear();
        state.bossPhase = 'exploding';
        tick();
        expect(listPlays(chip.log, ATTACK_BROKEN)).toHaveLength(1);
        expect(listWrites(chip.log, 'reserve-voices')).toEqual([expect.objectContaining({ count: 0 })]);
    });

    it('plays nothing for the counts\' starting values', () => {
        const { chip } = setUp({ grazes: 40, explosionsStarted: 12, itemsCollected: 3, gemsCollected: 90, extendsEarned: 1 });
        expect(listWrites(chip.log, 'play')).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Play = Extract<ChipWrite, { kind: 'play' }>;
type NoteOn = Extract<ChipWrite, { kind: 'note-on' }>;

interface State {
    phase: GamePhase;
    extendsEarned: number;
    isBombing: boolean;
    warningElapsedMs: number;
    bossPhase: BossPhase;
    bossMsSinceHit: number;
    isFiring: boolean;
    isFocused: boolean;
    grazes: number;
    explosionsStarted: number;
    lastExplosionSize: ExplosionSize | undefined;
    itemsCollected: number;
    lastItemKind: ItemKind | undefined;
    gemsCollected: number;
}

/**
 * Makes the view for a game that has just started, and runs its first tick.
 * Returns the chip it plays on, the state its bindings read, and a function
 * that runs one more tick.
 */
function setUp(initial: Partial<State> = {}) {
    const state: State = {
        phase: 'playing', extendsEarned: 0, isBombing: false, warningElapsedMs: -1, bossPhase: 'absent',
        bossMsSinceHit: Infinity, isFiring: false, isFocused: false, grazes: 0, explosionsStarted: 0,
        lastExplosionSize: undefined, itemsCollected: 0, lastItemKind: undefined, gemsCollected: 0, ...initial,
    };
    const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
    const view = GameAudioView({
        sound: chip,
        phase: () => state.phase,
        extendsEarned: () => state.extendsEarned,
        isBombing: () => state.isBombing,
        warningElapsedMs: () => state.warningElapsedMs,
        bossPhase: () => state.bossPhase,
        bossMsSinceHit: () => state.bossMsSinceHit,
        isFiring: () => state.isFiring,
        isFocused: () => state.isFocused,
        grazes: () => state.grazes,
        explosionsStarted: () => state.explosionsStarted,
        lastExplosionSize: () => state.lastExplosionSize,
        itemsCollected: () => state.itemsCollected,
        lastItemKind: () => state.lastItemKind,
        gemsCollected: () => state.gemsCollected,
    });
    // One tick as the Arcade runs it: the chip's clock, then the view's update and refresh
    const tick = (): void => {
        controls.update(TICK_MS);
        updateView(view, TICK_MS);
        refreshView(view);
    };
    tick();
    return { chip, state, tick };
}

function runTicks(tick: () => void, count: number): void {
    for (let i = 0; i < count; i++) tick();
}

/** Runs ticks for about `totalMs`. */
function tickFor(tick: () => void, totalMs: number): void {
    runTicks(tick, Math.round(totalMs / TICK_MS));
}

/** Runs ticks for about `totalMs` with the warning showing, advancing its timer as the model does. */
function runWarning(state: State, tick: () => void, totalMs: number): void {
    const count = Math.round(totalMs / TICK_MS);
    for (let i = 0; i < count; i++) {
        state.warningElapsedMs = Math.max(0, state.warningElapsedMs) + TICK_MS;
        tick();
    }
}

function listWrites<K extends ChipWrite['kind']>(log: readonly ChipWrite[], kind: K): Extract<ChipWrite, { kind: K }>[] {
    return log.filter((write): write is Extract<ChipWrite, { kind: K }> => write.kind === kind);
}

function listPlays(log: readonly ChipWrite[], effect: Play['effect']): Play[] {
    return listWrites(log, 'play').filter((write) => write.effect === effect);
}

/**
 * Describes each note-on of the song started last in `log`, as its voice, its
 * note and its time. A song starts by reserving its voices, so the notes
 * described are those after the last write that reserves more than none. The
 * time is in ms from the song's first note-on, to three decimal places. So the
 * notes of one song match even when it started at different chip times.
 */
function describeSongNotes(log: readonly ChipWrite[]): string[] {
    let start = 0;
    for (let i = 0; i < log.length; i++) {
        const write = log[i];
        if (write.kind === 'reserve-voices' && write.count > 0) start = i;
    }
    const noteOns = log.slice(start).filter((write): write is NoteOn => write.kind === 'note-on');
    const startMs = noteOns.length > 0 ? noteOns[0].time : 0;
    return noteOns.map((write) => `${write.voice}:${write.note}@${(write.time - startMs).toFixed(3)}`);
}

/**
 * Plays `song` on a music player of its own for `SONG_TICKS` ticks after the
 * one it starts in, and describes the notes it plays. This is what the view
 * should play over the same ticks.
 */
function recordSong(song: Song): string[] {
    const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
    const player = createMusicPlayer({ audio80: chip });
    player.play(song);
    player.refresh();
    for (let i = 0; i < SONG_TICKS; i++) {
        controls.update(TICK_MS);
        player.update(TICK_MS);
        player.refresh();
    }
    return describeSongNotes(chip.log);
}

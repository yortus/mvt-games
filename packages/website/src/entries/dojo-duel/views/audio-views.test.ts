import { describe, expect, it } from 'vitest';
import type { Container } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { type AudioControls, createMusicPlayer, type Song } from '@mvtjs/audio';
import { type ChipWrite, createHeadlessAudio80 } from '@mvtjs/audio/headless';
import {
    BLOCK,
    FIGHT_THEME,
    type FighterPhase,
    type GamePhase,
    GONG,
    HIT,
    KICK_SWISH,
    LEAP_SWISH,
    MATCH_LOST,
    MATCH_WON,
    type MoveKind,
    POINT_LOST,
    POINT_WON,
    POINTS_TO_WIN_ROUND,
    PUNCH_SWISH,
    ROUND_LOST,
    ROUND_WON,
    TICK,
} from '../data';
import { FighterAudioView } from './fighter-audio-view';
import { MatchAudioView, TICKING_SECONDS } from './match-audio-view';

const TICK_MS = 1000 / 60;

/**
 * How many ticks a test listens to a song for. This is half a second, and the
 * test 'tells every song apart within the ticks it listens for' checks that
 * it is long enough.
 */
const SONG_TICKS = 30;

/** A clock reading far above the seconds that tick, as at the start of a round. */
const FULL_CLOCK_SECONDS = 30;

describe('FighterAudioView', () => {
    it.each([
        { move: 'high-punch', swish: PUNCH_SWISH },
        { move: 'roundhouse', swish: KICK_SWISH },
        { move: 'flying-kick', swish: LEAP_SWISH },
    ] as const)('plays the right swish, and only that, as a $move starts', ({ move, swish }) => {
        const { chip, state, tick } = setUpFighterAudio();
        state.move = move;
        tick();
        state.move = undefined;
        tick();
        expect(chip.log).toEqual([expect.objectContaining({ kind: 'play', effect: swish })]);
    });

    it('swishes again when the same move starts a second time', () => {
        const { chip, state, tick } = setUpFighterAudio();
        for (let i = 0; i < 2; i++) {
            state.move = 'mid-kick';
            tick();
            state.move = undefined;
            tick();
        }
        expect(listPlays(chip.log, KICK_SWISH)).toHaveLength(2);
    });

    it('clacks as the fighter blocks, and cracks as they go down', () => {
        const { chip, state, tick } = setUpFighterAudio();
        state.phase = 'blocking';
        tick();
        state.phase = 'idle';
        tick();
        state.phase = 'defeated';
        tick();
        expect(chip.log).toEqual([
            expect.objectContaining({ kind: 'play', effect: BLOCK }),
            expect.objectContaining({ kind: 'play', effect: HIT }),
        ]);
    });

    it('plays nothing for the state it starts in', () => {
        const { chip } = setUpFighterAudio({ phase: 'defeated', move: 'jump' });
        expect(chip.log).toHaveLength(0);
    });
});

describe('MatchAudioView', () => {
    it('tells every song apart within the ticks it listens for', () => {
        const recordings = [
            recordSong({ song: FIGHT_THEME }),
            recordSong({ song: ROUND_WON }),
            recordSong({ song: ROUND_LOST }),
            recordSong({ song: MATCH_WON }),
            recordSong({ song: MATCH_LOST }),
        ];
        const distinct = new Set(recordings.map((notes) => notes.join(' ')));
        expect(distinct.size).toBe(recordings.length);
    });

    it('sounds the gong as the game starts, then plays the fight\'s tune as the fighting starts', () => {
        const { chip, state, tick } = setUpMatchAudio();
        expect(listPlays(chip.log, GONG)).toHaveLength(1);
        chip.clear();
        state.phase = 'fighting';
        runTicks(tick, SONG_TICKS + 1);
        expect(describeNoteOns(chip.log)).toEqual(recordSong({ song: FIGHT_THEME }));
    });

    it('plays the tune on through a point, without starting it again', () => {
        const { chip, state, tick } = setUpMatchAudio();
        chip.clear();
        state.phase = 'fighting';
        tick();
        runTicks(tick, SONG_TICKS / 3);
        state.phase = 'point-scored';
        runTicks(tick, SONG_TICKS / 3);
        state.phase = 'fighting';
        runTicks(tick, SONG_TICKS / 3);
        expect(describeNoteOns(chip.log)).toEqual(recordSong({ song: FIGHT_THEME }));
    });

    it('stops the tune for the gong, then plays it from the top as the next round starts', () => {
        const { chip, state, tick } = setUpMatchAudio();
        state.phase = 'fighting';
        runTicks(tick, SONG_TICKS);
        chip.clear();
        state.phase = 'round-intro';
        runTicks(tick, SONG_TICKS);
        expect(listPlays(chip.log, GONG)).toHaveLength(1);
        expect(listNoteOns(chip.log)).toHaveLength(0);
        chip.clear();
        state.phase = 'fighting';
        runTicks(tick, SONG_TICKS + 1);
        expect(describeNoteOns(chip.log)).toEqual(recordSong({ song: FIGHT_THEME }));
    });

    it('plays rising notes for each of the player\'s points and falling notes for each of the opponent\'s, and none as points go back to 0', () => {
        const { chip, state, tick } = setUpMatchAudio();
        state.phase = 'fighting';
        tick();
        chip.clear();
        state.playerPoints = 1;
        tick();
        state.opponentPoints = 1;
        tick();
        state.playerPoints = 0;
        state.opponentPoints = 0;
        tick();
        expect(chip.log).toEqual([
            expect.objectContaining({ kind: 'play', effect: POINT_WON }),
            expect.objectContaining({ kind: 'play', effect: POINT_LOST }),
        ]);
    });

    it('plays no point\'s notes for the points that end a round when the clock runs out, only the round\'s jingle', () => {
        const { chip, state, tick } = setUpMatchAudio();
        state.phase = 'fighting';
        state.playerPoints = 1;
        tick();
        chip.clear();
        state.playerPoints = POINTS_TO_WIN_ROUND;
        state.secondsLeft = 0;
        state.hasPlayerWon = true;
        state.phase = 'round-over';
        tick();
        expect(listPlays(chip.log, POINT_WON)).toHaveLength(0);
        expect(listNoteOns(chip.log).length).toBeGreaterThan(0);
    });

    it('ticks in each of the round\'s last seconds, and not at 0 or as the clock goes back up', () => {
        const { chip, state, tick } = setUpMatchAudio();
        state.phase = 'fighting';
        tick();
        chip.clear();
        for (let seconds = TICKING_SECONDS + 2; seconds >= 0; seconds--) {
            state.secondsLeft = seconds;
            tick();
        }
        state.secondsLeft = FULL_CLOCK_SECONDS;
        tick();
        expect(listPlays(chip.log, TICK)).toHaveLength(TICKING_SECONDS);
    });

    it('advances no music while it is refreshed but not updated, as when paused', () => {
        const { chip, controls, state, tick, view } = setUpMatchAudio();
        state.phase = 'fighting';
        tick();
        chip.clear();
        for (let i = 0; i < SONG_TICKS; i++) {
            controls.update(TICK_MS);
            refreshView(view);
        }
        expect(listNoteOns(chip.log)).toHaveLength(0);
    });

    it.each([
        { name: 'ROUND_WON', phase: 'round-over', winner: 'the player', hasPlayerWon: true, song: ROUND_WON },
        { name: 'ROUND_LOST', phase: 'round-over', winner: 'the opponent', hasPlayerWon: false, song: ROUND_LOST },
        { name: 'MATCH_WON', phase: 'match-over', winner: 'the player', hasPlayerWon: true, song: MATCH_WON },
        { name: 'MATCH_LOST', phase: 'match-over', winner: 'the opponent', hasPlayerWon: false, song: MATCH_LOST },
    ] as const)('plays $name when the phase becomes $phase and $winner has won', ({ phase, hasPlayerWon, song }) => {
        const { chip, state, tick } = setUpMatchAudio();
        state.phase = 'fighting';
        tick();
        chip.clear();
        state.hasPlayerWon = hasPlayerWon;
        state.phase = phase;
        runTicks(tick, SONG_TICKS + 1);
        expect(describeNoteOns(chip.log)).toEqual(recordSong({ song }));
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Play = Extract<ChipWrite, { kind: 'play' }>;
type NoteOn = Extract<ChipWrite, { kind: 'note-on' }>;

function listPlays(log: readonly ChipWrite[], effect: Play['effect']): Play[] {
    return log.filter((write): write is Play => write.kind === 'play' && write.effect === effect);
}

function listNoteOns(log: readonly ChipWrite[]): NoteOn[] {
    return log.filter((write): write is NoteOn => write.kind === 'note-on');
}

/**
 * Describes each note-on in `log` as its voice, its note and its time. The
 * time is in ms from the first note-on, to three decimal places. So two logs
 * of the same song match even when the song started at different chip times.
 */
function describeNoteOns(log: readonly ChipWrite[]): string[] {
    const noteOns = listNoteOns(log);
    const startMs = noteOns.length > 0 ? noteOns[0].time : 0;
    return noteOns.map((write) => `${write.voice}:${write.note}@${(write.time - startMs).toFixed(3)}`);
}

/**
 * Plays `song` on a music player of its own for `SONG_TICKS` ticks after the
 * one it starts in, and describes the notes it plays. This is what a view
 * that plays `song` should play over the same ticks.
 */
function recordSong(options: { song: Song }): string[] {
    const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
    const player = createMusicPlayer({ audio80: chip });
    player.play(options.song);
    player.refresh();
    for (let i = 0; i < SONG_TICKS; i++) {
        controls.update(TICK_MS);
        player.update(TICK_MS);
        player.refresh();
    }
    return describeNoteOns(chip.log);
}

/**
 * Returns a function that runs one tick as the Arcade does. It advances the
 * chip's clock, then updates and refreshes the view.
 */
function createTicker(options: { controls: AudioControls; view: Container }): () => void {
    const { controls, view } = options;
    return () => {
        controls.update(TICK_MS);
        updateView(view, TICK_MS);
        refreshView(view);
    };
}

function runTicks(tick: () => void, count: number): void {
    for (let i = 0; i < count; i++) tick();
}

function setUpFighterAudio(initial: Partial<{ phase: FighterPhase; move: MoveKind }> = {}) {
    const state = {
        phase: initial.phase ?? 'idle' as FighterPhase,
        move: initial.move as MoveKind | undefined,
    };
    const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
    const view = FighterAudioView({ sound: chip, phase: () => state.phase, move: () => state.move });
    const tick = createTicker({ controls, view });
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
    const { audio80: chip, controls } = createHeadlessAudio80({ record: true });
    const view = MatchAudioView({
        sound: chip,
        phase: () => state.phase,
        playerPoints: () => state.playerPoints,
        opponentPoints: () => state.opponentPoints,
        secondsLeft: () => state.secondsLeft,
        hasPlayerWon: () => state.hasPlayerWon,
    });
    const tick = createTicker({ controls, view });
    tick();
    return { chip, controls, state, tick, view };
}

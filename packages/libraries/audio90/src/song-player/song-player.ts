import type { Audio80Song, Audio80Writer } from '../audio80';
import type { Audio90Song, Audio90Writer } from '../audio90';
import { createAudio80SongDriver } from './audio80-driver';
import { createAudio90SongDriver } from './audio90-driver';
import type { PlayableSong, SongDriver } from './song-driver';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Plays one song at a time, playing channel n on voice n, on either chip. It
 * runs where the chip's sound is made: in a browser, on the audio thread,
 * where the sequencer moves it on by each block the sound card asks for; in
 * a headless chip, with the chip's clock. A view never makes one. It plays
 * songs on the chip, which plays them through one.
 *
 * `update` advances the song and queues the notes that fall in the time it
 * covers, each stamped with its exact time on the clock of the writer it
 * plays on. `refresh` writes the queued notes. `S` is the song type of the
 * chip it plays on, `Audio80Song` or `Audio90Song`.
 *
 * Call `update` after the writer's clock has advanced by the same `deltaMs`.
 */
export interface SongPlayer<S extends PlayableSong> {
    /** The song playing, or undefined once it ends or is stopped. */
    readonly song: S | undefined;
    /** Whether a song is playing. It is true while `song` is defined, even while a `tempoScale` of 0 holds it still. */
    readonly isPlaying: boolean;
    /** Where the song is, in beats from its start. Views can use it to move in time with the music. */
    readonly beat: number;
    /**
     * The entry in the song's order whose row is playing: the row whose
     * notes were written last, at a time no later than the writer's now. 0
     * when no song is playing.
     */
    readonly orderIndex: number;
    /** The row playing, within the pattern of the entry at `orderIndex`. 0 when no song is playing. */
    readonly row: number;
    /**
     * A multiplier on the song's tempo, where 1 plays it at its own tempo. 0
     * holds the song where it is. Its notes ring on as their envelopes allow,
     * and its slides stop. On the Audio90, the LFOs and the echo timed in
     * beats follow it too, and a scale of 0 holds those LFOs. This suits music
     * that plays only while something moves. A negative or non-finite value
     * acts as 0. Set it before calling `update`, which then plays the time
     * it covers at the new tempo.
     */
    tempoScale: number;
    /**
     * Starts `song` from its beginning now. It releases any song playing, and
     * cancels any song queued, so nothing queued before plays after it.
     */
    play: (song: S) => void;
    /**
     * Plays `song` without a gap when the song playing reaches the end of its
     * order, even if that song loops. If no song is playing, it plays `song`
     * at once.
     */
    queue: (song: S) => void;
    /** Releases the song's notes, gives its voices back to effects, and stops. */
    stop: () => void;
    /**
     * Advances the song by `deltaMs`, and queues the notes that fall in that
     * time. `deltaMs` must be finite. Does nothing for a `deltaMs` of 0 or
     * less.
     */
    update: (deltaMs: number) => void;
    /** Writes the queued notes to the writer. */
    refresh: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * What `createSongPlayer` needs: the writer it plays on, named by its chip's
 * kind. Its notes are stamped with the writer's clock.
 */
export type SongPlayerOptions = { readonly audio80: Audio80Writer } | { readonly audio90: Audio90Writer };

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a song player that writes to an Audio80, with no song playing. */
export function createSongPlayer(options: { readonly audio80: Audio80Writer }): SongPlayer<Audio80Song>;
/** Creates a song player that writes to an Audio90, with no song playing. Each song tells the chip its tempo too. */
export function createSongPlayer(options: { readonly audio90: Audio90Writer }): SongPlayer<Audio90Song>;
export function createSongPlayer(options: SongPlayerOptions): SongPlayer<Audio80Song> | SongPlayer<Audio90Song> {
    if ('audio90' in options) return createDrivenPlayer(createAudio90SongDriver({ audio90: options.audio90 }));
    return createDrivenPlayer(createAudio80SongDriver({ audio80: options.audio80 }));
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// Each of the player's times' place in its `times`
const ROW_MS = 0;
const SONG_MS = 1;
const NEXT_ROW_MS = 2;
const STARTED_AT_MS = 3;
const TIME_COUNT = 4;

/** Creates a song player that keeps a song's time, and has `driver` write it. */
function createDrivenPlayer<S extends PlayableSong>(driver: SongDriver<S>): SongPlayer<S> {
    let song: S | undefined;
    let queued: S | undefined;
    let tempoScale = 1;
    // The tempo scale the driver was last told
    let sentScale = 1;

    // Where the song is: the next row to play, and its time
    let orderIndex = 0;
    let row = 0;
    let isAtEnd = false;
    // The row played last, which `orderIndex` and `row` report
    let playingOrderIndex = 0;
    let playingRow = 0;
    // A row's length, the song time played to, the next row's place on the grid, and the chip time the song
    // started at, before which `update` counts no time. They are kept in a typed array, because V8 boxes a
    // double kept in a closure variable each time it is written, and these are written every tick
    const times = new Float64Array(TIME_COUNT);

    const player: SongPlayer<S> = {
        get song() {
            return song;
        },
        get isPlaying() {
            return song !== undefined;
        },
        get beat() {
            return song === undefined ? 0 : times[SONG_MS] * song.bpm / 60000;
        },
        get orderIndex() {
            return song === undefined ? 0 : playingOrderIndex;
        },
        get row() {
            return song === undefined ? 0 : playingRow;
        },
        get tempoScale() {
            return tempoScale;
        },
        set tempoScale(value) {
            tempoScale = Number.isFinite(value) && value > 0 ? value : 0;
        },

        play(next) {
            queued = undefined;
            if (song !== undefined) driver.release(song, driver.time);
            start(next, driver.time);
        },

        queue(next) {
            if (song === undefined) start(next, driver.time);
            else queued = next;
        },

        stop() {
            queued = undefined;
            if (song === undefined) return;
            driver.release(song, driver.time);
            driver.finish(driver.time);
            song = undefined;
        },

        update(deltaMs) {
            if (song === undefined || !(deltaMs > 0 && Number.isFinite(deltaMs))) return;
            const time = driver.time;
            // The time this update covers. If `play` or `queue` started the song earlier in this
            // update step, it covers only the time from the song's start
            let stamp = time - deltaMs;
            let coveredMs = deltaMs;
            if (stamp < times[STARTED_AT_MS]) {
                stamp = times[STARTED_AT_MS];
                coveredMs = time - times[STARTED_AT_MS];
            }
            const scale = tempoScale;
            if (scale !== sentScale) {
                sentScale = scale;
                driver.changeTempoScale(song, stamp, scale);
            }
            if (scale === 0 || coveredMs <= 0) return;

            let remaining = coveredMs * scale;
            for (;;) {
                // The next row's time: its place on the grid, plus the swing's delay on an odd row of its
                // pattern. Worked out here without a choice between doubles, which would make V8 box one
                const at = times[NEXT_ROW_MS] + (isAtEnd ? 0 : row % 2) * song.swing * times[ROW_MS];
                if (at > times[SONG_MS] + remaining) {
                    times[SONG_MS] += remaining;
                    break;
                }
                const step = at > times[SONG_MS] ? at - times[SONG_MS] : 0;
                stamp += step / scale;
                remaining -= step;
                times[SONG_MS] = at;
                if (!isAtEnd) {
                    playRow(stamp);
                    continue;
                }
                const next = queued;
                if (next === undefined && song.loop >= 0) {
                    // Go back to the loop point. Its first row is due now, so the next turn of this loop plays it at once
                    orderIndex = song.loop;
                    row = 0;
                    isAtEnd = false;
                    continue;
                }
                driver.release(song, stamp);
                queued = undefined;
                if (next === undefined) {
                    driver.finish(stamp);
                    song = undefined;
                    break;
                }
                start(next, stamp);
            }
        },

        refresh() {
            driver.refresh();
        },
    };

    return player;

    /** Starts `next` at chip time `stamp`, with its settings and then its first row. It runs once a song, so it is not on the hot path. */
    function start(next: S, stamp: number): void {
        song = next;
        orderIndex = 0;
        row = 0;
        times[ROW_MS] = 60000 / (next.bpm * next.rowsPerBeat);
        times[SONG_MS] = 0;
        times[NEXT_ROW_MS] = 0;
        isAtEnd = false;
        times[STARTED_AT_MS] = stamp;
        driver.start(next, stamp, tempoScale);
        playRow(stamp);
    }

    /** Has the driver write the row at the cursor, at chip time `stamp`, and moves the cursor on. */
    function playRow(stamp: number): void {
        if (song === undefined) return;
        driver.playRow(song, orderIndex, row, stamp, computeRowLengthMs(), tempoScale);
        playingOrderIndex = orderIndex;
        playingRow = row;
        advanceRow();
    }

    /** How late swing plays row `index` of a pattern, in song ms. Only odd rows are late. */
    function computeSwingDelayMs(index: number): number {
        return song === undefined || index % 2 === 0 ? 0 : song.swing * times[ROW_MS];
    }

    /**
     * How long the row at the cursor lasts, in song ms. It runs from the row's
     * start, which swing may delay, to the next row's start or the end.
     */
    function computeRowLengthMs(): number {
        if (song === undefined) return times[ROW_MS];
        const rowCount = song.patterns[song.order[orderIndex].pattern].rowCount;
        // The next row is row + 1 of this pattern, or row 0 of the next one, which is never late
        const nextDelayMs = row + 1 < rowCount ? computeSwingDelayMs(row + 1) : 0;
        return times[ROW_MS] + nextDelayMs - computeSwingDelayMs(row);
    }

    /** Moves the cursor to the next row on the grid, or to the end of the order. */
    function advanceRow(): void {
        if (song === undefined) return;
        times[NEXT_ROW_MS] += times[ROW_MS];
        row++;
        if (row < song.patterns[song.order[orderIndex].pattern].rowCount) return;
        row = 0;
        orderIndex++;
        if (orderIndex >= song.order.length) isAtEnd = true;
    }
}

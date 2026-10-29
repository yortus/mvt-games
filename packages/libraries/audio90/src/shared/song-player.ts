import { type CheckedSong, type CheckedSongPlay, DEFAULT_SONG_PLAY } from './check-song-play';
import type { SongPattern, SongTiming } from './notation';
import type { SongCallbacks } from './song-callbacks';
import type { SongSequencer } from './sound-chip';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What the song player reads of any chip's song: its timing, its swing and its loop, and its notes, which a play's options are checked against. */
export interface PlayableSong extends SongTiming, CheckedSong {
    readonly patterns: readonly SongPattern[];
    /** How late each odd-numbered row of a pattern plays, as a share of a row, from 0 to 0.5. */
    readonly swing: number;
    /** The index in `order` to go back to at the end, or -1 to play once. */
    readonly loop: number;
}

/**
 * The ids a chip's commands name its sounds by. The first time a sound is
 * given an id, it is defined for the chip, as the chip's code says. `Sound`
 * is the chip's sound type.
 */
export interface SoundIds<Sound> {
    /** The id the chip's commands name `sound` by. The first time, it defines the sound for the chip. */
    soundId: (sound: Sound) => number;
    /** Forgets every id, as the chip forgets every sound it was given. Each is defined again as it is next used. */
    forget: () => void;
}

/**
 * What a song writes to its chip through: the chip's commands, each stamped
 * with the chip time it applies at, and the ids the commands name its sounds
 * by. `Sound` is the chip's sound type.
 */
export interface SongWriter<Sound> extends Pick<SoundIds<Sound>, 'soundId'> {
    /** The chip's time now, in ms. */
    readonly time: number;
    /** Writes one command, laid out as `COMMAND_STRIDE` describes. */
    write: (op: number, stamp: number, a: number, b: number, c: number, d: number) => void;
}

/**
 * What a chip's songs write, for the song player, which keeps their time.
 * The player calls each method with the chip time the writes are stamped
 * with, and the driver writes them to its chip at once.
 */
export interface SongDriver<S extends PlayableSong> {
    /** The chip's clock, in ms. */
    readonly time: number;
    /** Writes `song`'s settings as it starts, to play `pitch` semitones up from its notes. Its first row follows. */
    start: (song: S, stamp: number, tempoScale: number, pitch: number) => void;
    /** Writes row `row` of order entry `orderIndex`, which lasts `lengthMs` of song time. */
    playRow: (song: S, orderIndex: number, row: number, stamp: number, lengthMs: number, tempoScale: number) => void;
    /** Writes what a new tempo scale changes, such as the channels' slides. */
    changeTempoScale: (song: S, stamp: number, tempoScale: number) => void;
    /** Releases every channel of `song`. */
    release: (song: S, stamp: number) => void;
    /**
     * Fades the chip's whole output over `ms`: in from near silence, or out
     * from where it is. A fade-out over 0 ms cuts every voice at once, and
     * puts the chip back at full volume.
     */
    fade: (stamp: number, isIn: boolean, ms: number) => void;
}

/**
 * Plays one song at a time, playing channel n on voice n, on either chip. It
 * runs where the chip's sound is made: in a browser, on the audio thread,
 * where the sequencer moves it on by each block the sound card asks for; in
 * a headless chip, with the chip's clock.
 *
 * Each call writes at once, at the driver's time. `update` advances the
 * song, and writes the notes that fall in the time it covers, each stamped
 * with its exact time. Call it after the chip's clock has advanced by the
 * same `deltaMs`. What it reports is where the song is on the chip's clock:
 * the row whose notes were written last.
 */
export interface SongPlayer<S extends PlayableSong> extends SongSequencer<S> {
    /**
     * Advances the song by `deltaMs`, and writes the notes that fall in that
     * time. `deltaMs` must be finite. Does nothing for a `deltaMs` of 0 or
     * less.
     */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * How a song player plays: the driver that writes its songs, and what it
 * calls as it writes each row and as a song ends by itself. It calls them at
 * once, inside `play`, `queue` and `update`, so a chip that must not call
 * the page's callbacks there holds them until it can.
 */
export interface SongPlayerOptions<S extends PlayableSong> extends SongCallbacks<S> {
    /** What writes the songs to the chip. */
    readonly driver: SongDriver<S>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a song player that keeps a song's time, and has its driver write it, with no song playing. */
export function createSongPlayer<S extends PlayableSong>(options: SongPlayerOptions<S>): SongPlayer<S> {
    const { driver, onRow, onEnded } = options;
    let song: S | undefined;
    let queued: S | undefined;
    // How the song queued plays, and how many more times the song playing goes back to its loop
    let queuedPlay = DEFAULT_SONG_PLAY;
    let repeatsLeft = Infinity;
    // Whether the song is fading out to stop, and whether the chip may be below full volume from a fade-out,
    // until it is cut
    let isFadingOut = false;
    let isFaded = false;
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

        play(next, play = DEFAULT_SONG_PLAY) {
            queued = undefined;
            if (song !== undefined) driver.release(song, driver.time);
            isFadingOut = false;
            start(next, play, driver.time);
        },

        queue(next, play = DEFAULT_SONG_PLAY) {
            if (song === undefined) {
                start(next, play, driver.time);
                return;
            }
            queued = next;
            queuedPlay = play;
        },

        stop(fadeMs = 0) {
            queued = undefined;
            if (song === undefined) return;
            const time = driver.time;
            if (fadeMs > 0) {
                // The song plays on as the chip fades, and stops as the fade ends
                isFadingOut = true;
                isFaded = true;
                times[FADE_END_MS] = time + fadeMs;
                driver.fade(time, false, fadeMs);
                return;
            }
            // A fade under way runs on to silence, taking the released notes with it
            driver.release(song, time);
            song = undefined;
            isFadingOut = false;
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
            if (scale > 0 && coveredMs > 0) {
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
                    // Nothing more is written once a fade-out has ended
                    if (isFadingOut && stamp >= times[FADE_END_MS]) break;
                    if (!isAtEnd) {
                        playRow(stamp);
                        continue;
                    }
                    const next = queued;
                    if (next === undefined && song.loop >= 0 && repeatsLeft > 0) {
                    // Go back to the loop point. Its first row is due now, so the next turn of this loop plays it at once
                        repeatsLeft--;
                        orderIndex = song.loop;
                        row = 0;
                        isAtEnd = false;
                        continue;
                    }
                    driver.release(song, stamp);
                    queued = undefined;
                    if (next === undefined) {
                        const ended = song;
                        song = undefined;
                        // A song that reaches its end as it fades out was stopped, so it doesn't end by itself
                        if (!isFadingOut) onEnded?.(ended);
                        isFadingOut = false;
                        break;
                    }
                    start(next, queuedPlay, stamp);
                }
            }
            if (isFadingOut && time >= times[FADE_END_MS]) endFadeOut();
        },
    };

    return player;

    /** Starts `next` at chip time `stamp`, as `play` says, with its settings and then its first row. It runs once a song, so it is not on the hot path. */
    function start(next: S, play: CheckedSongPlay, stamp: number): void {
        // A song never plays into a fade-out meant for the one before, so whatever that left sounding is cut
        if (isFaded) driver.fade(stamp, false, 0);
        isFaded = false;
        isFadingOut = false;
        if (play.fadeMs > 0) driver.fade(stamp, true, play.fadeMs);
        song = next;
        repeatsLeft = play.repeat;
        orderIndex = 0;
        row = 0;
        times[ROW_MS] = 60000 / (next.bpm * next.rowsPerBeat);
        times[SONG_MS] = 0;
        times[NEXT_ROW_MS] = 0;
        isAtEnd = false;
        times[STARTED_AT_MS] = stamp;
        driver.start(next, stamp, tempoScale, play.pitch);
        playRow(stamp);
    }

    /** Ends a fade-out as the chip reaches silence: cuts every voice, and starts the song queued, if there is one. */
    function endFadeOut(): void {
        if (song === undefined) return;
        const stamp = times[FADE_END_MS];
        driver.release(song, stamp);
        driver.fade(stamp, false, 0);
        isFaded = false;
        isFadingOut = false;
        const next = queued;
        queued = undefined;
        if (next === undefined) song = undefined;
        else start(next, queuedPlay, stamp);
    }

    /** Has the driver write the row at the cursor, at chip time `stamp`, and moves the cursor on. */
    function playRow(stamp: number): void {
        if (song === undefined) return;
        driver.playRow(song, orderIndex, row, stamp, computeRowLengthMs(), tempoScale);
        playingOrderIndex = orderIndex;
        playingRow = row;
        onRow?.(song, orderIndex, row);
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

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// Each of the player's times' place in its `times`
const ROW_MS = 0;
const SONG_MS = 1;
const NEXT_ROW_MS = 2;
const STARTED_AT_MS = 3;
const FADE_END_MS = 4;
const TIME_COUNT = 5;

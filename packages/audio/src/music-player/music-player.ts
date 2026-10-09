import type { Audio80 } from '../chip';
import {
    COMMAND_STRIDE,
    toCutoff,
    ECHO_SETTINGS,
    FILTER_SETTING_INDEX,
    FILTER_MODES,
    FILTER_SETTINGS,
    type FilterSetting,
    OP_NOTE_OFF,
    OP_NOTE_ON,
    OP_RESERVE_VOICES,
    OP_SET_ECHO,
    OP_SET_FILTER,
    OP_SET_VOICE,
    VOICE_COUNT,
    VOICE_SETTING_INDEX,
    VOICE_SETTINGS,
    type VoiceSetting,
} from '../core';
import {
    CELL_ARPEGGIO,
    CELL_FILTER,
    CELL_GLIDE,
    CELL_INSTRUMENT,
    CELL_IS_OWN_NOTE,
    CELL_NOTE,
    CELL_PULSE,
    CELL_SLIDE,
    CELL_STRIDE,
    CELL_VIBRATO,
    CELL_VOLUME,
    type Instrument,
    RELEASE,
    type Song,
} from '../notation';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Plays one song at a time, playing channel n on voice n. Its place in the
 * song is presentation state of the audio view that owns it. The view's update
 * step calls `update`, which advances the song and queues the notes that fall
 * in the time it covers. Each note is stamped with its exact chip time. The
 * view's refresh step calls `refresh`, which writes the queued notes to the
 * chip.
 *
 * So the song pauses when the view does, and keeps the same timing at any
 * frame rate. It follows the game through `tempoScale` and the songs the view
 * plays.
 *
 * Call `update` after the chip's clock has advanced by the same `deltaMs`.
 * The game loop advances the clock before it updates the views.
 */
export interface MusicPlayer {
    /** The song playing, or undefined once it ends or is stopped. */
    readonly song: Song | undefined;
    /** Whether a song is playing. It is true while `song` is defined, even while a `tempoScale` of 0 holds it still. */
    readonly isPlaying: boolean;
    /** Where the song is, in beats from its start. Views can use it to move in time with the music. */
    readonly beat: number;
    /**
     * A multiplier on the song's tempo, where 1 plays it at its own tempo. 0
     * holds the song where it is. Its notes ring on as their envelopes allow,
     * and its slides stop. This suits music that plays only while something
     * moves. A negative or non-finite value acts as 0. Set it in the view's
     * update step, before calling `update`. `update` then plays the time it
     * covers at the new tempo.
     */
    tempoScale: number;
    /** Starts `song` from its beginning now, releasing any song playing. */
    play: (song: Song) => void;
    /**
     * Plays `song` without a gap when the song playing reaches the end of its
     * order, even if that song loops. If no song is playing, it plays `song`
     * at once.
     */
    queue: (song: Song) => void;
    /** Releases the song's notes, gives its voices back to effects, and stops. */
    stop: () => void;
    /**
     * Advances the song by `deltaMs`, and queues the notes that fall in that
     * time. `deltaMs` must be finite. Does nothing for a `deltaMs` of 0 or
     * less. Call it from the view's update step.
     */
    update: (deltaMs: number) => void;
    /** Writes the queued notes to the chip. Call it from the view's refresh step. */
    refresh: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What `createMusicPlayer` needs. */
export interface MusicPlayerOptions {
    /** The chip it plays on. Its notes are stamped with this chip's clock. */
    readonly audio80: Audio80;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a music player with no song playing. */
export function createMusicPlayer(options: MusicPlayerOptions): MusicPlayer {
    const { audio80 } = options;

    let song: Song | undefined;
    let queued: Song | undefined;
    let tempoScale = 1;
    // The tempo scale the sliding channels' rates were last sent at
    let sentScale = 1;

    // Where the song is: the next row to play, and its time
    let orderIndex = 0;
    let row = 0;
    let rowMs = 0;
    let songMs = 0;
    let nextRowMs = 0;
    let isAtEnd = false;
    // The chip time the song started at. `update` counts no time before it
    let startedAtMs = 0;
    const channelInstrument = new Int32Array(VOICE_COUNT);
    // Each channel's slide, in semitones a second at a tempo scale of 1, or 0 if it is not sliding
    const channelSlideRate = new Float64Array(VOICE_COUNT);

    // Every instrument of every song played, so a queued note can name its instrument by number
    const instruments: Instrument[] = [];
    let slots: number[] = [];

    // Writes waiting for `refresh`, stored as numbers laid out as the chip's commands are
    let pending = new Float64Array(64 * COMMAND_STRIDE);
    let pendingCount = 0;

    const player: MusicPlayer = {
        get song() {
            return song;
        },
        get isPlaying() {
            return song !== undefined;
        },
        get beat() {
            return song === undefined ? 0 : songMs * song.bpm / 60000;
        },
        get tempoScale() {
            return tempoScale;
        },
        set tempoScale(value) {
            tempoScale = Number.isFinite(value) && value > 0 ? value : 0;
        },

        play(next) {
            if (song !== undefined) releaseChannels(audio80.time);
            start(next, audio80.time);
        },

        queue(next) {
            if (song === undefined) start(next, audio80.time);
            else queued = next;
        },

        stop() {
            queued = undefined;
            if (song === undefined) return;
            releaseChannels(audio80.time);
            push(OP_RESERVE_VOICES, audio80.time, 0, 0, 0, 0);
            song = undefined;
        },

        update(deltaMs) {
            if (song === undefined || !(deltaMs > 0 && Number.isFinite(deltaMs))) return;
            // The time this update covers. If `play` or `queue` started the song earlier in this
            // update step, it covers only the time from the song's start
            let stamp = audio80.time - deltaMs;
            let coveredMs = deltaMs;
            if (stamp < startedAtMs) {
                stamp = startedAtMs;
                coveredMs = audio80.time - startedAtMs;
            }
            const scale = tempoScale;
            if (scale !== sentScale) sendSlideRates(stamp);
            if (scale === 0 || coveredMs <= 0) return;

            let remaining = coveredMs * scale;
            for (;;) {
                const at = isAtEnd ? nextRowMs : computeRowTime();
                if (at > songMs + remaining) {
                    songMs += remaining;
                    break;
                }
                const step = at > songMs ? at - songMs : 0;
                stamp += step / scale;
                remaining -= step;
                songMs = at;
                if (!isAtEnd) {
                    playRow(stamp);
                    advanceRow();
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
                releaseChannels(stamp);
                queued = undefined;
                if (next === undefined) {
                    push(OP_RESERVE_VOICES, stamp, 0, 0, 0, 0);
                    song = undefined;
                    break;
                }
                start(next, stamp);
            }
        },

        refresh() {
            for (let i = 0; i < pendingCount; i++) {
                const at = i * COMMAND_STRIDE;
                const stamp = pending[at + 1];
                const a = pending[at + 2];
                const b = pending[at + 3];
                const c = pending[at + 4];
                const d = pending[at + 5];
                switch (pending[at]) {
                    case OP_NOTE_ON:
                        audio80.noteOn(a, instruments[b], c, d, stamp);
                        break;
                    case OP_NOTE_OFF:
                        audio80.noteOff(a, stamp);
                        break;
                    case OP_SET_VOICE:
                        // The player never sets a voice's wave. Its instruments do that
                        audio80.setVoice(a, VOICE_SETTINGS[b] as Exclude<VoiceSetting, 'wave'>, c, stamp);
                        break;
                    case OP_SET_FILTER:
                        // A mode is held as its index in FILTER_MODES
                        if (b === FILTER_SETTING_INDEX.mode) audio80.setFilter(a === 0 ? 'a' : 'b', 'mode', FILTER_MODES[c], stamp);
                        else audio80.setFilter(a === 0 ? 'a' : 'b', FILTER_SETTINGS[b] as Exclude<FilterSetting, 'mode'>, c, stamp);
                        break;
                    case OP_SET_ECHO:
                        audio80.setEcho(ECHO_SETTINGS[a], b, stamp);
                        break;
                    case OP_RESERVE_VOICES:
                        audio80.reserveVoices(a, stamp);
                        break;
                }
            }
            pendingCount = 0;
        },
    };

    return player;

    // ---- The song -----------------------------------------------------------

    /** Starts `next` at chip time `stamp`, with its settings and then its first row. It runs once a song, so it is not on the hot path. */
    function start(next: Song, stamp: number): void {
        song = next;
        orderIndex = 0;
        row = 0;
        rowMs = 60000 / (next.bpm * next.rowsPerBeat);
        songMs = 0;
        nextRowMs = 0;
        isAtEnd = false;
        startedAtMs = stamp;
        channelInstrument.fill(-1);
        channelSlideRate.fill(0);
        slots = next.instruments.map((instrument) => {
            const known = instruments.indexOf(instrument);
            return known >= 0 ? known : instruments.push(instrument) - 1;
        });

        push(OP_RESERVE_VOICES, stamp, next.channelCount, 0, 0, 0);
        for (let f = 0; f < 2; f++) {
            const settings = next.filters[f];
            if (settings === undefined) continue;
            push(OP_SET_FILTER, stamp, f, FILTER_SETTING_INDEX.mode, FILTER_MODES.indexOf(settings.mode), 0);
            push(OP_SET_FILTER, stamp, f, FILTER_SETTING_INDEX.cutoffHz, settings.cutoffHz, 0);
            push(OP_SET_FILTER, stamp, f, FILTER_SETTING_INDEX.resonance, settings.resonance ?? 0, 0);
            push(OP_SET_FILTER, stamp, f, FILTER_SETTING_INDEX.drive, settings.drive ?? 0, 0);
        }
        if (next.echo !== undefined) {
            push(OP_SET_ECHO, stamp, 0, next.echo.timeMs, 0, 0);
            push(OP_SET_ECHO, stamp, 1, next.echo.feedback ?? DEFAULT_ECHO_FEEDBACK, 0, 0);
            push(OP_SET_ECHO, stamp, 2, next.echo.level ?? DEFAULT_ECHO_LEVEL, 0, 0);
        }
        playRow(stamp);
        advanceRow();
    }

    /**
     * The song time of the next row, in ms. It is the row's place on the grid,
     * plus the swing's delay if it is an odd row of its pattern.
     */
    function computeRowTime(): number {
        return song === undefined ? nextRowMs : nextRowMs + computeSwingDelayMs(row);
    }

    /** How late swing plays row `index` of a pattern, in song ms. Only odd rows are late. */
    function computeSwingDelayMs(index: number): number {
        return song === undefined || index % 2 === 0 ? 0 : song.swing * rowMs;
    }

    /**
     * How long the row at the cursor lasts, in song ms. It runs from the row's
     * start, which swing may delay, to the next row's start or the end.
     */
    function computeRowLengthMs(): number {
        if (song === undefined) return rowMs;
        const rowCount = song.patterns[song.order[orderIndex].pattern].rowCount;
        // The next row is row + 1 of this pattern, or row 0 of the next one, which is never late
        const nextDelayMs = row + 1 < rowCount ? computeSwingDelayMs(row + 1) : 0;
        return rowMs + nextDelayMs - computeSwingDelayMs(row);
    }

    /** Moves the cursor to the next row on the grid, or to the end of the order. */
    function advanceRow(): void {
        if (song === undefined) return;
        nextRowMs += rowMs;
        row++;
        if (row < song.patterns[song.order[orderIndex].pattern].rowCount) return;
        row = 0;
        orderIndex++;
        if (orderIndex >= song.order.length) isAtEnd = true;
    }

    /** Queues the writes for the row at the cursor, at `stamp`. */
    function playRow(stamp: number): void {
        if (song === undefined) return;
        const entry = song.order[orderIndex];
        const cells = song.patterns[entry.pattern].cells;
        const channels = song.channelCount;
        const songVolume = song.volume;
        const scale = tempoScale;
        const lengthMs = computeRowLengthMs();
        // The row's length in chip time, for glides. While the song is held, use its length in song time
        const glideMs = scale > 0 ? lengthMs / scale : lengthMs;
        for (let channel = 0; channel < channels; channel++) {
            const at = (row * channels + channel) * CELL_STRIDE;
            const note = cells[at + CELL_NOTE];
            const cellInstrument = cells[at + CELL_INSTRUMENT];
            if (cellInstrument >= 0) channelInstrument[channel] = cellInstrument;
            const instrument = channelInstrument[channel];
            const volume = cells[at + CELL_VOLUME];
            const slide = cells[at + CELL_SLIDE];

            if (channelSlideRate[channel] !== 0 && slide === 0) {
                push(OP_SET_VOICE, stamp, channel, VOICE_SETTING_INDEX.slide, 0, 0);
                channelSlideRate[channel] = 0;
            }
            if (note >= 0 && instrument >= 0) {
                const played = note + (cells[at + CELL_IS_OWN_NOTE] === 1 ? 0 : entry.transpose);
                push(OP_NOTE_ON, stamp, channel, slots[instrument], played, (volume >= 0 ? volume / 15 : 1) * songVolume);
                if (cells[at + CELL_GLIDE] === 1) push(OP_SET_VOICE, stamp, channel, VOICE_SETTING_INDEX.glide, glideMs, 0);
            }
            else if (note === RELEASE) {
                push(OP_NOTE_OFF, stamp, channel, 0, 0, 0);
            }
            else if (volume >= 0) {
                push(OP_SET_VOICE, stamp, channel, VOICE_SETTING_INDEX.volume, volume / 15 * songVolume, 0);
            }

            const arpeggio = cells[at + CELL_ARPEGGIO];
            if (arpeggio >= 0) push(OP_SET_VOICE, stamp, channel, VOICE_SETTING_INDEX.arpeggio, arpeggio, 0);
            const vibrato = cells[at + CELL_VIBRATO];
            if (vibrato >= 0) {
                push(OP_SET_VOICE, stamp, channel, VOICE_SETTING_INDEX.vibratoDepth, Math.floor(vibrato / 16) / 8, 0);
                push(OP_SET_VOICE, stamp, channel, VOICE_SETTING_INDEX.vibratoRate, vibrato % 16, 0);
            }
            if (slide !== 0) {
                // The rate that covers the slide over the row at a tempo scale of 1. `sendSlideRates`
                // rescales it if the tempo changes mid-row
                const rate = slide * 1000 / lengthMs;
                channelSlideRate[channel] = rate;
                push(OP_SET_VOICE, stamp, channel, VOICE_SETTING_INDEX.slide, rate * scale, 0);
            }
            const pulse = cells[at + CELL_PULSE];
            if (pulse >= 0) push(OP_SET_VOICE, stamp, channel, VOICE_SETTING_INDEX.pulseWidth, pulse / 16, 0);
            const filter = cells[at + CELL_FILTER];
            const filterId = instrument >= 0 ? song.instruments[instrument].filter : undefined;
            if (filter >= 0 && filterId !== undefined) {
                push(OP_SET_FILTER, stamp, filterId === 'a' ? 0 : 1, FILTER_SETTING_INDEX.cutoffHz, toCutoff(filter), 0);
            }
        }
    }

    /** Queues each sliding channel's rate at the current tempo scale, from `stamp`. A scale of 0 stops a slide while the song is held. */
    function sendSlideRates(stamp: number): void {
        sentScale = tempoScale;
        if (song === undefined) return;
        for (let channel = 0; channel < song.channelCount; channel++) {
            const rate = channelSlideRate[channel];
            if (rate !== 0) push(OP_SET_VOICE, stamp, channel, VOICE_SETTING_INDEX.slide, rate * sentScale, 0);
        }
    }

    function releaseChannels(stamp: number): void {
        if (song === undefined) return;
        for (let channel = 0; channel < song.channelCount; channel++) push(OP_NOTE_OFF, stamp, channel, 0, 0, 0);
    }

    // ---- The queue -----------------------------------------------------------

    function push(op: number, stamp: number, a: number, b: number, c: number, d: number): void {
        if ((pendingCount + 1) * COMMAND_STRIDE > pending.length) {
            const grown = new Float64Array(pending.length * 2);
            grown.set(pending);
            pending = grown;
        }
        const at = pendingCount * COMMAND_STRIDE;
        pending[at] = op;
        pending[at + 1] = stamp;
        pending[at + 2] = a;
        pending[at + 3] = b;
        pending[at + 4] = c;
        pending[at + 5] = d;
        pendingCount++;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_ECHO_FEEDBACK = 0.35;
const DEFAULT_ECHO_LEVEL = 0.5;

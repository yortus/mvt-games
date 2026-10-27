import {
    type Audio80Writer,
    type Audio80FilterSetting,
    type Audio80Sound,
    type Audio80Song,
    type Audio80VoiceSetting,
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
    ECHO_SETTINGS,
    FILTER_MODES,
    FILTER_SETTING_INDEX,
    FILTER_SETTINGS,
    OP_NOTE_OFF,
    OP_NOTE_ON,
    OP_RESERVE_VOICES,
    OP_SET_ECHO,
    OP_SET_FILTER,
    OP_SET_VOICE,
    RELEASE,
    toCutoff,
    VOICE_COUNT,
    VOICE_SETTING_INDEX,
    VOICE_SETTINGS,
} from '../audio80';
import { COMMAND_STRIDE } from '../shared';
import type { SongDriver } from './song-driver';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What the Audio80's song driver plays on. */
export interface Audio80SongDriverOptions {
    readonly audio80: Audio80Writer;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates what the song player needs to play Audio80 songs on `audio80`. It
 * keeps each write as numbers laid out as the chip's commands are, and makes
 * the calls on the chip as the player refreshes.
 */
export function createAudio80SongDriver(options: Audio80SongDriverOptions): SongDriver<Audio80Song> {
    const { audio80 } = options;
    const channelInstrument = new Int32Array(VOICE_COUNT);
    // Each channel's slide, in semitones a second at a tempo scale of 1, or 0 if it is not sliding
    const channelSlideRate = new Float64Array(VOICE_COUNT);
    // Every instrument of every song played, so a queued note can name its instrument by number
    const instruments: Audio80Sound[] = [];
    let slots: number[] = [];

    // Writes waiting for `refresh`, stored as numbers laid out as the chip's commands are
    let pending = new Float64Array(64 * COMMAND_STRIDE);
    let pendingCount = 0;

    return {
        get time() {
            return audio80.time;
        },

        start(song, stamp) {
            channelInstrument.fill(-1);
            channelSlideRate.fill(0);
            slots = song.instruments.map((instrument) => {
                const known = instruments.indexOf(instrument);
                return known >= 0 ? known : instruments.push(instrument) - 1;
            });
            push(OP_RESERVE_VOICES, stamp, song.channelCount, 0, 0, 0);
            for (let f = 0; f < 2; f++) {
                const settings = song.filters[f];
                if (settings === undefined) continue;
                push(OP_SET_FILTER, stamp, f, FILTER_SETTING_INDEX.mode, FILTER_MODES.indexOf(settings.mode), 0);
                push(OP_SET_FILTER, stamp, f, FILTER_SETTING_INDEX.cutoffHz, settings.cutoffHz, 0);
                push(OP_SET_FILTER, stamp, f, FILTER_SETTING_INDEX.resonance, settings.resonance ?? 0, 0);
                push(OP_SET_FILTER, stamp, f, FILTER_SETTING_INDEX.drive, settings.drive ?? 0, 0);
            }
            if (song.echo !== undefined) {
                push(OP_SET_ECHO, stamp, 0, song.echo.timeMs, 0, 0);
                push(OP_SET_ECHO, stamp, 1, song.echo.feedback ?? DEFAULT_ECHO_FEEDBACK, 0, 0);
                push(OP_SET_ECHO, stamp, 2, song.echo.level ?? DEFAULT_ECHO_LEVEL, 0, 0);
            }
        },

        playRow(song, orderIndex, row, stamp, lengthMs, scale) {
            const entry = song.order[orderIndex];
            const cells = song.patterns[entry.pattern].cells;
            const channels = song.channelCount;
            const songVolume = song.volume;
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
                    // The rate that covers the slide over the row at a tempo scale of 1. `changeTempoScale`
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
        },

        changeTempoScale(song, stamp, scale) {
            // Each sliding channel's rate at the new scale. A scale of 0 stops a slide while the song is held
            for (let channel = 0; channel < song.channelCount; channel++) {
                const rate = channelSlideRate[channel];
                if (rate !== 0) push(OP_SET_VOICE, stamp, channel, VOICE_SETTING_INDEX.slide, rate * scale, 0);
            }
        },

        release(song, stamp) {
            for (let channel = 0; channel < song.channelCount; channel++) push(OP_NOTE_OFF, stamp, channel, 0, 0, 0);
        },

        finish(stamp) {
            push(OP_RESERVE_VOICES, stamp, 0, 0, 0, 0);
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
                        audio80.setVoice(a, VOICE_SETTINGS[b] as Exclude<Audio80VoiceSetting, 'wave'>, c, stamp);
                        break;
                    case OP_SET_FILTER:
                        // A mode is held as its index in FILTER_MODES
                        if (b === FILTER_SETTING_INDEX.mode) audio80.setFilter(a === 0 ? 'a' : 'b', 'mode', FILTER_MODES[c], stamp);
                        else audio80.setFilter(a === 0 ? 'a' : 'b', FILTER_SETTINGS[b] as Exclude<Audio80FilterSetting, 'mode'>, c, stamp);
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

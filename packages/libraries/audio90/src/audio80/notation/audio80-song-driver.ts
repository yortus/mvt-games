import {
    CELL_ARPEGGIO,
    CELL_GLIDE,
    CELL_INSTRUMENT,
    CELL_IS_OWN_NOTE,
    CELL_NOTE,
    CELL_PULSE,
    CELL_SLIDE,
    CELL_VIBRATO,
    CELL_VOLUME,
    OP_FADE,
    OP_NOTE_OFF,
    OP_NOTE_ON,
    OP_SET_VOICE,
    RELEASE,
    type SongDriver,
    type SongWriter,
} from '../../shared';
import {
    AUDIO80_ECHO_DEFAULTS,
    AUDIO80_ECHO_SETTING_INDEX,
    AUDIO80_FILTER_SETTING_INDEX,
    OP80_SET_ECHO,
    OP80_SET_FILTER,
    toCutoff,
    toFilterModeFlags,
    AUDIO80_VOICE_COUNT,
    AUDIO80_VOICE_SETTING_INDEX,
} from '../synthesiser';
import type { Audio80Sound } from './audio80-sound';
import { type Audio80Song, CELL80_FILTER, CELL80_STRIDE } from './audio80-song';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates what the song player needs to play Audio80 songs: what each song
 * writes as it starts, and each row's notes and effects, written to
 * `writer` as the chip's commands. The timing, which row plays when, is the
 * player's. Writing a row allocates nothing.
 */
export function createAudio80SongDriver(writer: SongWriter<Audio80Sound>): SongDriver<Audio80Song> {
    const write = writer.write;
    // Each channel's instrument, an index into the song's instruments, or -1 before one is named
    const channelInstrument = new Int32Array(AUDIO80_VOICE_COUNT);
    // Each channel's slide, in semitones a second at a tempo scale of 1, or 0 if it is not sliding
    const channelSlideRate = new Float64Array(AUDIO80_VOICE_COUNT);
    // The semitones the song playing is played up from its notes
    let pitch = 0;

    return {
        get time() {
            return writer.time;
        },

        start(song, stamp, _tempoScale, songPitch) {
            pitch = songPitch;
            channelInstrument.fill(-1);
            channelSlideRate.fill(0);
            for (let f = 0; f < 2; f++) {
                const settings = song.filters[f];
                if (settings === undefined) continue;
                write(OP80_SET_FILTER, stamp, f, AUDIO80_FILTER_SETTING_INDEX.mode, toFilterModeFlags(settings.mode), 0);
                write(OP80_SET_FILTER, stamp, f, AUDIO80_FILTER_SETTING_INDEX.cutoffHz, settings.cutoffHz, 0);
                write(OP80_SET_FILTER, stamp, f, AUDIO80_FILTER_SETTING_INDEX.resonance, settings.resonance ?? 0, 0);
                write(OP80_SET_FILTER, stamp, f, AUDIO80_FILTER_SETTING_INDEX.drive, settings.drive ?? 0, 0);
            }
            if (song.echo !== undefined) {
                write(OP80_SET_ECHO, stamp, AUDIO80_ECHO_SETTING_INDEX.timeMs, song.echo.timeMs, 0, 0);
                write(OP80_SET_ECHO, stamp, AUDIO80_ECHO_SETTING_INDEX.feedback, song.echo.feedback ?? AUDIO80_ECHO_DEFAULTS.feedback, 0, 0);
                write(OP80_SET_ECHO, stamp, AUDIO80_ECHO_SETTING_INDEX.level, song.echo.level ?? AUDIO80_ECHO_DEFAULTS.level, 0, 0);
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
                const at = (row * channels + channel) * CELL80_STRIDE;
                const note = cells[at + CELL_NOTE];
                const cellInstrument = cells[at + CELL_INSTRUMENT];
                if (cellInstrument >= 0) channelInstrument[channel] = cellInstrument;
                const instrument = channelInstrument[channel];
                const volume = cells[at + CELL_VOLUME];
                const slide = cells[at + CELL_SLIDE];

                if (channelSlideRate[channel] !== 0 && slide === 0) {
                    write(OP_SET_VOICE, stamp, channel, AUDIO80_VOICE_SETTING_INDEX.slide, 0, 0);
                    channelSlideRate[channel] = 0;
                }
                if (note >= 0 && instrument >= 0) {
                    const played = note + (cells[at + CELL_IS_OWN_NOTE] === 1 ? 0 : entry.transpose + pitch);
                    const soundId = writer.soundId(song.instruments[instrument]);
                    write(OP_NOTE_ON, stamp, channel, soundId, played, (volume >= 0 ? volume / 15 : 1) * songVolume);
                    if (cells[at + CELL_GLIDE] === 1) write(OP_SET_VOICE, stamp, channel, AUDIO80_VOICE_SETTING_INDEX.glide, glideMs, 0);
                }
                else if (note === RELEASE) {
                    write(OP_NOTE_OFF, stamp, channel, 0, 0, 0);
                }
                else if (volume >= 0) {
                    write(OP_SET_VOICE, stamp, channel, AUDIO80_VOICE_SETTING_INDEX.volume, volume / 15 * songVolume, 0);
                }

                const arpeggio = cells[at + CELL_ARPEGGIO];
                if (arpeggio >= 0) write(OP_SET_VOICE, stamp, channel, AUDIO80_VOICE_SETTING_INDEX.arpeggio, arpeggio, 0);
                const vibrato = cells[at + CELL_VIBRATO];
                if (vibrato >= 0) {
                    write(OP_SET_VOICE, stamp, channel, AUDIO80_VOICE_SETTING_INDEX.vibratoDepth, Math.floor(vibrato / 16) / 8, 0);
                    write(OP_SET_VOICE, stamp, channel, AUDIO80_VOICE_SETTING_INDEX.vibratoRate, vibrato % 16, 0);
                }
                if (slide !== 0) {
                    // The rate that covers the slide over the row at a tempo scale of 1. `changeTempoScale`
                    // rescales it if the tempo changes mid-row
                    const rate = slide * 1000 / lengthMs;
                    channelSlideRate[channel] = rate;
                    write(OP_SET_VOICE, stamp, channel, AUDIO80_VOICE_SETTING_INDEX.slide, rate * scale, 0);
                }
                const pulse = cells[at + CELL_PULSE];
                if (pulse >= 0) write(OP_SET_VOICE, stamp, channel, AUDIO80_VOICE_SETTING_INDEX.pulseWidth, pulse / 16, 0);
                const filter = cells[at + CELL80_FILTER];
                // The filter the instrument's notes go through: route 1 is filter a, and 2 is filter b
                const route = instrument >= 0 ? song.instruments[instrument].data.filter : 0;
                if (filter >= 0 && route > 0) write(OP80_SET_FILTER, stamp, route - 1, AUDIO80_FILTER_SETTING_INDEX.cutoffHz, toCutoff(filter), 0);
            }
        },

        changeTempoScale(song, stamp, scale) {
            // Each sliding channel's rate at the new scale. A scale of 0 stops a slide while the song is held
            for (let channel = 0; channel < song.channelCount; channel++) {
                const rate = channelSlideRate[channel];
                if (rate !== 0) write(OP_SET_VOICE, stamp, channel, AUDIO80_VOICE_SETTING_INDEX.slide, rate * scale, 0);
            }
        },

        release(song, stamp) {
            for (let channel = 0; channel < song.channelCount; channel++) write(OP_NOTE_OFF, stamp, channel, 0, 0, 0);
        },

        fade(stamp, isIn, ms) {
            write(OP_FADE, stamp, isIn ? 1 : 0, ms, 0, 0);
        },
    };
}

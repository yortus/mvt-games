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
    OP_NOTE_OFF,
    OP_NOTE_ON,
    OP_SET_VOICE,
    RELEASE,
    type SongDriver,
    type SongWriter,
} from '../../shared';
import {
    AUDIO90_CHARACTERS,
    AUDIO90_EFFECT_INDEX,
    AUDIO90_EFFECT_SETTING_INDEX,
    AUDIO90_VOICE_COUNT,
    AUDIO90_VOICE_SETTING_INDEX,
    OP90_SET_CHARACTER,
    OP90_SET_EFFECT,
    OP90_SET_TEMPO,
} from '../synthesiser';
import type { Audio90Sound } from './audio90-sound';
import {
    type Audio90Song,
    CELL90_ACCENT,
    CELL90_BRIGHTNESS,
    CELL90_CHORD,
    CELL90_ECHO,
    CELL90_PAN,
    CELL90_REVERB,
    CELL90_SLICE,
    CELL90_STRIDE,
} from './audio90-song';
import { toPan } from './to-pan';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates what the song player needs to play Audio90 songs: what each song
 * writes as it starts, and each row's notes and effects, written to
 * `writer` as the chip's commands. The timing, which row plays when, is the
 * player's, or a sample's bounce's. Writing a row allocates nothing.
 */
export function createAudio90SongDriver(writer: SongWriter<Audio90Sound>): SongDriver<Audio90Song> {
    const write = writer.write;
    // Each channel's instrument, an index into the song's instruments, or -1 before one is named
    const channelInstrument = new Int32Array(AUDIO90_VOICE_COUNT);
    // Each channel's slide, in semitones a second at a tempo scale of 1, or 0 if it is not sliding
    const channelSlideRate = new Float64Array(AUDIO90_VOICE_COUNT);

    return {
        get time() {
            return writer.time;
        },

        // The song's settings: its tempo, character, effects and pump, and each channel's pan and sends from its
        // mixer. It runs once a song, so it is not on a hot path
        start(song, stamp, tempoScale) {
            channelInstrument.fill(-1);
            channelSlideRate.fill(0);
            write(OP90_SET_TEMPO, stamp, song.bpm * tempoScale, 0, 0, 0);
            if (song.character !== undefined) write(OP90_SET_CHARACTER, stamp, AUDIO90_CHARACTERS.indexOf(song.character), 0, 0, 0);
            const { reverb, echo, chorus, pump } = song;
            if (reverb !== undefined) {
                setReverb(REVERB.size, reverb.size, stamp);
                setReverb(REVERB.decayMs, reverb.decayMs, stamp);
                setReverb(REVERB.damping, reverb.damping, stamp);
                setReverb(REVERB.level, reverb.level, stamp);
            }
            if (echo !== undefined) {
                // Setting `timeMs` times the echo in ms. Setting `timeBeats` after it times it in beats instead
                setEcho(ECHO.timeMs, echo.timeMs, stamp);
                if (echo.timeBeats > 0) setEcho(ECHO.timeBeats, echo.timeBeats, stamp);
                setEcho(ECHO.feedback, echo.feedback, stamp);
                setEcho(ECHO.toneHz, echo.toneHz, stamp);
                setEcho(ECHO.pingPong, echo.isPingPong ? 1 : 0, stamp);
                setEcho(ECHO.level, echo.level, stamp);
            }
            if (chorus !== undefined) {
                setChorus(CHORUS.depth, chorus.depth, stamp);
                setChorus(CHORUS.rateHz, chorus.rateHz, stamp);
                setChorus(CHORUS.level, chorus.level, stamp);
            }
            // A song with no pump turns off the one a song before it may have left
            setPump(PUMP.voice, pump === undefined ? -1 : pump.channel, stamp);
            if (pump !== undefined) {
                setPump(PUMP.depth, pump.depth, stamp);
                setPump(PUMP.releaseMs, pump.releaseMs, stamp);
            }
            for (let channel = 0; channel < song.channelCount; channel++) {
                const mix = song.mixer[channel];
                write(OP_SET_VOICE, stamp, channel, VOICE.pan, mix.pan, 0);
                write(OP_SET_VOICE, stamp, channel, VOICE.reverbSend, mix.reverb, 0);
                write(OP_SET_VOICE, stamp, channel, VOICE.echoSend, mix.echo, 0);
                write(OP_SET_VOICE, stamp, channel, VOICE.chorusSend, mix.chorus, 0);
                write(OP_SET_VOICE, stamp, channel, VOICE.brightness, 1, 0);
            }
        },

        playRow(song, orderIndex, row, stamp, lengthMs, tempoScale) {
            const entry = song.order[orderIndex];
            const cells = song.patterns[entry.pattern].cells;
            const channels = song.channelCount;
            const songVolume = song.volume;
            // The row's length in chip time, for glides. While the song is held, use its length in song time
            const glideMs = tempoScale > 0 ? lengthMs / tempoScale : lengthMs;
            for (let channel = 0; channel < channels; channel++) {
                const at = (row * channels + channel) * CELL90_STRIDE;
                const note = cells[at + CELL_NOTE];
                const named = cells[at + CELL_INSTRUMENT];
                if (named >= 0) channelInstrument[channel] = named;
                const instrument = channelInstrument[channel];
                const volume = cells[at + CELL_VOLUME];
                const slide = cells[at + CELL_SLIDE];

                // The channel's settings first, so a note on this row starts with them
                const pan = cells[at + CELL90_PAN];
                if (pan >= 0) write(OP_SET_VOICE, stamp, channel, VOICE.pan, toPan(pan), 0);
                const brightness = cells[at + CELL90_BRIGHTNESS];
                if (brightness >= 0) write(OP_SET_VOICE, stamp, channel, VOICE.brightness, brightness / 15, 0);
                const reverb = cells[at + CELL90_REVERB];
                if (reverb >= 0) write(OP_SET_VOICE, stamp, channel, VOICE.reverbSend, reverb / 15, 0);
                const echo = cells[at + CELL90_ECHO];
                if (echo >= 0) write(OP_SET_VOICE, stamp, channel, VOICE.echoSend, echo / 15, 0);

                if (channelSlideRate[channel] !== 0 && slide === 0) {
                    write(OP_SET_VOICE, stamp, channel, VOICE.slide, 0, 0);
                    channelSlideRate[channel] = 0;
                }
                if (note >= 0 && instrument >= 0) {
                    const played = note + (cells[at + CELL_IS_OWN_NOTE] === 1 ? 0 : entry.transpose);
                    const soundId = writer.soundId(song.instruments[instrument]);
                    write(OP_NOTE_ON, stamp, channel, soundId, played, (volume >= 0 ? volume / 15 : 1) * songVolume);
                    if (cells[at + CELL_GLIDE] === 1) write(OP_SET_VOICE, stamp, channel, VOICE.glide, glideMs, 0);
                }
                else if (note === RELEASE) {
                    write(OP_NOTE_OFF, stamp, channel, 0, 0, 0);
                }
                else if (volume >= 0) {
                    write(OP_SET_VOICE, stamp, channel, VOICE.volume, volume / 15 * songVolume, 0);
                }

                // These apply to the note playing, so they follow the note on
                if (cells[at + CELL90_ACCENT] === 1) write(OP_SET_VOICE, stamp, channel, VOICE.accent, 1, 0);
                const chord = cells[at + CELL90_CHORD];
                if (chord >= 0) write(OP_SET_VOICE, stamp, channel, VOICE.chord, chord, 0);
                const slice = cells[at + CELL90_SLICE];
                if (slice >= 0) write(OP_SET_VOICE, stamp, channel, VOICE.slice, slice, 0);
                const arpeggio = cells[at + CELL_ARPEGGIO];
                if (arpeggio >= 0) write(OP_SET_VOICE, stamp, channel, VOICE.arpeggio, arpeggio, 0);
                const vibrato = cells[at + CELL_VIBRATO];
                if (vibrato >= 0) {
                    write(OP_SET_VOICE, stamp, channel, VOICE.vibratoDepth, Math.floor(vibrato / 16) / 8, 0);
                    write(OP_SET_VOICE, stamp, channel, VOICE.vibratoRate, vibrato % 16, 0);
                }
                if (slide !== 0) {
                    // The rate that covers the slide over the row at a tempo scale of 1
                    const rate = slide * 1000 / lengthMs;
                    channelSlideRate[channel] = rate;
                    write(OP_SET_VOICE, stamp, channel, VOICE.slide, rate * tempoScale, 0);
                }
                const pulse = cells[at + CELL_PULSE];
                if (pulse >= 0) write(OP_SET_VOICE, stamp, channel, VOICE.pulseWidth, pulse / 16, 0);
            }
        },

        // The tempo, for the LFOs and the echo timed in beats, and each sliding channel's rate. A scale of 0 holds
        // the song still, so its slides stop and its LFOs timed in beats hold
        changeTempoScale(song, stamp, tempoScale) {
            write(OP90_SET_TEMPO, stamp, song.bpm * tempoScale, 0, 0, 0);
            for (let channel = 0; channel < song.channelCount; channel++) {
                const rate = channelSlideRate[channel];
                if (rate !== 0) write(OP_SET_VOICE, stamp, channel, VOICE.slide, rate * tempoScale, 0);
            }
        },

        release(song, stamp) {
            for (let channel = 0; channel < song.channelCount; channel++) write(OP_NOTE_OFF, stamp, channel, 0, 0, 0);
        },
    };

    function setReverb(setting: number, value: number, stamp: number): void {
        write(OP90_SET_EFFECT, stamp, AUDIO90_EFFECT_INDEX.reverb, setting, value, 0);
    }

    function setEcho(setting: number, value: number, stamp: number): void {
        write(OP90_SET_EFFECT, stamp, AUDIO90_EFFECT_INDEX.echo, setting, value, 0);
    }

    function setChorus(setting: number, value: number, stamp: number): void {
        write(OP90_SET_EFFECT, stamp, AUDIO90_EFFECT_INDEX.chorus, setting, value, 0);
    }

    function setPump(setting: number, value: number, stamp: number): void {
        write(OP90_SET_EFFECT, stamp, AUDIO90_EFFECT_INDEX.pump, setting, value, 0);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const VOICE = AUDIO90_VOICE_SETTING_INDEX;
const REVERB = AUDIO90_EFFECT_SETTING_INDEX.reverb;
const ECHO = AUDIO90_EFFECT_SETTING_INDEX.echo;
const CHORUS = AUDIO90_EFFECT_SETTING_INDEX.chorus;
const PUMP = AUDIO90_EFFECT_SETTING_INDEX.pump;

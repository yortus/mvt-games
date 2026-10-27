import { AUDIO90_VOICE_COUNT } from '../synthesiser';
import type { Audio90Writer } from '../chip';
import {
    type Audio90Song,
    CELL90_ACCENT,
    CELL90_ARPEGGIO,
    CELL90_BRIGHTNESS,
    CELL90_CHORD,
    CELL90_ECHO,
    CELL90_GLIDE,
    CELL90_INSTRUMENT,
    CELL90_IS_OWN_NOTE,
    CELL90_NOTE,
    CELL90_PAN,
    CELL90_PULSE,
    CELL90_REVERB,
    CELL90_SLICE,
    CELL90_SLIDE,
    CELL90_STRIDE,
    CELL90_VIBRATO,
    CELL90_VOLUME,
    RELEASE90,
} from './song';
import { toPan } from './tokens';

// What an Audio90 song writes to the chip: its settings as it starts, and
// each row's notes and effects. The timing, which row plays when, is the
// player's. A player calls these at each row's chip time, and so does a
// sample's bounce. They write through the `Audio90Writer` interface, so they
// play on any Audio90.

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What a player keeps of each channel as a song plays: the instrument it last named, and its slide. */
export interface Audio90ChannelState {
    /** Each channel's instrument, an index into the song's instruments, or -1 before one is named. */
    readonly instrument: Int32Array;
    /** Each channel's slide, in semitones a second at a tempo scale of 1, or 0 if it is not sliding. */
    readonly slideRate: Float64Array;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Creates channel state with no instrument named and nothing sliding. */
export function createAudio90ChannelState(): Audio90ChannelState {
    return { instrument: new Int32Array(AUDIO90_VOICE_COUNT).fill(-1), slideRate: new Float64Array(AUDIO90_VOICE_COUNT) };
}

/**
 * Writes `song`'s settings as it starts, at chip time `stamp`: its tempo
 * scaled by `tempoScale`, its character, effects and pump,
 * and each channel's pan and sends from its mixer. It also clears `state`.
 * It runs once a song, so it is not on a hot path.
 */
export function writeAudio90SongStart(chip: Audio90Writer, song: Audio90Song, state: Audio90ChannelState, stamp: number, tempoScale: number): void {
    state.instrument.fill(-1);
    state.slideRate.fill(0);
    chip.setTempo(song.bpm * tempoScale, stamp);
    if (song.character !== undefined) chip.setCharacter(song.character, stamp);
    const { reverb, echo, chorus, pump } = song;
    if (reverb !== undefined) {
        chip.setEffect('reverb', 'size', reverb.size, stamp);
        chip.setEffect('reverb', 'decayMs', reverb.decayMs, stamp);
        chip.setEffect('reverb', 'damping', reverb.damping, stamp);
        chip.setEffect('reverb', 'level', reverb.level, stamp);
    }
    if (echo !== undefined) {
        // Setting `timeMs` times the echo in ms. Setting `timeBeats` after it times it in beats instead
        chip.setEffect('echo', 'timeMs', echo.timeMs, stamp);
        if (echo.timeBeats > 0) chip.setEffect('echo', 'timeBeats', echo.timeBeats, stamp);
        chip.setEffect('echo', 'feedback', echo.feedback, stamp);
        chip.setEffect('echo', 'toneHz', echo.toneHz, stamp);
        chip.setEffect('echo', 'pingPong', echo.isPingPong ? 1 : 0, stamp);
        chip.setEffect('echo', 'level', echo.level, stamp);
    }
    if (chorus !== undefined) {
        chip.setEffect('chorus', 'depth', chorus.depth, stamp);
        chip.setEffect('chorus', 'rateHz', chorus.rateHz, stamp);
        chip.setEffect('chorus', 'level', chorus.level, stamp);
    }
    // A song with no pump turns off the one a song before it may have left
    chip.setEffect('pump', 'voice', pump === undefined ? -1 : pump.channel, stamp);
    if (pump !== undefined) {
        chip.setEffect('pump', 'depth', pump.depth, stamp);
        chip.setEffect('pump', 'releaseMs', pump.releaseMs, stamp);
    }
    for (let channel = 0; channel < song.channelCount; channel++) {
        const mix = song.mixer[channel];
        chip.setVoice(channel, 'pan', mix.pan, stamp);
        chip.setVoice(channel, 'reverbSend', mix.reverb, stamp);
        chip.setVoice(channel, 'echoSend', mix.echo, stamp);
        chip.setVoice(channel, 'chorusSend', mix.chorus, stamp);
        chip.setVoice(channel, 'brightness', 1, stamp);
    }
}

/**
 * Writes row `row` of order entry `orderIndex` of `song`, at chip time
 * `stamp`. `lengthMs` is how long the row lasts in song time, for its slides
 * and glides, and `tempoScale` is the player's, which scales the slides. It
 * allocates nothing.
 */
export function writeAudio90Row(
    chip: Audio90Writer,
    song: Audio90Song,
    state: Audio90ChannelState,
    orderIndex: number,
    row: number,
    stamp: number,
    lengthMs: number,
    tempoScale: number,
): void {
    const entry = song.order[orderIndex];
    const cells = song.patterns[entry.pattern].cells;
    const channels = song.channelCount;
    const songVolume = song.volume;
    // The row's length in chip time, for glides. While the song is held, use its length in song time
    const glideMs = tempoScale > 0 ? lengthMs / tempoScale : lengthMs;
    for (let channel = 0; channel < channels; channel++) {
        const at = (row * channels + channel) * CELL90_STRIDE;
        const note = cells[at + CELL90_NOTE];
        const named = cells[at + CELL90_INSTRUMENT];
        if (named >= 0) state.instrument[channel] = named;
        const instrument = state.instrument[channel];
        const volume = cells[at + CELL90_VOLUME];
        const slide = cells[at + CELL90_SLIDE];

        // The channel's settings first, so a note on this row starts with them
        const pan = cells[at + CELL90_PAN];
        if (pan >= 0) chip.setVoice(channel, 'pan', toPan(pan), stamp);
        const brightness = cells[at + CELL90_BRIGHTNESS];
        if (brightness >= 0) chip.setVoice(channel, 'brightness', brightness / 15, stamp);
        const reverb = cells[at + CELL90_REVERB];
        if (reverb >= 0) chip.setVoice(channel, 'reverbSend', reverb / 15, stamp);
        const echo = cells[at + CELL90_ECHO];
        if (echo >= 0) chip.setVoice(channel, 'echoSend', echo / 15, stamp);

        if (state.slideRate[channel] !== 0 && slide === 0) {
            chip.setVoice(channel, 'slide', 0, stamp);
            state.slideRate[channel] = 0;
        }
        if (note >= 0 && instrument >= 0) {
            const played = note + (cells[at + CELL90_IS_OWN_NOTE] === 1 ? 0 : entry.transpose);
            chip.noteOn(channel, song.instruments[instrument], played, (volume >= 0 ? volume / 15 : 1) * songVolume, stamp);
            if (cells[at + CELL90_GLIDE] === 1) chip.setVoice(channel, 'glide', glideMs, stamp);
        }
        else if (note === RELEASE90) {
            chip.noteOff(channel, stamp);
        }
        else if (volume >= 0) {
            chip.setVoice(channel, 'volume', volume / 15 * songVolume, stamp);
        }

        // These apply to the note playing, so they follow the note on
        if (cells[at + CELL90_ACCENT] === 1) chip.setVoice(channel, 'accent', 1, stamp);
        const chord = cells[at + CELL90_CHORD];
        if (chord >= 0) chip.setVoice(channel, 'chord', chord, stamp);
        const slice = cells[at + CELL90_SLICE];
        if (slice >= 0) chip.setVoice(channel, 'slice', slice, stamp);
        const arpeggio = cells[at + CELL90_ARPEGGIO];
        if (arpeggio >= 0) chip.setVoice(channel, 'arpeggio', arpeggio, stamp);
        const vibrato = cells[at + CELL90_VIBRATO];
        if (vibrato >= 0) {
            chip.setVoice(channel, 'vibratoDepth', Math.floor(vibrato / 16) / 8, stamp);
            chip.setVoice(channel, 'vibratoRate', vibrato % 16, stamp);
        }
        if (slide !== 0) {
            // The rate that covers the slide over the row at a tempo scale of 1
            const rate = slide * 1000 / lengthMs;
            state.slideRate[channel] = rate;
            chip.setVoice(channel, 'slide', rate * tempoScale, stamp);
        }
        const pulse = cells[at + CELL90_PULSE];
        if (pulse >= 0) chip.setVoice(channel, 'pulseWidth', pulse / 16, stamp);
    }
}

/**
 * Writes what a change of the player's tempo scale changes, from chip time
 * `stamp`: the tempo, for the LFOs and the echo timed in beats, and each
 * sliding channel's rate. A scale of 0 holds the song still, so its slides
 * stop and its LFOs timed in beats hold.
 */
export function writeAudio90TempoScale(chip: Audio90Writer, song: Audio90Song, state: Audio90ChannelState, stamp: number, tempoScale: number): void {
    chip.setTempo(song.bpm * tempoScale, stamp);
    for (let channel = 0; channel < song.channelCount; channel++) {
        const rate = state.slideRate[channel];
        if (rate !== 0) chip.setVoice(channel, 'slide', rate * tempoScale, stamp);
    }
}

/** Releases every channel of `song` at chip time `stamp`, as a player does when the song ends or stops. */
export function releaseAudio90Song(chip: Audio90Writer, song: Audio90Song, stamp: number): void {
    for (let channel = 0; channel < song.channelCount; channel++) chip.noteOff(channel, stamp);
}

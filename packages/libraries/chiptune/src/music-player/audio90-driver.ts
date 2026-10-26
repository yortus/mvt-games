import {
    type Audio90Writer,
    AUDIO90_CHARACTERS,
    AUDIO90_EFFECT_INDEX,
    AUDIO90_EFFECT_SETTING_INDEX,
    AUDIO90_VOICE_COUNT,
    AUDIO90_VOICE_SETTING_INDEX,
    type Audio90EffectId,
    type Audio90EffectSetting,
    type Audio90Instrument,
    type Audio90Song,
    type Audio90VoiceSetting,
    createAudio90ChannelState,
    OP90_NOTE_OFF,
    OP90_NOTE_ON,
    OP90_RESERVE_VOICES,
    OP90_SET_CHARACTER,
    OP90_SET_EFFECT,
    OP90_SET_TEMPO,
    OP90_SET_VOICE,
    releaseAudio90Song,
    writeAudio90Row,
    writeAudio90SongStart,
    writeAudio90TempoScale,
} from '../audio90';
import { COMMAND_STRIDE } from '../shared';
import type { SongDriver } from './song-driver';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What the Audio90's song driver plays on: a chip, or anything else that writes to one. */
export interface Audio90SongDriverOptions {
    readonly audio90: Audio90Writer;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates what the music player needs to play Audio90 songs on `audio90`.
 * The Audio90's own song writer says what each row writes. It writes to a
 * stand-in chip here, which keeps each write as numbers laid out as the
 * chip's commands are, and makes the calls on the real chip as the player
 * refreshes. Writing and refreshing allocate nothing once the buffer has
 * grown to a tick's writes.
 */
export function createAudio90SongDriver(options: Audio90SongDriverOptions): SongDriver<Audio90Song> {
    const { audio90 } = options;
    const state = createAudio90ChannelState();
    // Every instrument played, so a kept note can name its instrument by number
    const instruments: Audio90Instrument[] = [];
    const instrumentSlots = new Map<Audio90Instrument, number>();

    // Writes waiting for `refresh`, stored as numbers laid out as the chip's commands are
    let pending = new Float64Array(64 * COMMAND_STRIDE);
    let pendingCount = 0;

    // The song writer writes here. It always gives a stamp, and never plays an effect
    const kept: Audio90Writer = {
        get time() {
            return audio90.time;
        },
        voiceCount: AUDIO90_VOICE_COUNT,
        play: ignore,
        noteOn(voice, instrument, note, volume, atMs) {
            push(OP90_NOTE_ON, atMs ?? audio90.time, voice, findSlot(instrument), note, volume);
        },
        noteOff(voice, atMs) {
            push(OP90_NOTE_OFF, atMs ?? audio90.time, voice, 0, 0, 0);
        },
        setVoice(voice, setting, value, atMs) {
            push(OP90_SET_VOICE, atMs ?? audio90.time, voice, AUDIO90_VOICE_SETTING_INDEX[setting], value, 0);
        },
        setEffect(effect, setting, value, atMs) {
            const settings: Readonly<Record<string, number>> = AUDIO90_EFFECT_SETTING_INDEX[effect as Audio90EffectId];
            push(OP90_SET_EFFECT, atMs ?? audio90.time, AUDIO90_EFFECT_INDEX[effect], settings[setting], value, 0);
        },
        setCharacter(character, atMs) {
            push(OP90_SET_CHARACTER, atMs ?? audio90.time, AUDIO90_CHARACTERS.indexOf(character), 0, 0, 0);
        },
        setTempo(bpm, atMs) {
            push(OP90_SET_TEMPO, atMs ?? audio90.time, bpm, 0, 0, 0);
        },
        reserveVoices(count, atMs) {
            push(OP90_RESERVE_VOICES, atMs ?? audio90.time, count, 0, 0, 0);
        },
        releaseAll: ignore,
    };

    return {
        get time() {
            return audio90.time;
        },
        start: (song, stamp, scale) => writeAudio90SongStart(kept, song, state, stamp, scale),
        playRow: (song, orderIndex, row, stamp, lengthMs, scale) => writeAudio90Row(kept, song, state, orderIndex, row, stamp, lengthMs, scale),
        changeTempoScale: (song, stamp, scale) => writeAudio90TempoScale(kept, song, state, stamp, scale),
        release: (song, stamp) => releaseAudio90Song(kept, song, stamp),
        finish(stamp) {
            push(OP90_RESERVE_VOICES, stamp, 0, 0, 0, 0);
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
                    case OP90_NOTE_ON:
                        audio90.noteOn(a, instruments[b], c, d, stamp);
                        break;
                    case OP90_NOTE_OFF:
                        audio90.noteOff(a, stamp);
                        break;
                    case OP90_SET_VOICE:
                        audio90.setVoice(a, VOICE_SETTINGS[b], c, stamp);
                        break;
                    case OP90_SET_EFFECT: {
                        const effect = EFFECTS[a];
                        audio90.setEffect(effect, EFFECT_SETTINGS[effect][b], c, stamp);
                        break;
                    }
                    case OP90_SET_CHARACTER:
                        audio90.setCharacter(AUDIO90_CHARACTERS[a], stamp);
                        break;
                    case OP90_SET_TEMPO:
                        audio90.setTempo(a, stamp);
                        break;
                    case OP90_RESERVE_VOICES:
                        audio90.reserveVoices(a, stamp);
                        break;
                }
            }
            pendingCount = 0;
        },
    };

    function findSlot(instrument: Audio90Instrument): number {
        let slot = instrumentSlots.get(instrument);
        if (slot === undefined) {
            slot = instruments.push(instrument) - 1;
            instrumentSlots.set(instrument, slot);
        }
        return slot;
    }

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

/** The voice settings by number: the reverse of `AUDIO90_VOICE_SETTING_INDEX`. */
const VOICE_SETTINGS: readonly Audio90VoiceSetting[] = listNamesByIndex(AUDIO90_VOICE_SETTING_INDEX);

/** The effects by number: the reverse of `AUDIO90_EFFECT_INDEX`. */
const EFFECTS: readonly Audio90EffectId[] = listNamesByIndex(AUDIO90_EFFECT_INDEX);

/** Each effect's settings by number. */
const EFFECT_SETTINGS = {
    reverb: listNamesByIndex(AUDIO90_EFFECT_SETTING_INDEX.reverb),
    echo: listNamesByIndex(AUDIO90_EFFECT_SETTING_INDEX.echo),
    chorus: listNamesByIndex(AUDIO90_EFFECT_SETTING_INDEX.chorus),
    pump: listNamesByIndex(AUDIO90_EFFECT_SETTING_INDEX.pump),
} as { readonly [E in Audio90EffectId]: readonly Audio90EffectSetting<Audio90EffectId>[] };

/** The names of an index record, each at its index. */
function listNamesByIndex<T extends string>(indices: Readonly<Record<T, number>>): T[] {
    const names: T[] = [];
    for (const name of Object.keys(indices) as T[]) names[indices[name]] = name;
    return names;
}

function ignore(): void {
    // The song writer never plays an effect or releases every voice
}

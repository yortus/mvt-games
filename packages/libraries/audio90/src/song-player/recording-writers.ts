import {
    type Audio80EchoSetting,
    type Audio80FilterId,
    type Audio80FilterMode,
    type Audio80FilterSetting,
    type Audio80Sound,
    type Audio80VoiceSetting,
    type Audio80Wave,
    type Audio80Writer,
    VOICE_COUNT,
} from '../audio80';
import {
    type Audio90Character,
    type Audio90EffectId,
    type Audio90EffectSetting,
    type Audio90Sound,
    AUDIO90_VOICE_COUNT,
    type Audio90VoiceSetting,
    type Audio90Writer,
} from '../audio90';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A writer that plays nothing, and logs every call a song makes on it, with
 * the time it applies at: its notes, and the settings it changes as it plays,
 * such as a voice's slide or a filter's cutoff. Tests of what a song writes
 * read the log. A chip's own log holds only plays, stops and notes.
 */
export interface RecordingWriter<W, C> {
    /** The writer, which a song player writes to. */
    readonly writer: W;
    /** Every call since the last `clear`, oldest first. */
    readonly log: readonly C[];
    /** Empties the log. */
    clear: () => void;
    /** Moves the writer's clock on by `deltaMs`, as a chip's clock moves. */
    update: (deltaMs: number) => void;
}

/** One call to an Audio80's writer, with the time it applies at. A value is a name for a voice's `'wave'` and a filter's `'mode'`. */
export type Audio80WriterCall =
    | { readonly kind: 'note-on'; readonly voice: number; readonly sound: Audio80Sound; readonly note: number; readonly volume: number; readonly time: number }
    | { readonly kind: 'note-off'; readonly voice: number; readonly time: number }
    | { readonly kind: 'set-voice'; readonly voice: number; readonly setting: 'wave'; readonly value: Audio80Wave; readonly time: number }
    | { readonly kind: 'set-voice'; readonly voice: number; readonly setting: Exclude<Audio80VoiceSetting, 'wave'>; readonly value: number; readonly time: number }
    | { readonly kind: 'set-filter'; readonly filter: Audio80FilterId; readonly setting: 'mode'; readonly value: Audio80FilterMode; readonly time: number }
    | { readonly kind: 'set-filter'; readonly filter: Audio80FilterId; readonly setting: Exclude<Audio80FilterSetting, 'mode'>; readonly value: number; readonly time: number }
    | { readonly kind: 'set-echo'; readonly setting: Audio80EchoSetting; readonly value: number; readonly time: number }
    | { readonly kind: 'release-all'; readonly time: number };

/** One call to an Audio90's writer, with the time it applies at. */
export type Audio90WriterCall =
    | { readonly kind: 'note-on'; readonly voice: number; readonly sound: Audio90Sound; readonly note: number; readonly volume: number; readonly time: number }
    | { readonly kind: 'note-off'; readonly voice: number; readonly time: number }
    | { readonly kind: 'set-voice'; readonly voice: number; readonly setting: Audio90VoiceSetting; readonly value: number; readonly time: number }
    | Audio90EffectCall
    | { readonly kind: 'set-character'; readonly character: Audio90Character; readonly time: number }
    | { readonly kind: 'set-tempo'; readonly bpm: number; readonly time: number }
    | { readonly kind: 'release-all'; readonly time: number };

/** A call that sets one of an effect's settings, whose setting is one of that effect's. */
export type Audio90EffectCall = {
    readonly [E in Audio90EffectId]: { readonly kind: 'set-effect'; readonly effect: E; readonly setting: Audio90EffectSetting<E>; readonly value: number; readonly time: number };
}[Audio90EffectId];

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a recording Audio80 writer, with its clock at 0 and nothing logged. */
export function createRecordingAudio80Writer(): RecordingWriter<Audio80Writer, Audio80WriterCall> {
    // In a typed array, so advancing it boxes no double
    const clock = new Float64Array(1);
    const log: Audio80WriterCall[] = [];
    const writer: Audio80Writer = {
        get time() {
            return clock[0];
        },
        voiceCount: VOICE_COUNT,
        noteOn(voice, sound, note, volume, atMs) {
            log.push({ kind: 'note-on', voice, sound, note, volume, time: atMs ?? clock[0] });
        },
        noteOff(voice, atMs) {
            log.push({ kind: 'note-off', voice, time: atMs ?? clock[0] });
        },
        setVoice(voice, setting, value, atMs) {
            // The signature makes sure the setting and its value agree. TypeScript can't follow that into the
            // union, so the call is cast
            log.push({ kind: 'set-voice', voice, setting, value, time: atMs ?? clock[0] } as Audio80WriterCall);
        },
        setFilter(filter, setting, value, atMs) {
            log.push({ kind: 'set-filter', filter, setting, value, time: atMs ?? clock[0] } as Audio80WriterCall);
        },
        setEcho(setting, value, atMs) {
            log.push({ kind: 'set-echo', setting, value, time: atMs ?? clock[0] });
        },
        releaseAll() {
            log.push({ kind: 'release-all', time: clock[0] });
        },
    };
    return createRecording(writer, log, clock);
}

/** Creates a recording Audio90 writer, as `createRecordingAudio80Writer` does an Audio80's. */
export function createRecordingAudio90Writer(): RecordingWriter<Audio90Writer, Audio90WriterCall> {
    const clock = new Float64Array(1);
    const log: Audio90WriterCall[] = [];
    const writer: Audio90Writer = {
        get time() {
            return clock[0];
        },
        voiceCount: AUDIO90_VOICE_COUNT,
        noteOn(voice, sound, note, volume, atMs) {
            log.push({ kind: 'note-on', voice, sound, note, volume, time: atMs ?? clock[0] });
        },
        noteOff(voice, atMs) {
            log.push({ kind: 'note-off', voice, time: atMs ?? clock[0] });
        },
        setVoice(voice, setting, value, atMs) {
            log.push({ kind: 'set-voice', voice, setting, value, time: atMs ?? clock[0] });
        },
        setEffect(effect, setting, value, atMs) {
            // The signature makes sure the effect and its setting agree. TypeScript can't follow that into the
            // union, so the call is cast
            log.push({ kind: 'set-effect', effect, setting, value, time: atMs ?? clock[0] } as Audio90EffectCall);
        },
        setCharacter(character, atMs) {
            log.push({ kind: 'set-character', character, time: atMs ?? clock[0] });
        },
        setTempo(bpm, atMs) {
            log.push({ kind: 'set-tempo', bpm, time: atMs ?? clock[0] });
        },
        releaseAll() {
            log.push({ kind: 'release-all', time: clock[0] });
        },
    };
    return createRecording(writer, log, clock);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Joins a recording writer to its log and its clock. */
function createRecording<W, C>(writer: W, log: C[], clock: Float64Array): RecordingWriter<W, C> {
    return {
        writer,
        log,
        clear() {
            log.length = 0;
        },
        update(deltaMs) {
            clock[0] += deltaMs;
        },
    };
}

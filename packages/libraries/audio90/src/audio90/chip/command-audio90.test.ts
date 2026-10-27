import { describe, expect, it } from 'vitest';
import { COMMAND_STRIDE } from '../../shared';
import {
    AUDIO90_CHARACTERS,
    AUDIO90_EFFECT_INDEX,
    AUDIO90_EFFECT_SETTING_INDEX,
    AUDIO90_VOICE_SETTING_INDEX,
    type Audio90SoundData,
    type Audio90SampleData,
    DEFAULT_AUDIO90_SOUND,
    ENGINE_SAMPLE,
    OP90_NOTE_ON,
    OP90_PLAY,
    OP90_PLAY_OPTIONS,
    OP90_SET_CHARACTER,
    OP90_SET_EFFECT,
    OP90_SET_TEMPO,
    OP90_SET_VOICE,
    OP90_STOP,
} from '../synthesiser';
import type { Audio90Sample, Audio90Sound } from '../notation';
import { createCommandAudio90 } from './command-audio90';

describe('the Audio90\'s command writer', () => {
    it('writes each call as one command, stamped with the clock unless given a stamp', () => {
        const { writer, listCommands } = setUp();
        writer.update(100);
        writer.setVoice(3, 'pan', -0.5);
        writer.setEffect('echo', 'feedback', 0.4, 250);
        writer.setCharacter('console');
        writer.setTempo(128);
        expect(listCommands()).toEqual([
            [OP90_SET_VOICE, 100, 3, AUDIO90_VOICE_SETTING_INDEX.pan, -0.5, 0],
            [OP90_SET_EFFECT, 250, AUDIO90_EFFECT_INDEX.echo, AUDIO90_EFFECT_SETTING_INDEX.echo.feedback, 0.4, 0],
            [OP90_SET_CHARACTER, 100, AUDIO90_CHARACTERS.indexOf('console'), 0, 0, 0],
            [OP90_SET_TEMPO, 100, 128, 0, 0, 0],
        ]);
    });

    it('plays a sound at once, as its options say, or as the sound says without them', () => {
        const { writer, listCommands, sent } = setUp();
        const sound = createSound({ note: 64, lengthMs: 100 });
        const first = writer.play(sound);
        const second = writer.play(sound, { note: 'C-4', lengthMs: Infinity, volume: 0.5, pan: 0.75, glideTo: 72 });
        writer.stop(second);
        const soundId = sent[0].id;
        expect(listCommands()).toEqual([
            [OP90_PLAY_OPTIONS, -Infinity, 100, -1, 0, 0],
            [OP90_PLAY, -Infinity, soundId, first, 64, 1],
            [OP90_PLAY_OPTIONS, -Infinity, -1, 72, 0.75, 1],
            [OP90_PLAY, -Infinity, soundId, second, 60, 0.5],
            [OP90_STOP, -Infinity, second, 0, 0, 0],
        ]);
        expect([first, second]).toEqual([1, 2]);
    });

    it('sends each sound once, until it forgets', () => {
        const { writer, sent } = setUp();
        const sound = createSound();
        writer.noteOn(0, sound, 60, 1);
        writer.play(sound);
        expect(sent.filter((message) => message.kind === 'sound')).toHaveLength(1);
        writer.forget();
        writer.noteOn(0, sound, 60, 1);
        expect(sent.filter((message) => message.kind === 'sound')).toHaveLength(2);
    });

    it('sends a sample before the first sound that plays it, and gives the sound its id', () => {
        const { writer, sent, listCommands } = setUp();
        const sample = createSample();
        const first = createSound({ engine: ENGINE_SAMPLE }, sample);
        const second = createSound({ engine: ENGINE_SAMPLE, volume: 0.5 }, sample);
        writer.noteOn(0, first, 60, 1);
        writer.noteOn(1, second, 60, 1);
        expect(sent.map((message) => message.kind)).toEqual(['sample', 'sound', 'sound']);
        const sampleId = sent[0].id;
        expect(sent.slice(1).map((message) => (message.data as Audio90SoundData).sample)).toEqual([sampleId, sampleId]);
        // The sound's own data is left as it was, so it can be sent again after a reset
        expect(first.data.sample).toBe(-1);
        const notes = listCommands().filter((command) => command[0] === OP90_NOTE_ON);
        expect(notes.map((command) => command[3])).toEqual([sent[1].id, sent[2].id]);
    });

    it('sends the sample of a sound played on its own before the sound', () => {
        const { writer, sent } = setUp();
        const sample = createSample();
        writer.play(createSound({ engine: ENGINE_SAMPLE }, sample));
        expect(sent.map((message) => message.kind)).toEqual(['sample', 'sound']);
        expect((sent[1].data as Audio90SoundData).sample).toBe(sent[0].id);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Sent {
    readonly kind: 'sound' | 'sample';
    readonly id: number;
    readonly data: Audio90SoundData | Audio90SampleData;
}

function setUp() {
    const sent: Sent[] = [];
    const writer = createCommandAudio90({
        onSound: (id, data) => sent.push({ kind: 'sound', id, data }),
        onSample: (id, data) => sent.push({ kind: 'sample', id, data }),
    });
    const listCommands = (): number[][] => {
        const commands: number[][] = [];
        for (let i = 0; i < writer.count; i++) commands.push(Array.from(writer.commands.subarray(i * COMMAND_STRIDE, (i + 1) * COMMAND_STRIDE)));
        return commands;
    };
    return { writer, sent, listCommands };
}

/** A sound made by hand, so the writer is tested apart from the notation: its data, with the sample it plays, if any. */
function createSound(data: Partial<Audio90SoundData> = {}, sample?: Audio90Sample): Audio90Sound {
    return { chip: 'audio90', engine: sample === undefined ? 'analog' : 'sample', data: { ...DEFAULT_AUDIO90_SOUND, ...data }, sample };
}

/** A sample made by hand, of silence, with nothing to bounce. */
function createSample(): Audio90Sample {
    return { chip: 'audio90', slices: 1, length: 64, data: { data: new Int16Array(64), sampleRate: 32000, rootNote: 60, loopStart: -1, loopEnd: -1, isPingPong: false, slices: 1 } };
}

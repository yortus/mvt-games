import { describe, expect, it } from 'vitest';
import { COMMAND_STRIDE } from '../../shared';
import {
    AUDIO90_CHARACTERS,
    AUDIO90_EFFECT_INDEX,
    AUDIO90_EFFECT_SETTING_INDEX,
    AUDIO90_VOICE_SETTING_INDEX,
    type Audio90EffectData,
    type Audio90InstrumentData,
    type Audio90SampleData,
    DEFAULT_AUDIO90_INSTRUMENT,
    ENGINE_SAMPLE,
    OP90_NOTE_ON,
    OP90_PLAY_EFFECT,
    OP90_SET_CHARACTER,
    OP90_SET_EFFECT,
    OP90_SET_TEMPO,
    OP90_SET_VOICE,
} from '../synthesiser';
import type { Audio90Instrument, Audio90Sample, Audio90SoundEffect } from '../notation';
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

    it('plays an effect at once, at its own pan unless given one', () => {
        const { writer, listCommands } = setUp();
        const effect = createEffect(createInstrument());
        writer.play(effect);
        writer.play(effect, 0.75);
        const [own, given] = listCommands();
        expect([own[0], own[1], own[3], own[4]]).toEqual([OP90_PLAY_EFFECT, -Infinity, 0, 0]);
        expect([given[3], given[4]]).toEqual([0.75, 1]);
    });

    it('sends each instrument once, until it forgets', () => {
        const { writer, sent } = setUp();
        const instrument = createInstrument();
        writer.noteOn(0, instrument, 60, 1);
        writer.noteOn(1, instrument, 64, 1);
        expect(sent.filter((message) => message.kind === 'instrument')).toHaveLength(1);
        writer.forget();
        writer.noteOn(0, instrument, 60, 1);
        expect(sent.filter((message) => message.kind === 'instrument')).toHaveLength(2);
    });

    it('sends a sample before the first instrument that plays it, and gives the instrument its id', () => {
        const { writer, sent, listCommands } = setUp();
        const sample = createSample();
        const first = createInstrument({ engine: ENGINE_SAMPLE }, sample);
        const second = createInstrument({ engine: ENGINE_SAMPLE, volume: 0.5 }, sample);
        writer.noteOn(0, first, 60, 1);
        writer.noteOn(1, second, 60, 1);
        expect(sent.map((message) => message.kind)).toEqual(['sample', 'instrument', 'instrument']);
        const sampleId = sent[0].id;
        expect(sent.slice(1).map((message) => (message.data as Audio90InstrumentData).sample)).toEqual([sampleId, sampleId]);
        // The instrument's own data is left as it was, so it can be sent again after a reset
        expect(first.data.sample).toBe(-1);
        const notes = listCommands().filter((command) => command[0] === OP90_NOTE_ON);
        expect(notes.map((command) => command[3])).toEqual([sent[1].id, sent[2].id]);
    });

    it('sends the sample of an effect\'s instrument before the effect', () => {
        const { writer, sent } = setUp();
        const sample = createSample();
        writer.play(createEffect(createInstrument({ engine: ENGINE_SAMPLE }, sample)));
        expect(sent.map((message) => message.kind)).toEqual(['sample', 'effect']);
        expect((sent[1].data as Audio90EffectData).instrument.sample).toBe(sent[0].id);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Sent {
    readonly kind: 'instrument' | 'effect' | 'sample';
    readonly id: number;
    readonly data: Audio90InstrumentData | Audio90EffectData | Audio90SampleData;
}

function setUp() {
    const sent: Sent[] = [];
    const writer = createCommandAudio90({
        onInstrument: (id, data) => sent.push({ kind: 'instrument', id, data }),
        onEffect: (id, data) => sent.push({ kind: 'effect', id, data }),
        onSample: (id, data) => sent.push({ kind: 'sample', id, data }),
    });
    const listCommands = (): number[][] => {
        const commands: number[][] = [];
        for (let i = 0; i < writer.count; i++) commands.push(Array.from(writer.commands.subarray(i * COMMAND_STRIDE, (i + 1) * COMMAND_STRIDE)));
        return commands;
    };
    return { writer, sent, listCommands };
}

/** An instrument made by hand, so the writer is tested apart from the notation: its data, with the sample it plays, if any. */
function createInstrument(data: Partial<Audio90InstrumentData> = {}, sample?: Audio90Sample): Audio90Instrument {
    return { chip: 'audio90', engine: sample === undefined ? 'analog' : 'sample', data: { ...DEFAULT_AUDIO90_INSTRUMENT, ...data }, sample };
}

function createEffect(instrument: Audio90Instrument): Audio90SoundEffect {
    const data: Audio90EffectData = { instrument: instrument.data, note: 60, glideTo: Number.NaN, lengthMs: 100, volume: 1, pan: 0, priority: 0, maxVoices: 1 };
    return { chip: 'audio90', data, instrument };
}

/** A sample made by hand, of silence, with nothing to bounce. */
function createSample(): Audio90Sample {
    return { chip: 'audio90', slices: 1, length: 64, data: { data: new Int16Array(64), sampleRate: 32000, rootNote: 60, loopStart: -1, loopEnd: -1, isPingPong: false, slices: 1 } };
}

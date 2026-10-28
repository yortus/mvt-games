import { describe, expect, it } from 'vitest';
import { type Audio90SampleData, type Audio90SoundData, DEFAULT_AUDIO90_SOUND, ENGINE_SAMPLE } from '../synthesiser';
import type { Audio90Sample, Audio90Sound } from '../notation';
import { createAudio90SoundIds } from './audio90-sound-ids';

describe('createAudio90SoundIds', () => {
    it('defines each sound once, until it forgets', () => {
        const { ids, sent } = setUp();
        const sound = createSound();
        expect([ids.soundId(sound), ids.soundId(sound)]).toEqual([1, 1]);
        ids.forget();
        ids.soundId(sound);
        expect(sent.map((message) => message.kind)).toEqual(['sound', 'sound']);
    });

    it('defines a sample before the first sound that plays it, and gives the sound its id', () => {
        const { ids, sent } = setUp();
        const sample = createSample();
        const first = createSound({ engine: ENGINE_SAMPLE }, sample);
        const second = createSound({ engine: ENGINE_SAMPLE, volume: 0.5 }, sample);
        expect([ids.soundId(first), ids.soundId(second)]).toEqual([sent[1].id, sent[2].id]);
        expect(sent.map((message) => message.kind)).toEqual(['sample', 'sound', 'sound']);
        const sampleId = sent[0].id;
        expect(sent.slice(1).map((message) => (message.data as Audio90SoundData).sample)).toEqual([sampleId, sampleId]);
        // The sound's own data is left as it was, so it can be sent again after a reset
        expect(first.data.sample).toBe(-1);
    });

    it('takes the id given elsewhere for a sound defined there, and defines nothing for it', () => {
        const sound = createSound();
        const { ids, sent } = setUp((known) => (known === sound ? 7 : undefined));
        expect(ids.soundId(sound)).toBe(7);
        expect(sent).toEqual([]);
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

function setUp(idOf?: (sound: Audio90Sound) => number | undefined) {
    const sent: Sent[] = [];
    const ids = createAudio90SoundIds({
        onSound: (id, data) => sent.push({ kind: 'sound', id, data }),
        onSample: (id, data) => sent.push({ kind: 'sample', id, data }),
        idOf,
    });
    return { ids, sent };
}

/** A sound made by hand, so the ids are tested apart from the notation: its data, with the sample it plays, if any. */
function createSound(data: Partial<Audio90SoundData> = {}, sample?: Audio90Sample): Audio90Sound {
    return { chip: 'audio90', engine: sample === undefined ? 'analog' : 'sample', data: { ...DEFAULT_AUDIO90_SOUND, ...data }, sample };
}

/** A sample made by hand, of silence, with nothing to bounce. */
function createSample(): Audio90Sample {
    return { chip: 'audio90', slices: 1, length: 64, data: { data: new Int16Array(64), sampleRate: 32000, rootNote: 60, loopStart: -1, loopEnd: -1, isPingPong: false, slices: 1 } };
}

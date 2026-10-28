import type { SoundIds } from '../../shared';
import type { Audio90SampleData, Audio90SoundData } from '../synthesiser';
import type { Audio90Sample, Audio90Sound } from '../notation';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to number an Audio90's sounds, and the samples they play. */
export interface Audio90SoundIdsOptions {
    /** Defines a sound for the chip, the first time it is given an id since the last `forget`. */
    readonly onSound: (id: number, data: Audio90SoundData) => void;
    /** Defines a sample for the chip, just before the first sound that plays it. */
    readonly onSample: (id: number, data: Audio90SampleData) => void;
    /**
     * Gives the id of a sound defined elsewhere, or undefined for one these
     * ids must define. The worklet's song writer uses it for the sounds the
     * page has already defined, so the two never clash.
     */
    readonly idOf?: (sound: Audio90Sound) => number | undefined;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an Audio90's sound ids, counted up from 1, with no sound given one
 * yet. Samples are numbered from the same count. A sample is defined first,
 * then the sound that plays it, with the sample's id in its data.
 */
export function createAudio90SoundIds(options: Audio90SoundIdsOptions): SoundIds<Audio90Sound> {
    const { onSound, onSample, idOf } = options;
    const soundIds = new Map<Audio90Sound, number>();
    const sampleIds = new Map<Audio90Sample, number>();
    let nextId = 1;
    return {
        soundId(sound) {
            const known = idOf?.(sound);
            if (known !== undefined) return known;
            let id = soundIds.get(sound);
            if (id === undefined) {
                const data = withSample(sound.data, sound.sample);
                id = nextId++;
                soundIds.set(sound, id);
                onSound(id, data);
            }
            return id;
        },
        forget() {
            soundIds.clear();
            sampleIds.clear();
        },
    };

    /** Returns `data` with the id of `sample`, which it defines first if it is new. With no sample, returns `data` itself. */
    function withSample(data: Audio90SoundData, sample: Audio90Sample | undefined): Audio90SoundData {
        if (sample === undefined) return data;
        let id = sampleIds.get(sample);
        if (id === undefined) {
            id = nextId++;
            sampleIds.set(sample, id);
            onSample(id, sample.data);
        }
        return data.sample === id ? data : { ...data, sample: id };
    }
}

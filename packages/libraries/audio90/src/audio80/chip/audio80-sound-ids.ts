import type { SoundIds } from '../../shared';
import type { SoundData } from '../synthesiser';
import type { Audio80Sound } from '../notation';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to number an Audio80's sounds. */
export interface Audio80SoundIdsOptions {
    /** Defines a sound for the chip, the first time it is given an id since the last `forget`. */
    readonly onSound: (id: number, data: SoundData) => void;
    /**
     * Gives the id of a sound defined elsewhere, or undefined for one these
     * ids must define. The worklet's song writer uses it for the sounds the
     * page has already defined, so the two never clash.
     */
    readonly idOf?: (sound: Audio80Sound) => number | undefined;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates an Audio80's sound ids, counted up from 1, with no sound given one yet. */
export function createAudio80SoundIds(options: Audio80SoundIdsOptions): SoundIds<Audio80Sound> {
    const { onSound, idOf } = options;
    const ids = new Map<Audio80Sound, number>();
    let nextId = 1;
    return {
        soundId(sound) {
            const known = idOf?.(sound);
            if (known !== undefined) return known;
            let id = ids.get(sound);
            if (id === undefined) {
                id = nextId++;
                ids.set(sound, id);
                onSound(id, sound.data);
            }
            return id;
        },
        forget() {
            ids.clear();
        },
    };
}

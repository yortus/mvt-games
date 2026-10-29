import { type Audio90Sample, createAudio90Sample } from '../audio90-sample';
import { type Audio90Song, createAudio90Song } from '../audio90-song';
import { type Audio90Sound, createAudio90Sound } from '../audio90-sound';
import { mapValues } from './map-values';
import { type Rows, type SampleJson, SONG_FORMAT, SONG_VERSION, type SongJson, type SoundJson } from './song-json';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Reads a song's text, as `printAudio90Song` prints it, into a song. A
 * pattern or a step table may also be one string, with a row on each line,
 * as `createAudio90Song` takes it. Sounds and samples printed the same way
 * in one text become one sound or one sample, so a sample used by two
 * instruments is bounced, and takes sample memory, once.
 *
 * Throws if the text is not an Audio90 song, or if the song in it is not
 * valid, with the error `createAudio90Song` gives.
 */
export function parseAudio90Song(text: string): Audio90Song {
    let json: unknown;
    try {
        json = JSON.parse(text);
    }
    catch (error) {
        throw new Error(`song text: not JSON: ${(error as Error).message}`);
    }
    if (!isRecord(json) || json.format !== SONG_FORMAT) throw new Error(`song text: not an Audio90 song, whose format is "${SONG_FORMAT}"`);
    if (json.version !== SONG_VERSION) throw new Error(`song text: version ${String(json.version)} is not one this package reads, which is ${SONG_VERSION}`);
    const { format: _format, version: _version, ...song } = json;
    return createParser().toSong(song, 'song text');
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Makes the songs, sounds and samples of one song's text, making each sound and sample printed the same way once. */
function createParser() {
    const made = new Map<string, Audio90Sound | Audio90Sample>();
    return { toSong };

    function toSong(json: Record<string, unknown>, where: string): Audio90Song {
        const instruments = checkRecord(json.instruments, `${where}: instruments`);
        const patterns = checkRecord(json.patterns, `${where}: patterns`);
        return createAudio90Song({
            ...(json as unknown as SongJson),
            instruments: mapValues(instruments, (sound, letter) => toSound(checkRecord(sound, `${where}: instrument '${letter}'`), `${where}: instrument '${letter}'`)),
            patterns: mapValues(patterns, (rows) => joinRows(rows as Rows)),
        });
    }

    function toSound(json: Record<string, unknown>, where: string): Audio90Sound {
        return makeOnce(`sound ${JSON.stringify(json)}`, () => {
            const { sample, steps, ...rest } = json as SoundJson;
            return createAudio90Sound({
                ...rest,
                ...(sample === undefined ? {} : { sample: toSample(checkRecord(sample, `${where}: sample`), `${where}: sample`) }),
                ...(steps === undefined ? {} : { steps: joinRows(steps) }),
            });
        });
    }

    function toSample(json: Record<string, unknown>, where: string): Audio90Sample {
        return makeOnce(`sample ${JSON.stringify(json)}`, () => createAudio90Sample({
            ...(json as unknown as SampleJson),
            bounce: toSong(checkRecord(json.bounce, `${where}: bounce`), `${where}: bounce`),
        }));
    }

    function makeOnce<T extends Audio90Sound | Audio90Sample>(key: string, make: () => T): T {
        const found = made.get(key);
        if (found !== undefined) return found as T;
        const value = make();
        made.set(key, value);
        return value;
    }
}

function joinRows(rows: Rows): string {
    return typeof rows === 'string' ? rows : rows.join('\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkRecord(value: unknown, where: string): Record<string, unknown> {
    if (!isRecord(value)) throw new Error(`${where}: must be an object`);
    return value;
}

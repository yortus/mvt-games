import { type Audio90Sample, type Audio90SampleOptions, createAudio90Sample, findAudio90SampleOptions } from './sample';
import { type Audio90Song, type Audio90SongOptions, createAudio90Song, findAudio90SongOptions } from './song';
import { type Audio90Sound, type Audio90SoundOptions, createAudio90Sound, findAudio90SoundOptions } from './sound';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Prints `song` as text, which `parseAudio90Song` reads back into the same
 * song, to save or send it. The text is JSON: a `format` and a `version`,
 * then the options the song was made from, as `createAudio90Song` took them.
 * Each instrument is printed as its sound's options, and a sample as its
 * recipe, the song it bounces included, never as audio. Each pattern, and
 * each step table, is a list of its rows, a row on each line, so a change
 * to a song changes the lines of the rows it touches. Comment rows are kept,
 * and blank ones are not. Anything else short enough, such as an envelope,
 * is printed on one line.
 *
 * Throws if the song, or a sound or sample in it, was not made by this
 * package's `create` functions, or if an option holds a number JSON cannot
 * hold, such as `Infinity`.
 */
export function printAudio90Song(song: Audio90Song): string {
    const json = { format: FORMAT, version: VERSION, ...toSongJson(song, 'song') };
    return `${stringify(json, '', 0, 'song')}\n`;
}

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
    if (!isRecord(json) || json.format !== FORMAT) throw new Error(`song text: not an Audio90 song, whose format is "${FORMAT}"`);
    if (json.version !== VERSION) throw new Error(`song text: version ${String(json.version)} is not one this package reads, which is ${VERSION}`);
    const { format: _format, version: _version, ...song } = json;
    return createParser().toSong(song, 'song text');
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const FORMAT = 'audio90 song';
const VERSION = 1;
/** The widest a line of a song's text is printed, unless a row is wider. */
const LINE_WIDTH = 100;

/** A song as its text holds it: its options, with its sounds printed out and its patterns as rows. */
type SongJson = Omit<Audio90SongOptions, 'instruments' | 'patterns'> & {
    readonly instruments: Readonly<Record<string, SoundJson>>;
    readonly patterns: Readonly<Record<string, Rows>>;
};

/** A sound as a song's text holds it: its options, with its sample printed out and its step table as rows. */
type SoundJson = Omit<Audio90SoundOptions, 'sample' | 'steps'> & {
    readonly sample?: SampleJson;
    readonly steps?: Rows;
};

/** A sample as a song's text holds it: its options, with the song it bounces printed out. */
type SampleJson = Omit<Audio90SampleOptions, 'bounce'> & {
    readonly bounce: SongJson;
};

/** A pattern or a step table, as a list of its rows, or as one string with a row on each line. */
type Rows = readonly string[] | string;

function toSongJson(song: Audio90Song, where: string): SongJson {
    const options = findAudio90SongOptions(song);
    if (options === undefined) throw new Error(`${where}: was not made by createAudio90Song, so it cannot be printed`);
    return {
        ...options,
        instruments: mapValues(options.instruments, (sound, letter) => toSoundJson(sound, `${where}: instrument '${letter}'`)),
        patterns: mapValues(options.patterns, toRows),
    };
}

function toSoundJson(sound: Audio90Sound, where: string): SoundJson {
    const options = findAudio90SoundOptions(sound);
    if (options === undefined) throw new Error(`${where}: was not made by createAudio90Sound, so it cannot be printed`);
    const { sample, steps, ...rest } = options;
    return {
        ...rest,
        ...(sample === undefined ? {} : { sample: toSampleJson(sample, `${where}: sample`) }),
        ...(steps === undefined ? {} : { steps: toRows(steps) }),
    };
}

function toSampleJson(sample: Audio90Sample, where: string): SampleJson {
    const options = findAudio90SampleOptions(sample);
    if (options === undefined) throw new Error(`${where}: was not made by createAudio90Sample, so it cannot be printed`);
    return { ...options, bounce: toSongJson(options.bounce, `${where}: bounce`) };
}

/** A pattern's or a step table's rows, each trimmed, with blank lines left out. */
function toRows(text: string): string[] {
    return text.split('\n').map((line) => line.trim()).filter((line) => line !== '');
}

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

function mapValues<T, U>(record: Readonly<Record<string, T>>, map: (value: T, key: string) => U): Record<string, U> {
    return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, map(value, key)]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkRecord(value: unknown, where: string): Record<string, unknown> {
    if (!isRecord(value)) throw new Error(`${where}: must be an object`);
    return value;
}

/**
 * Prints `value` as JSON, indented by `indent`, after `lead` characters on
 * its first line. An object or a list goes on one line if it fits within
 * `LINE_WIDTH`, unless it is a list of rows, which puts each on a line of
 * its own. Throws for a number JSON would hold as `null`, naming its path.
 */
function stringify(value: unknown, indent: string, lead: number, path: string): string {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`${path}: ${value} cannot be printed as JSON`);
    if (typeof value !== 'object' || value === null) return JSON.stringify(value);
    const inner = `${indent}    `;
    const isList = Array.isArray(value);
    const items: string[] = [];
    if (isList) {
        for (let i = 0; i < value.length; i++) items.push(stringify(value[i], inner, 0, `${path}[${i}]`));
    }
    else {
        for (const [key, item] of Object.entries(value)) {
            if (item === undefined) continue;
            const name = `${JSON.stringify(key)}: `;
            items.push(name + stringify(item, inner, name.length, `${path}.${key}`));
        }
    }
    if (items.length === 0) return isList ? '[]' : '{}';
    const line = isList ? `[${items.join(', ')}]` : `{ ${items.join(', ')} }`;
    const isRows = isList && value.length > 1 && value.every((item) => typeof item === 'string');
    if (!isRows && !line.includes('\n') && indent.length + lead + line.length <= LINE_WIDTH) return line;
    const [open, close] = isList ? ['[', ']'] : ['{', '}'];
    return `${open}\n${items.map((item) => inner + item).join(',\n')}\n${indent}${close}`;
}

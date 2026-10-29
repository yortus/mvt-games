import { type Audio90Sample, findAudio90SampleOptions } from './audio90-sample';
import { type Audio90Song, findAudio90SongOptions } from './audio90-song';
import { type Audio90Sound, findAudio90SoundOptions } from './audio90-sound';
import { mapValues } from './map-values';
import { type SampleJson, SONG_FORMAT, SONG_VERSION, type SongJson, type SoundJson } from './song-json';

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
    const json = { format: SONG_FORMAT, version: SONG_VERSION, ...toSongJson(song, 'song') };
    return `${stringify(json, '', 0, 'song')}\n`;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The widest a line of a song's text is printed, unless a row is wider. */
const LINE_WIDTH = 100;

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

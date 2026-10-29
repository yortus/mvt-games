import { type Audio80Song, type Audio80Sound, isAudio80Song, isAudio80Sound } from '../audio80';
import { type Audio90Song, type Audio90Sound, isAudio90Song, isAudio90Sound } from '../audio90';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A module's songs and sounds, for either chip, each with the name the module exports it under. */
export interface ModuleSounds {
    readonly songs: readonly (readonly [string, Audio80Song | Audio90Song])[];
    readonly sounds: readonly (readonly [string, Audio80Sound | Audio90Sound])[];
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Finds a module's songs and sounds, for either chip, with the names it
 * exports them under. Tests and scripts use it to go through every sound. A
 * song's instruments are sounds too, so they are found if they are exported.
 *
 * It looks inside exported arrays too, so a set of sounds made in a loop is
 * found. Each sound in an array is named for its place, such as
 * `'FANFARES[2]'`. Entries that aren't sounds, such as `undefined` for a
 * place with no sound, are skipped.
 */
export function findSounds(exports: Readonly<Record<string, unknown>>): ModuleSounds {
    const songs: [string, Audio80Song | Audio90Song][] = [];
    const sounds: [string, Audio80Sound | Audio90Sound][] = [];
    for (const name of Object.keys(exports)) {
        const value = exports[name];
        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) addSound(`${name}[${i}]`, value[i]);
        }
        else {
            addSound(name, value);
        }
    }
    return { songs, sounds };

    function addSound(name: string, value: unknown): void {
        if (isAudio80Song(value) || isAudio90Song(value)) songs.push([name, value]);
        else if (isAudio80Sound(value) || isAudio90Sound(value)) sounds.push([name, value]);
    }
}

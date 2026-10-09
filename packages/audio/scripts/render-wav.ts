/**
 * Renders every song and sound effect a module exports to WAV files, for
 * listening without starting the site.
 *
 * Run from the repo's root:
 *
 *     npm run audio:render -- packages/website/src/entries/galaxy-raiders/data/music.ts [more modules...]
 *
 * Files go to `renders/<the module's path>/<export>.wav`, which git ignores. Import the
 * modules that hold the sounds directly, not a barrel that also loads
 * textures, because this runs in Node.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { encodeWav, measureLoudness, measurePeak, REFERENCE_LOUDNESS_LUFS, renderSoundEffect, renderSong, findSounds } from '@mvtjs/audio/headless';

const SAMPLE_RATE = 48000;
const ROOT = process.env.INIT_CWD ?? process.cwd();
const OUT = join(ROOT, 'renders');

const modules = process.argv.slice(2);
if (modules.length === 0) {
    console.error('Name one or more modules that export songs or sound effects.');
    process.exit(1);
}

for (const path of modules) {
    const absolute = resolve(ROOT, path);
    const exports = await import(pathToFileURL(absolute).href) as Record<string, unknown>;
    // Use the module's own path, so two games' `sounds.ts` files do not overwrite each other
    const folder = join(OUT, relative(ROOT, absolute).slice(0, -extname(absolute).length));
    mkdirSync(folder, { recursive: true });
    const { songs, effects } = findSounds(exports);
    if (songs.length + effects.length === 0) console.warn(`${path}: exports no songs or sound effects`);
    for (const [name, song] of songs) write(folder, name, renderSong(song, { sampleRate: SAMPLE_RATE }), true);
    for (const [name, effect] of effects) write(folder, name, renderSoundEffect(effect, { sampleRate: SAMPLE_RATE }), false);
}

/**
 * Writes `samples` as a WAV file, and logs how long and how loud it is. For a
 * song, it logs the loudness beside the loudness all songs share.
 */
function write(folder: string, name: string, samples: Float32Array, isSong: boolean): void {
    const file = join(folder, `${name}.wav`);
    writeFileSync(file, encodeWav(samples, SAMPLE_RATE));
    const seconds = (samples.length / SAMPLE_RATE).toFixed(2);
    const loudness = isSong ? `, ${measureLoudness(samples, SAMPLE_RATE).toFixed(1)} LUFS (songs: ${REFERENCE_LOUDNESS_LUFS})` : '';
    console.log(`${file}  ${seconds} s, peak ${measurePeak(samples).toFixed(2)}${loudness}`);
}

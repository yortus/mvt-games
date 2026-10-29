/**
 * Renders every song and sound a module exports to WAV files, for listening
 * to them without a browser. An Audio80's sounds are mono files, and an
 * Audio90's stereo. It also prints each one's length and peak, and each
 * song's loudness beside the loudness every song should have.
 *
 * Run from the package's folder, naming the modules by their paths from
 * where you run it:
 *
 *     npm run render-wav -- path/to/sounds.ts [more modules...]
 *
 * Files go to `renders/<the module's path>/<export>.wav`, beside where you
 * ran it. Name the modules that hold the songs and sounds directly, not a
 * module that also loads images or the like, because this runs in Node.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';
import { encodeWav, measureLoudness, measurePeak, REFERENCE_LOUDNESS_LUFS, render, type RenderedSamples, findSounds } from 'audio90/headless';

// A module of songs and sounds imports `audio90`, which holds the browser
// chips. Each one imports its worklet's URL with Vite's `?worker&url`, which
// Node can't load. Nothing here makes a browser chip, so each such import is
// given an empty URL.
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.endsWith('?worker&url')) return { url: 'data:text/javascript,export default ""', shortCircuit: true };
        return nextResolve(specifier, context);
    },
});

const SAMPLE_RATE = 48000;
const ROOT = process.env.INIT_CWD ?? process.cwd();
const OUT = join(ROOT, 'renders');

const modules = process.argv.slice(2);
if (modules.length === 0) {
    console.error('Name one or more modules that export songs or sounds.');
    process.exit(1);
}

for (const path of modules) {
    const absolute = resolve(ROOT, path);
    const exports = await import(pathToFileURL(absolute).href) as Record<string, unknown>;
    // Use the module's own path, so two games' `sounds.ts` files do not overwrite each other.
    // Its steps up (`..`) are left out, so a module outside the folder still renders inside `renders`
    const modulePath = relative(ROOT, absolute).slice(0, -extname(absolute).length);
    const folder = join(OUT, ...modulePath.split(sep).filter((part) => part !== '..'));
    mkdirSync(folder, { recursive: true });
    const { songs, sounds } = findSounds(exports);
    if (songs.length + sounds.length === 0) console.warn(`${path}: exports no songs or sounds`);
    for (const [name, song] of songs) write(folder, name, render(song, { sampleRate: SAMPLE_RATE }), true);
    for (const [name, sound] of sounds) write(folder, name, render(sound, { sampleRate: SAMPLE_RATE }), false);
}

/**
 * Writes `samples` as a WAV file, and logs how long and how loud it is. For a
 * song, it logs the loudness beside the loudness all songs share.
 */
function write(folder: string, name: string, samples: RenderedSamples, isSong: boolean): void {
    const file = join(folder, `${name}.wav`);
    writeFileSync(file, encodeWav(samples, SAMPLE_RATE));
    const frames = samples instanceof Float32Array ? samples.length : samples.left.length;
    const seconds = (frames / SAMPLE_RATE).toFixed(2);
    const loudness = isSong ? `, ${measureLoudness(samples, SAMPLE_RATE).toFixed(1)} LUFS (songs: ${REFERENCE_LOUDNESS_LUFS})` : '';
    console.log(`${file}  ${seconds} s, peak ${measurePeak(samples).toFixed(2)}${loudness}`);
}

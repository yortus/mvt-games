# Contributing to audio90

This file is for people who work on audio90 itself. The
[README](./README.md) is for people who use it.

## Getting Started

You need Node 22.18 or later, which runs the scripts' TypeScript itself.
Install the dependencies, then run the tests:

```sh
npm install
npm test
```

| Command | What it does |
| --- | --- |
| `npm test` | Runs all of audio90's tests, in Node |
| `npm run test:watch` | Runs them again each time a file changes |
| `npm run typecheck` | Type-checks the source, the benchmarks and the scripts |
| `npm run render-wav -- <modules>` | Renders the songs and sounds each module exports to WAV files in `renders/`, with their lengths, peaks and loudness, so you can listen to them. Name each module by its path from where you run it |
| `npm run bench` | Runs the benchmarks, which [Keeping It Fast](#keeping-it-fast) describes |
| `npm run build` | Builds the package into `dist/`, as [Building and Publishing](#building-and-publishing) describes |

## The Tests

Every test is a unit test, run in Node by Vitest. Most test one module,
in a `.test.ts` file beside it. Code that only tests use is in
`.test-support.ts` files, which the published package leaves out.

The browser chips are tested against a stand-in audio context, in
`src/web/fake-audio-context.test-support.ts`. It keeps every message a
chip sends to its worklet, and a test hands the chip the replies the
worklet would send. The worklet's own code, its runners and its sequencer,
has tests of its own in `src/web/worklet/`. No test plays through a real
sound card, so a change to the browser chips needs listening to in a
browser too, on a phone as well as a desktop.

### When a Sound Changes

`src/reference-sounds.test-support.ts` holds the reference set: songs and
sounds that between them use every part of both chips, each wave, engine,
filter, effect and token. `src/reference-sounds.test.ts` renders each one
and compares a hash of its samples with the one in its Vitest snapshot. So
a change to a synthesiser, or to how a song is played, that changes what
the chips sound like fails there.

If the change was meant to change the sound, render the reference set
before and after, and listen to both:

```sh
npm run render-wav -- src/reference-sounds.test-support.ts
```

Then update the snapshot with `npx vitest run src/reference-sounds.test.ts
-u`, and say in the commit what changed and why. If the change wasn't
meant to change the sound, the failing test has found a bug.

When you add something a song or a sound can do, add a song or a sound to
the reference set that uses it. Add rather than change, so that the hashes
already there keep checking what they did.

## How It Is Laid Out

```
src/
├── index.ts            audio90
├── shared/             What every chip shares: the chip's interface, note
│   │                   names, play options and the song player
│   ├── commands/       The commands a chip is sent, and their writer
│   ├── notation/       The tracker notation every chip's songs share
│   │   └── tokens/     Rows, cells and tokens, read and printed
│   └── synthesiser/    The parts of every synthesiser: the command queue,
│                       envelopes, fades, and the maths they share
├── audio80/            The Audio80
│   ├── synthesiser/    Its voices, filters and echo
│   ├── notation/       Its sounds and songs, and what a song's rows write
│   └── chip/           Its interface
├── audio90/            The Audio90
│   ├── synthesiser/    Its voices, engines, effects and output stage
│   ├── notation/       Its sounds, samples, bouncing and songs
│   │   ├── song-text/  A song printed as text, and parsed back
│   │   └── values/     Its names for engines, waves and shapes
│   └── chip/           Its interface
├── tracker/            What an editor needs: a song's cells as text, and
│                       a scope attached to a chip
├── headless/           audio90/headless: each chip without a speaker
│   ├── rendering/      Rendering songs and sounds in memory
│   └── rendered-samples/  Hashes, peaks, loudness and WAV files
├── web/                The browser chips
│   └── worklet/        What runs on the audio thread: each chip's
│                       processor and its song sequencer
└── reference-sounds.*  The reference set, and its test
docs/                   The guides
scripts/                Rendering to WAV files, and the published manifest
bench/                  The benchmarks, and their saved results
```

A few rules hold it together:

- **The synthesisers read no clock.** Each one, in `src/audio80/synthesiser/`
  and `src/audio90/synthesiser/`, is plain TypeScript with no Web Audio in
  it. It turns commands, each stamped with a time, into samples. So the
  same commands always render the same samples, in a browser and in Node.
  That is what makes the reference set's hashes exact.
- **Two threads in a browser.** The page's side of a browser chip is in
  `src/web/`. The audio thread's side, the worklet, is in `src/web/worklet/`:
  each chip's processor, its runner, and the song sequencer, which plays
  songs on the sound card's clock. Worklet code never imports the page's
  side, and the two talk only through the messages in
  `src/web/worklet/song-messages.ts` and the commands in
  `src/shared/commands/`.
- **The chips share what they can.** `src/shared/` holds what both chips
  have in common: the chip's interface and play options, the song player,
  the tracker notation's core, and the parts of every synthesiser.
- **What only an editor needs stays out of a game's bundle.** `src/tracker/`
  holds scopes and the cell printer, and a song's text form is in
  `src/audio90/notation/song-text/`. A page that only plays songs and
  sounds loads none of them, since the package has no side effects.

## Conventions

- **Each folder has an `index.ts`,** which exports what the folders outside
  it may use. Import another folder through its `index.ts`, never a file
  inside it, and never import the `index.ts` of your own folder or one
  above it: import the file you need directly.
- **A file is named for its main export,** in kebab case: `createAudio90Song`
  is in `audio90-song.ts`, and `bounceAudio90Song` in
  `bounce-audio90-song.ts`. Prefer one main export to a file. Rename a
  file, and its test, with its export.
- **Factory functions, not classes.** `createXxx(options)` takes one
  options object and returns an interface, built from a plain object and
  closures. The one class is the worklet's processor, in
  `src/web/worklet/register-chip-processor.ts`, since Web Audio requires
  one, and it is the only code that uses `this`.
- **No `null`.** Use `undefined` for a missing value.
- **String-literal unions,** such as `'lowpass' | 'highpass'`, not enums.
- **Function-valued properties in types,** such as
  `play: (sound: S) => number`, not method signatures.
- **Four spaces** to indent, `PascalCase` for types and `camelCase` for
  the rest.
- **Plain writing,** in docs, comments, test names and error messages:
  short, complete sentences in everyday words, which say why as well as
  what. Explain a term where it first appears. Use hyphens, not em-dashes.
- **Error messages say where and what,** such as
  `sound: pulseWidth must be 0 to 1; got 2`.

## Keeping It Fast

A synthesiser runs for every sample, 48,000 times a second for each voice.
A browser's audio thread asks for a block of samples and must have it in
time, or the listener hears a gap. So the code a synthesiser runs for each
sample allocates nothing, and avoids anything that might make V8 box a
number:

- Keep per-voice state in typed arrays, not in objects.
- Don't pass a number computed in the sample loop to a shared function that
  V8 might not inline. Pass the object it came from, and the scale.
- Prefer multiplying by exactly 1 to branching between two numbers.
- Use index-based `for` loops, never `map`, `for...of` or closures, in
  anything that runs each block or each tick.

`bench/run.ts` measures how long each synthesiser takes to render a block,
how much it allocates, how long a busy song takes a tick, and how long a
sample takes to bounce. It bundles each suite first, as an app's build
bundles the chip, since a bundle can run differently from its source.
`npm run bench -- --save` writes the results to `bench/results/`, where
they are kept with the code, so a change's effect shows in its diff. Run
before and after a change one after the other, with nothing else running,
since a busy machine slows every case by 10% or more.

## Building and Publishing

While you work, nothing needs building. The entry points in `package.json`
name the TypeScript source, and each browser chip loads its worklet with
Vite's `?worker&url` import, which Vite and Vitest understand.

The published package is built, since Node won't run TypeScript inside
`node_modules`, and since a worklet must be bundled to load in a browser.
`npm pack` and `npm publish` both run `prepack` first, in two steps:

1. tsdown builds the package into `dist/`, as one JavaScript file and one
   declaration file for each module. Its `inlineWorklets` plugin, in
   `tsdown.config.ts`, turns each `?worker&url` import into the worklet's
   own code, bundled and minified, served from a Blob URL. So the package
   works with any bundler, or none, with no file to copy beside an app.
2. `scripts/publish-manifest.ts` puts in place a `package.json` whose entry
   points name those files, and leaves out the `#rendering-audio80` and
   `#rendering-audio90` imports, which only the benchmarks use. Then it
   checks the package with publint and attw, packed as npm will pack it.

`postpack` puts the working `package.json` back once the tarball is made,
even when a publish fails.

To check a change to the build, pack the package, install the tarball in a
scratch folder of its own, and import both entry points there, `audio90`
and `audio90/headless`.

Releases are made with [Changesets](https://github.com/changesets/changesets).
A change that people using audio90 should hear about gets a change file:
run `npx changeset`, choose the size of the bump, and write a line or two
for the changelog. When a release is made, the change files become the
new version and its entry in `CHANGELOG.md`, and the release is published
to npm through npm's trusted publishing.

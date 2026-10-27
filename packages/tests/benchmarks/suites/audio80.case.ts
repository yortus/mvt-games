import { type Audio80Wave, createAudio80Song, createAudio80Sound, createMusicPlayer } from 'audio90';
import { createHeadlessAudio80 } from 'audio90/headless';
import { allocationPerFrame, readParams, report, timeFrames } from '../harness/measure';

// Measured file for the `audio80` suite. It times the headless chip rendering
// one block of 128 samples, which is how much a browser's audio thread asks
// for at a time. Each block goes into the same buffer, with nothing new
// written. Every voice holds a note that keeps the chip busy, with a pulse
// sweep, vibrato, an arpeggio and the echo.

const SAMPLE_RATE = 48000;
const BLOCK = 128;
/** Each note's name within its octave, as a song's patterns write it. */
const NOTE_NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];

const params = readParams();
const voices = Number(params.voices);
const wave = String(params.wave) as Audio80Wave;
const isFiltered = String(params.filtered) === 'both';

const chip = createHeadlessAudio80({ render: { sampleRate: SAMPLE_RATE } });
const instruments = [0, 1].map((half) => createAudio80Sound({
    wave,
    pulseWidth: 0.3,
    pulseSweep: { to: 0.7, ms: 400, isPingPong: true },
    vibrato: { semitones: 0.2, hz: 5 },
    arpeggio: [0, 4, 7],
    echo: 0.3,
    filter: isFiltered ? (half === 0 ? 'a' : 'b') : undefined,
}));
// Every voice holds a note, as a song's first row starts them: one channel a voice, each sound on every other one
const cells: string[] = [];
for (let v = 0; v < voices; v++) cells.push(`| ${toNoteName(48 + v * 3)} ${v % 2 === 0 ? 'a' : 'b'} vC`);
const held = createAudio80Song({ bpm: 120, instruments: { a: instruments[0], b: instruments[1] }, patterns: { p: cells.join(' ') }, order: ['p'] });
createMusicPlayer({ audio80: chip.audio80 }).play(held);
// One tick starts the song's first row. The song moves no further, since nothing else moves the chip's clock
chip.controls.update(1000 / 60);

const output = new Float32Array(BLOCK);
// The first render takes the notes in, so each block measured has nothing new to play
chip.render(output);

const renderBlock = (): void => {
    chip.render(output);
};

if (String(params.measure) === 'allocation') {
    report({ bytesPerBlock: await allocationPerFrame(renderBlock) });
}
else {
    report({ usPerBlock: timeFrames(renderBlock) });
}

/** The tracker name of note number `note`, such as `C-4` for 60. */
function toNoteName(note: number): string {
    return NOTE_NAMES[note % 12] + String(Math.floor(note / 12) - 1);
}

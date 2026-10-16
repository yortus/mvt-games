import { createInstrument, type Wave } from '@mvtjs/audio';
import { createHeadlessAudio80 } from '@mvtjs/audio/headless';
import { allocationPerFrame, readParams, report, timeFrames } from '../harness/measure';

// Measured file for the `audio80` suite. It times the headless chip rendering
// one block of 128 samples, which is how much a browser's audio thread asks
// for at a time. Each block goes into the same buffer, with nothing new
// written. Every voice holds a note that keeps the chip busy, with a pulse
// sweep, vibrato, an arpeggio and the echo.

const SAMPLE_RATE = 48000;
const BLOCK = 128;

const params = readParams();
const voices = Number(params.voices);
const wave = String(params.wave) as Wave;
const isFiltered = String(params.filtered) === 'both';

const chip = createHeadlessAudio80({ render: { sampleRate: SAMPLE_RATE } });
const instruments = [0, 1].map((half) => createInstrument({
    wave,
    pulseWidth: 0.3,
    pulseSweep: { to: 0.7, ms: 400, isPingPong: true },
    vibrato: { semitones: 0.2, hz: 5 },
    arpeggio: [0, 4, 7],
    echo: 0.3,
    filter: isFiltered ? (half === 0 ? 'a' : 'b') : undefined,
}));
for (let v = 0; v < voices; v++) chip.audio80.noteOn(v, instruments[v % 2], 48 + v * 3, 0.8);

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

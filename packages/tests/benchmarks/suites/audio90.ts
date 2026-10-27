import { combinations, type Suite } from '../harness/suite';

const ALLOCATION_FLAGS = ['--expose-gc', '--max-semi-space-size=128'];
const ENGINES = ['fm', 'fm-console', 'analog-1', 'analog-7', 'sample'];

/** The Audio90 rendering 128-sample stereo blocks through the headless chip, a busy song played on the chip, and bouncing samples. */
export const audio90Suite: Suite = {
    name: 'audio90',
    description: 'the Audio90 rendering 128-sample stereo blocks at 48 kHz through the headless chip, by engine and voices playing; a busy song played on the chip, a tick at a time; and bouncing samples',
    entry: 'audio90.case.ts',
    cases: [
        { params: { measure: 'time', engine: 'none', voices: 0 } },
        ...combinations({ measure: ['time'], engine: ENGINES, voices: [1, 8, 16] }).map((params) => ({ params })),
        ...combinations({ measure: ['time'], engine: ['mix'], voices: [8, 16] }).map((params) => ({ params })),
        // Timed and counted in one process, so it runs alone, with the flags allocation needs
        { params: { measure: 'tick', engine: 'song', voices: 10 }, nodeArgs: ALLOCATION_FLAGS },
        { params: { measure: 'allocation', engine: 'none', voices: 0 }, nodeArgs: ALLOCATION_FLAGS, countsOnly: true },
        ...combinations({ measure: ['allocation'], engine: [...ENGINES, 'mix'], voices: [16] })
            .map((params) => ({ params, nodeArgs: ALLOCATION_FLAGS, countsOnly: true })),
        ...combinations({ measure: ['bounce'], sample: ['hit', 'break', 'busy', 'busy-reverb'] }).map((params) => ({ params })),
    ],
    tables: [
        {
            id: 'time',
            title: 'Time per 128-sample stereo block (2.67 ms of sound at 48 kHz), the chorus, echo and reverb running',
            metric: 'usPerBlock',
            unit: 'µs',
            where: { measure: 'time' },
            rows: ['engine'],
            column: 'voices',
        },
        {
            id: 'allocation',
            title: 'Bytes allocated per block, by engine on sixteen voices',
            metric: 'bytesPerBlock',
            unit: 'B',
            where: { measure: 'allocation' },
            rows: ['engine'],
            column: 'voices',
            maxDecimals: 0,
        },
        {
            id: 'song',
            title: 'A busy song of ten channels played on the chip, per tick of 1/60 s: the clock, the song player\'s update and refresh, the writes, and 800 samples rendered',
            where: { engine: 'song' },
            rows: ['engine'],
            metrics: [
                { key: 'usPerTick', title: 'Time per tick (µs)' },
                { key: 'bytesPerTick', title: 'Bytes allocated per tick (B)', maxDecimals: 0 },
            ],
        },
        {
            id: 'bounce',
            title: 'Bouncing a sample, as an entry does while it loads: the median of seven, each made afresh',
            where: { measure: 'bounce' },
            rows: ['sample'],
            metrics: [
                { key: 'msPerBounce', title: 'Time (ms)' },
                { key: 'samples', title: 'Samples kept', maxDecimals: 0 },
            ],
        },
    ],
    labels: {
        voices: { 0: 'no voices', 1: '1 voice', 8: '8 voices', 10: '10 channels', 16: '16 voices' },
        engine: {
            'none': 'the effects alone',
            'fm': 'FM, four operators (an electric piano)',
            'fm-console': 'FM, with the console character',
            'analog-1': 'analog, one saw, a 24 dB filter (an acid bass)',
            'analog-7': 'analog, seven saws in stereo (a supersaw), within the budget of 48 oscillators',
            'sample': 'sample, looping',
            'mix': 'a busy mix of every engine',
            'song': 'a busy song, played on the chip',
        },
        sample: {
            'hit': 'an orchestra hit, 0.75 s at 32 kHz',
            'break': 'a two-bar break, 2.8 s at 26 kHz and 12 bits, in 32 slices',
            'busy': '8 s of two seven-saw chords and two FM notes at 32 kHz, all of sample memory',
            'busy-reverb': 'the same, with the song setting the reverb, so the effects run',
        },
    },
};

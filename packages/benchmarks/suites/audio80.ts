import { combinations, type Suite } from '../harness/suite';

const ALLOCATION_FLAGS = ['--expose-gc', '--max-semi-space-size=128'];

/** The Audio80 rendering through the headless chip, one 128-sample block at a time, as a browser asks for them. */
export const audio80Suite: Suite = {
    name: 'audio80',
    description: 'the Audio80 rendering 128-sample blocks at 48 kHz through the headless chip, by voices playing, waveform and filtering',
    entry: 'audio80.case.ts',
    cases: [
        ...combinations({
            measure: ['time'],
            filtered: ['none', 'both'],
            wave: ['pulse', 'saw+pulse', 'noise'],
            voices: [1, 4, 8],
        }).map((params) => ({ params })),
        ...combinations({
            measure: ['allocation'],
            filtered: ['both'],
            wave: ['pulse'],
            voices: [8],
        }).map((params) => ({ params, nodeArgs: ALLOCATION_FLAGS, countsOnly: true })),
    ],
    tables: [
        {
            id: 'unfiltered',
            title: 'Time per 128-sample block (2.67 ms of sound at 48 kHz), voices straight to the output',
            metric: 'usPerBlock',
            unit: 'µs',
            where: { measure: 'time', filtered: 'none' },
            rows: ['wave'],
            column: 'voices',
        },
        {
            id: 'filtered',
            title: 'Time per 128-sample block, voices split between the two filters',
            metric: 'usPerBlock',
            unit: 'µs',
            where: { measure: 'time', filtered: 'both' },
            rows: ['wave'],
            column: 'voices',
        },
        {
            id: 'allocation',
            title: 'Bytes allocated per block, eight voices, both filters, the echo',
            metric: 'bytesPerBlock',
            unit: 'B',
            where: { measure: 'allocation' },
            rows: ['wave'],
            column: 'voices',
            maxDecimals: 0,
        },
    ],
    labels: {
        voices: { 1: '1 voice', 4: '4 voices', 8: '8 voices' },
        wave: { 'pulse': 'pulse, with a sweep and vibrato', 'saw+pulse': 'saw and pulse combined', 'noise': 'noise' },
    },
};

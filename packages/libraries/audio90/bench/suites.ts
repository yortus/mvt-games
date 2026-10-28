// ---------------------------------------------------------------------------
// The suites: what each measures, its cases, and the tables it shows
// ---------------------------------------------------------------------------

/** A case's params, which its file reads with `readParams`. */
export type Params = Readonly<Record<string, string | number>>;

/** A suite: one file, measured once for each of its cases. */
export interface Suite {
    readonly name: string;
    readonly description: string;
    /** The file each case runs, in `bench/`. */
    readonly file: string;
    readonly cases: readonly Case[];
    readonly tables: readonly Table[];
    /** How a param's values read in a table, by param, then by value. A value with no label reads as itself. */
    readonly labels: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/** One case of a suite, run in a process of its own. */
export interface Case {
    readonly params: Params;
    /** Node's flags for the case's process, such as `--expose-gc`. */
    readonly nodeArgs?: readonly string[];
    /** Whether it counts something that is the same in every process, such as bytes allocated, so it runs only once. */
    readonly isCount?: boolean;
}

/**
 * A table of results: a row for each value of the param `row`, among the
 * cases that match `where`. Its columns are either the values of the param
 * `column`, each showing `metric`, or one column for each of `metrics`.
 */
export interface Table {
    readonly title: string;
    readonly where: Params;
    readonly row: string;
    readonly column?: { readonly param: string; readonly metric: string; readonly unit: string; readonly maxDecimals?: number };
    readonly metrics?: readonly { readonly key: string; readonly title: string; readonly maxDecimals?: number }[];
}

/** Node's flags for a case that measures allocation. */
const ALLOCATION_FLAGS = ['--expose-gc', '--max-semi-space-size=128'];
const AUDIO90_ENGINES = ['fm', 'fm-console', 'analog-1', 'analog-7', 'sample'];

/** The Audio80 rendering through the rendering chip, one 128-sample block at a time, as a browser asks for them. */
const AUDIO80: Suite = {
    name: 'audio80',
    description: 'the Audio80 rendering 128-sample blocks at 48 kHz, by voices playing, waveform and filtering',
    file: 'audio80.case.ts',
    cases: [
        ...combine({ measure: ['time'], filtered: ['none', 'both'], wave: ['pulse', 'saw+pulse', 'noise'], voices: [1, 2, 4] })
            .map((params) => ({ params })),
        { params: { measure: 'allocation', filtered: 'both', wave: 'pulse', voices: 4 }, nodeArgs: ALLOCATION_FLAGS, isCount: true },
    ],
    tables: [
        {
            title: 'Time per 128-sample block (2.67 ms of sound at 48 kHz), voices straight to the output',
            where: { measure: 'time', filtered: 'none' },
            row: 'wave',
            column: { param: 'voices', metric: 'usPerBlock', unit: 'µs' },
        },
        {
            title: 'Time per 128-sample block, voices split between the two filters',
            where: { measure: 'time', filtered: 'both' },
            row: 'wave',
            column: { param: 'voices', metric: 'usPerBlock', unit: 'µs' },
        },
        {
            title: 'Bytes allocated per block, four voices, both filters, the echo',
            where: { measure: 'allocation' },
            row: 'wave',
            column: { param: 'voices', metric: 'bytesPerBlock', unit: 'B', maxDecimals: 0 },
        },
    ],
    labels: {
        voices: { 1: '1 voice', 2: '2 voices', 4: '4 voices' },
        wave: { 'pulse': 'pulse, with a sweep and vibrato', 'saw+pulse': 'saw and pulse combined', 'noise': 'noise' },
    },
};

/** The Audio90 rendering 128-sample stereo blocks, a busy song played on the chip, and bouncing samples. */
const AUDIO90: Suite = {
    name: 'audio90',
    description: 'the Audio90 rendering 128-sample stereo blocks at 48 kHz, by engine and voices playing; a busy song played on the chip, a tick at a time; and bouncing samples',
    file: 'audio90.case.ts',
    cases: [
        { params: { measure: 'time', engine: 'none', voices: 0 } },
        ...combine({ measure: ['time'], engine: AUDIO90_ENGINES, voices: [1, 8, 16] }).map((params) => ({ params })),
        ...combine({ measure: ['time'], engine: ['mix'], voices: [8, 16] }).map((params) => ({ params })),
        // Timed and counted in one process, so it runs with the flags allocation needs
        { params: { measure: 'tick', engine: 'song', voices: 10 }, nodeArgs: ALLOCATION_FLAGS },
        { params: { measure: 'allocation', engine: 'none', voices: 0 }, nodeArgs: ALLOCATION_FLAGS, isCount: true },
        ...combine({ measure: ['allocation'], engine: [...AUDIO90_ENGINES, 'mix'], voices: [16] })
            .map((params) => ({ params, nodeArgs: ALLOCATION_FLAGS, isCount: true })),
        ...combine({ measure: ['bounce'], sample: ['hit', 'break', 'busy', 'busy-reverb'] }).map((params) => ({ params })),
    ],
    tables: [
        {
            title: 'Time per 128-sample stereo block (2.67 ms of sound at 48 kHz), the chorus, echo and reverb running',
            where: { measure: 'time' },
            row: 'engine',
            column: { param: 'voices', metric: 'usPerBlock', unit: 'µs' },
        },
        {
            title: 'Bytes allocated per block, by engine on sixteen voices',
            where: { measure: 'allocation' },
            row: 'engine',
            column: { param: 'voices', metric: 'bytesPerBlock', unit: 'B', maxDecimals: 0 },
        },
        {
            title: 'A busy song of ten channels played on the chip, per tick of 1/60 s: the clock, the song player, the writes, and 800 samples rendered',
            where: { engine: 'song' },
            row: 'engine',
            metrics: [
                { key: 'usPerTick', title: 'Time per tick (µs)' },
                { key: 'bytesPerTick', title: 'Bytes allocated per tick (B)', maxDecimals: 0 },
            ],
        },
        {
            title: 'Bouncing a sample, as an entry does while it loads: the median of seven, each made afresh',
            where: { measure: 'bounce' },
            row: 'sample',
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

/** Every suite, in the order they run. */
export const SUITES: readonly Suite[] = [AUDIO80, AUDIO90];

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Returns every combination of the params' values, the first param's varying slowest. */
function combine(axes: Readonly<Record<string, readonly (string | number)[]>>): Params[] {
    let combinations: Record<string, string | number>[] = [{}];
    for (const [param, values] of Object.entries(axes)) {
        combinations = combinations.flatMap((partial) => values.map((value) => ({ ...partial, [param]: value })));
    }
    return combinations;
}

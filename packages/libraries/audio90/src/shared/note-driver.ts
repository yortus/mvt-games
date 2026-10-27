// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Moves each voice's note on through time, as the sound drivers of the
 * 1980s and 1990s did once a frame. It works out each voice's note number
 * from the note played, a glide towards it, the sound's step table, its
 * arpeggio and vibrato, and a slide. It also ends a note with a set length,
 * such as a play's.
 *
 * What else a step row sets, such as a waveform or a volume, is each chip's
 * own. The driver hands each new row to the chip's `onStep`, and the chip
 * reads what it needs from it.
 *
 * It runs at the chip's control rate, a few times a millisecond, not once a
 * sample. Its state is in typed arrays, one slot per voice, so it allocates
 * nothing as it runs.
 */
export interface NoteDriver<S extends DriverStep> {
    /** Each voice's note number now. It may be fractional, as for a glide or vibrato. */
    readonly currentNote: Float64Array;
    /** How long each voice's note has played, in samples. */
    readonly noteSamples: Float64Array;
    /**
     * Starts a note on voice `v`, at note number `note`. It forgets the last
     * note's glide, slide, steps and length, and remembers its pitch for a
     * glide from it.
     */
    start: (v: number, instrument: DriverSound<S>, note: number) => void;
    /**
     * Moves voice `v`'s note on by `elapsed` samples, then works out its note
     * number. With an `elapsed` of 0, it only works out the note number, as
     * just after a note starts.
     */
    control: (v: number, elapsed: number) => void;
    /** Changes voice `v`'s note without starting it again, and stops any glide. */
    setNote: (v: number, note: number) => void;
    /** Sets voice `v`'s arpeggio to the note, up x and up y semitones, packed as `x * 16 + y`. 0 or less stops it. */
    setArpeggio: (v: number, packed: number) => void;
    /** Sets voice `v`'s vibrato depth in semitones each way, starting at once, with no delay. */
    setVibratoDepth: (v: number, semitones: number) => void;
    /** Sets voice `v`'s vibrato rate, in Hz. */
    setVibratoRate: (v: number, hz: number) => void;
    /** Slides voice `v`'s pitch by this many semitones a second, until its next note. */
    setSlide: (v: number, semitonesPerSecond: number) => void;
    /** Glides voice `v` from its last note to the one it plays, over this many ms. */
    setGlide: (v: number, ms: number) => void;
    /** Glides voice `v` from note `from` to note `to` over `ms`, as a play with a glide does. */
    glideBetween: (v: number, from: number, to: number, ms: number) => void;
    /** Ends voice `v`'s note after `samples` samples, calling `onEnd`. 0 means it has no set length. */
    setLength: (v: number, samples: number) => void;
    /** Puts voice `v` back at rest, with no steps, arpeggio, vibrato, slide, glide or length, at middle C. */
    reset: (v: number) => void;
}

/** What the driver reads from a sound as a note starts. */
export interface DriverSound<S extends DriverStep> {
    /** How long each step of the step table lasts, in ms. 0 or less uses `DEFAULT_STEP_MS`. */
    readonly stepMs: number;
    /** The step table, one row a step. The last row holds once it is reached. */
    readonly steps: readonly S[];
    /** Semitone offsets, one a step, round and round. Empty for none. */
    readonly arpeggio: readonly number[];
    readonly vibratoSemitones: number;
    readonly vibratoHz: number;
    /** How long the note plays before its vibrato starts, in ms. */
    readonly vibratoDelayMs: number;
}

/** What the driver reads from a step row: its pitch. A chip's rows hold more, which its `onStep` reads. */
export interface DriverStep {
    readonly pitchMode: StepPitchMode;
    /** Semitones from the note for `'relative'`, or a note number for `'absolute'`. */
    readonly pitch: number;
}

/** How a step row sets the pitch: not at all, as an offset from the note, or as a note of its own. */
export type StepPitchMode = 'none' | 'relative' | 'absolute';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a note driver. */
export interface NoteDriverOptions<S extends DriverStep> {
    readonly voiceCount: number;
    /** The rate the chip renders at, in samples a second. */
    readonly sampleRate: number;
    /** Called when voice `v`'s note reaches a new row of its step table, after the driver has taken the row's pitch. */
    readonly onStep: (v: number, step: S) => void;
    /** Called when voice `v`'s note reaches the end of its set length. The chip releases the note. */
    readonly onEnd: (v: number) => void;
}

/** How long a step lasts, in ms, when a sound does not say. This gives 60 steps a second. */
export const DEFAULT_STEP_MS = 1000 / 60;

/** The most semitone offsets a sound's arpeggio may have, which is as many as the driver holds. It ignores any more. */
export const MAX_ARPEGGIO = 16;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a note driver with every voice at rest. */
export function createNoteDriver<S extends DriverStep>(options: NoteDriverOptions<S>): NoteDriver<S> {
    const { voiceCount, sampleRate, onStep, onEnd } = options;
    const msPerSample = 1000 / sampleRate;

    const currentNote = new Float64Array(voiceCount);
    const noteSamples = new Float64Array(voiceCount);
    const baseNote = new Float64Array(voiceCount);
    const previousNote = new Float64Array(voiceCount);
    const voiceSteps: (readonly S[])[] = [];
    for (let v = 0; v < voiceCount; v++) voiceSteps.push([]);
    const stepMs = new Float64Array(voiceCount);
    const stepIndex = new Int32Array(voiceCount);
    const stepPitchMode = new Int32Array(voiceCount);
    const stepPitch = new Float64Array(voiceCount);
    const arpeggio = new Float64Array(voiceCount * MAX_ARPEGGIO);
    const arpeggioLength = new Int32Array(voiceCount);
    const vibratoDepth = new Float64Array(voiceCount);
    const vibratoHz = new Float64Array(voiceCount);
    const vibratoDelayMs = new Float64Array(voiceCount);
    const slideRate = new Float64Array(voiceCount);
    const slideOffset = new Float64Array(voiceCount);
    const glideFrom = new Float64Array(voiceCount);
    const glideMs = new Float64Array(voiceCount);
    const glideElapsed = new Float64Array(voiceCount);
    // Samples until the note ends. It is 0 for a note with no set length
    const lengthCountdown = new Float64Array(voiceCount);
    const noSteps: readonly S[] = [];

    const driver: NoteDriver<S> = {
        currentNote,
        noteSamples,

        start(v, instrument, note) {
            voiceSteps[v] = instrument.steps;
            // Resolved here, and without a choice between the two values: a choice between a double and a module
            // constant makes V8 box the double, once a bundler turns the constant into a `var`
            stepMs[v] = instrument.stepMs;
            if (!(stepMs[v] > 0)) stepMs[v] = DEFAULT_STEP_MS;
            arpeggioLength[v] = Math.min(instrument.arpeggio.length, MAX_ARPEGGIO);
            for (let i = 0; i < arpeggioLength[v]; i++) arpeggio[v * MAX_ARPEGGIO + i] = instrument.arpeggio[i];
            vibratoDepth[v] = instrument.vibratoSemitones;
            vibratoHz[v] = instrument.vibratoHz;
            vibratoDelayMs[v] = instrument.vibratoDelayMs;
            previousNote[v] = currentNote[v];
            baseNote[v] = note;
            stepIndex[v] = -1;
            stepPitchMode[v] = PITCH_NONE;
            noteSamples[v] = 0;
            slideRate[v] = 0;
            slideOffset[v] = 0;
            glideMs[v] = 0;
            lengthCountdown[v] = 0;
        },

        control(v, elapsed) {
            if (elapsed > 0) {
                noteSamples[v] += elapsed;
                const elapsedMs = elapsed * msPerSample;
                slideOffset[v] += slideRate[v] * elapsedMs / 1000;
                if (glideMs[v] > 0) glideElapsed[v] += elapsedMs;
                if (lengthCountdown[v] > 0) {
                    lengthCountdown[v] -= elapsed;
                    if (lengthCountdown[v] <= 0) onEnd(v);
                }
            }
            const tMs = noteSamples[v] * msPerSample;
            const step = stepMs[v];

            const steps = voiceSteps[v];
            if (steps.length > 0) {
                const index = Math.min(Math.floor(tMs / step), steps.length - 1);
                if (index !== stepIndex[v]) {
                    stepIndex[v] = index;
                    const row = steps[index];
                    if (row.pitchMode === 'relative') {
                        stepPitchMode[v] = PITCH_RELATIVE;
                        stepPitch[v] = row.pitch;
                    }
                    else if (row.pitchMode === 'absolute') {
                        stepPitchMode[v] = PITCH_ABSOLUTE;
                        stepPitch[v] = row.pitch;
                    }
                    onStep(v, row);
                }
            }

            let note = baseNote[v];
            if (glideMs[v] > 0) {
                const u = glideElapsed[v] >= glideMs[v] ? 1 : glideElapsed[v] / glideMs[v];
                note = glideFrom[v] + (baseNote[v] - glideFrom[v]) * u;
            }
            if (stepPitchMode[v] === PITCH_RELATIVE) note += stepPitch[v];
            else if (stepPitchMode[v] === PITCH_ABSOLUTE) note = stepPitch[v];
            if (arpeggioLength[v] > 0) {
                note += arpeggio[v * MAX_ARPEGGIO + (Math.floor(tMs / step) % arpeggioLength[v])];
            }
            if (vibratoDepth[v] > 0 && tMs > vibratoDelayMs[v]) {
                note += vibratoDepth[v] * Math.sin(TWO_PI * vibratoHz[v] * (tMs - vibratoDelayMs[v]) / 1000);
            }
            note += slideOffset[v];
            currentNote[v] = note;
        },

        setNote(v, note) {
            baseNote[v] = note;
            glideMs[v] = 0;
        },

        setArpeggio(v, packed) {
            if (packed <= 0) {
                arpeggioLength[v] = 0;
                return;
            }
            arpeggio[v * MAX_ARPEGGIO] = 0;
            arpeggio[v * MAX_ARPEGGIO + 1] = Math.floor(packed / 16);
            arpeggio[v * MAX_ARPEGGIO + 2] = packed % 16;
            arpeggioLength[v] = 3;
        },

        setVibratoDepth(v, semitones) {
            vibratoDepth[v] = Math.max(0, semitones);
            vibratoDelayMs[v] = 0;
        },

        setVibratoRate(v, hz) {
            vibratoHz[v] = Math.max(0, hz);
        },

        setSlide(v, semitonesPerSecond) {
            slideRate[v] = semitonesPerSecond;
        },

        setGlide(v, ms) {
            glideFrom[v] = previousNote[v];
            glideMs[v] = Math.max(0, ms);
            glideElapsed[v] = 0;
        },

        glideBetween(v, from, to, ms) {
            glideFrom[v] = from;
            baseNote[v] = to;
            glideMs[v] = ms;
            glideElapsed[v] = 0;
        },

        setLength(v, samples) {
            lengthCountdown[v] = samples;
        },

        reset(v) {
            voiceSteps[v] = noSteps;
            stepMs[v] = DEFAULT_STEP_MS;
            stepIndex[v] = -1;
            stepPitchMode[v] = PITCH_NONE;
            noteSamples[v] = 0;
            baseNote[v] = MIDDLE_C;
            previousNote[v] = MIDDLE_C;
            currentNote[v] = MIDDLE_C;
            arpeggioLength[v] = 0;
            vibratoDepth[v] = 0;
            slideRate[v] = 0;
            slideOffset[v] = 0;
            glideMs[v] = 0;
            lengthCountdown[v] = 0;
        },
    };

    for (let v = 0; v < voiceCount; v++) driver.reset(v);
    return driver;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const PITCH_NONE = 0;
const PITCH_RELATIVE = 1;
const PITCH_ABSOLUTE = 2;
const TWO_PI = Math.PI * 2;
const MIDDLE_C = 60;

import {
    ENGINE_ANALOG,
    ENGINE_FM,
    ENGINE_SAMPLE,
    FILTER90_BANDPASS,
    FILTER90_HIGHPASS,
    FILTER90_LOWPASS_12,
    FILTER90_LOWPASS_24,
    FILTER90_NONE,
    LFO_RANDOM,
    LFO_SAW,
    LFO_SINE,
    LFO_SQUARE,
    LFO_TRIANGLE,
    OP_WAVE_ABS_SINE,
    OP_WAVE_HALF_SINE,
    OP_WAVE_QUARTER_SINE,
    OP_WAVE_SINE,
    WAVE90_PULSE,
    WAVE90_SAW,
    WAVE90_SINE,
    WAVE90_TRIANGLE,
} from '../../synthesiser';

// The Audio90's names for its engines, waves, filter modes and LFO shapes,
// and the numbers the chip is sent for them. The grammar that every chip's
// notation shares, such as rows, cells and hex tokens, is in the shared
// folder.

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** How an instrument makes its sound: FM operators, analog oscillators, or a sample. */
export type Audio90Engine = 'fm' | 'analog' | 'sample';

/** An analog oscillator's wave. */
export type Audio90Wave = 'saw' | 'pulse' | 'triangle' | 'sine';

/**
 * An FM operator's wave. Beside the sine, three shapes cut from it, as the
 * era's cheaper FM chips had: its top half (`half-sine`), both halves turned
 * up (`abs-sine`), and the rising quarter of each half (`quarter-sine`).
 */
export type Audio90OperatorWave = 'sine' | 'half-sine' | 'abs-sine' | 'quarter-sine';

/**
 * A voice's filter. `lowpass24` is a four-pole ladder, which rings at its
 * cutoff near full resonance. `lowpass12`, `bandpass` and `highpass` are
 * gentler.
 */
export type Audio90FilterMode = 'none' | 'lowpass24' | 'lowpass12' | 'bandpass' | 'highpass';

/** An LFO's shape. `random` is a new random level each cycle. */
export type Audio90LfoShape = 'sine' | 'triangle' | 'square' | 'saw' | 'random';

/** Each engine's number in an instrument's data. */
export const ENGINE_INDEX: Readonly<Record<Audio90Engine, number>> = { fm: ENGINE_FM, analog: ENGINE_ANALOG, sample: ENGINE_SAMPLE };

/** Each analog wave's number in an instrument's data. */
export const WAVE90_INDEX: Readonly<Record<Audio90Wave, number>> = { saw: WAVE90_SAW, pulse: WAVE90_PULSE, triangle: WAVE90_TRIANGLE, sine: WAVE90_SINE };

/** Each operator wave's number in an operator's data. */
export const OPERATOR_WAVE_INDEX: Readonly<Record<Audio90OperatorWave, number>> = {
    'sine': OP_WAVE_SINE,
    'half-sine': OP_WAVE_HALF_SINE,
    'abs-sine': OP_WAVE_ABS_SINE,
    'quarter-sine': OP_WAVE_QUARTER_SINE,
};

/** Each filter mode's number in an instrument's data. */
export const FILTER90_MODE_INDEX: Readonly<Record<Audio90FilterMode, number>> = {
    none: FILTER90_NONE,
    lowpass24: FILTER90_LOWPASS_24,
    lowpass12: FILTER90_LOWPASS_12,
    bandpass: FILTER90_BANDPASS,
    highpass: FILTER90_HIGHPASS,
};

/** Each LFO shape's number in an instrument's data. */
export const LFO_SHAPE_INDEX: Readonly<Record<Audio90LfoShape, number>> = {
    sine: LFO_SINE,
    triangle: LFO_TRIANGLE,
    square: LFO_SQUARE,
    saw: LFO_SAW,
    random: LFO_RANDOM,
};

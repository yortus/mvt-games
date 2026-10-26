import { type Audio80Wave, toWaveFlags } from '../synthesiser';

// The Audio80's own tokens. The grammar that every chip's notation shares,
// such as rows, cells and hex tokens, is in the shared folder's tracker.

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The waveform flags of a wave token (`pulse`, `triangle+saw`), or undefined if it is not one. */
export function parseWaveToken(token: string): number | undefined {
    return (WAVES as readonly string[]).includes(token) ? toWaveFlags(token as Audio80Wave) : undefined;
}

/** Every wave a step row or an instrument may name. */
export const WAVES: readonly Audio80Wave[] = [
    'triangle', 'saw', 'pulse', 'noise', 'wavetable', 'triangle+saw', 'triangle+pulse', 'saw+pulse', 'triangle+saw+pulse',
];

import { HIGHEST_NOTE, LOWEST_NOTE, type Wave, toWaveFlags } from '../core';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Splits a pattern or a step table into its rows, one per line, with each
 * line's indentation trimmed. A `#` starts a comment when it begins the line
 * or follows a space, and the comment runs to the end of the line. So
 * `| C-4 L  # bar 2` is a row with a comment after it, while `F#5` is a
 * note. Lines left blank once their comments are removed are skipped.
 */
export function splitRows(text: string): string[] {
    const rows: string[] = [];
    for (const line of text.split('\n')) {
        const comment = COMMENT.exec(line);
        const trimmed = (comment === null ? line : line.slice(0, comment.index)).trim();
        if (trimmed !== '') rows.push(trimmed);
    }
    return rows;
}

/** Splits a cell or a step row into tokens, which are the words between spaces. */
export function splitTokens(text: string): string[] {
    const trimmed = text.trim();
    return trimmed === '' ? [] : trimmed.split(/\s+/);
}

/** The value of a token made of `prefix` then `digits` hex digits, such as `v9` or `a37`. Undefined if the token is not one. */
export function parseHexToken(token: string, prefix: string, digits: number): number | undefined {
    if (!token.startsWith(prefix) || token.length !== prefix.length + digits) return undefined;
    const hex = token.slice(prefix.length);
    if (!HEX.test(hex)) return undefined;
    return parseInt(hex, 16);
}

/** The waveform flags of a wave token (`pulse`, `triangle+saw`), or undefined if it is not one. */
export function parseWaveToken(token: string): number | undefined {
    return (WAVES as readonly string[]).includes(token) ? toWaveFlags(token as Wave) : undefined;
}

/** A relative pitch token's semitones (`+7`, `-12`, `+0`), or undefined if it is not one. */
export function parseRelativePitch(token: string): number | undefined {
    return RELATIVE.test(token) ? Number(token) : undefined;
}

/** Whether a song or an instrument may play a note number. The range is `LOWEST_NOTE` to `HIGHEST_NOTE`. */
export function isNoteInRange(note: number): boolean {
    return note >= LOWEST_NOTE && note <= HIGHEST_NOTE;
}

/** Every wave a step row or an instrument may name. */
export const WAVES: readonly Wave[] = [
    'triangle', 'saw', 'pulse', 'noise', 'wavetable', 'triangle+saw', 'triangle+pulse', 'saw+pulse', 'triangle+saw+pulse',
];

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A `#` at the start of a line or after whitespace, which starts a comment. */
const COMMENT = /(?:^|\s)#/;
const HEX = /^[0-9A-Fa-f]+$/;
const RELATIVE = /^[+-]\d{1,2}$/;

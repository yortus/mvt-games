/**
 * Colours for the terminal output. A run's output is coloured when Vitest
 * colours its own, by the same rules as the library that Vitest uses, so
 * that the two summaries look alike, and both are plain where one is.
 */

import { styleText } from 'node:util';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Functions that colour text, or leave it plain. */
export interface Paint {
    readonly bold: (text: string) => string;
    readonly dim: (text: string) => string;
    readonly green: (text: string) => string;
    readonly yellow: (text: string) => string;
    readonly red: (text: string) => string;
    /** A label in a block of colour, such as vsnap's name at the top of its summary. */
    readonly badge: (text: string) => string;
    /** A label in a block of red, such as `FAIL`. */
    readonly failBadge: (text: string) => string;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Returns colours for text, or, if `isOn` is false, functions that leave it plain. */
export function createPaint(isOn: boolean): Paint {
    const style = (format: Parameters<typeof styleText>[0]) => (text: string): string => isOn ? styleText(format, text, { validateStream: false }) : text;
    return {
        bold: style('bold'),
        dim: style('dim'),
        green: style('green'),
        yellow: style('yellow'),
        red: style('red'),
        badge: style(['inverse', 'bold', 'cyan']),
        failBadge: style(['inverse', 'bold', 'red']),
    };
}

/**
 * Returns whether output to a stream is coloured. These are the rules of
 * `tinyrainbow`, which Vitest colours its output with: never with
 * `NO_COLOR` or `--no-color`, and otherwise with `FORCE_COLOR` or
 * `--color`, in CI, on Windows, or in a terminal.
 */
export function isColourOn(stream: { readonly isTTY?: boolean }): boolean {
    const { env, argv } = process;
    if ('NO_COLOR' in env || argv.includes('--no-color')) return false;
    return 'FORCE_COLOR' in env || argv.includes('--color') || 'CI' in env || process.platform === 'win32' || (stream.isTTY === true && env.TERM !== 'dumb');
}

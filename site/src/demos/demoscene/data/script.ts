// ---------------------------------------------------------------------------
// Script
// ---------------------------------------------------------------------------

/** The parts of the show, in the order they play. */
export type PartKind = 'boot' | 'intro' | 'logo' | 'plasma' | 'vectors' | 'sprites' | 'credits';

/** One part of the show and how long it plays, in bars. */
export interface PartScript {
    readonly part: PartKind;
    readonly bars: number;
}

/** The show is cut to a tempo, so effects can hit beats before there is any music. */
export const BEATS_PER_MINUTE = 125;
export const BEATS_PER_BAR = 4;
export const MS_PER_BEAT = 60_000 / BEATS_PER_MINUTE;
export const MS_PER_BAR = MS_PER_BEAT * BEATS_PER_BAR;

/** The show: 84 bars, 161 seconds, then it loops. Every part starts on a bar line. */
export const SHOW_SCRIPT: readonly PartScript[] = [
    { part: 'boot', bars: 4 },
    { part: 'intro', bars: 8 },
    { part: 'logo', bars: 16 },
    { part: 'plasma', bars: 12 },
    { part: 'vectors', bars: 16 },
    { part: 'sprites', bars: 12 },
    { part: 'credits', bars: 16 },
];

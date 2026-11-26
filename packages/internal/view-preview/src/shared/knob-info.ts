// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What kind of control a knob gets, from how its literal is written. */
export type KnobKind = 'number' | 'color' | 'boolean' | 'string';

/** A value a knob holds. */
export type KnobValue = number | boolean | string;

/** One literal in a pose that the preview lets you change. */
export interface KnobInfo {
    /** Its place among its pose's knobs, from 0. */
    readonly index: number;
    readonly kind: KnobKind;
    /** What it sets, such as `score` for `score: () => 1230`, or `pose arg 3`. */
    readonly label: string;
    /** Where it is in the test file, from 1. */
    readonly line: number;
    readonly column: number;
    /** The value written in the test file. */
    readonly value: KnobValue;
}

/** A pose's knobs, and where the test that declares it is. */
export interface PoseInfo {
    /** Names the pose within its file, by its line and column. */
    readonly id: string;
    readonly line: number;
    readonly column: number;
    readonly knobs: readonly KnobInfo[];
}

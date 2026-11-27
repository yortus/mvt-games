import type { KnobKind, KnobValue } from './knob-info';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A tuning object that the preview found in a module. It's a top-level
 * `const` named `*_TUNING`, such as `SHIP_TUNING`, whose value is an object
 * literal. Each literal in it is a field you can change while the view runs.
 */
export interface TuningInfo {
    /** Names it across the page, as its file and its name: `<file>#SHIP_TUNING`. */
    readonly id: string;
    readonly name: string;
    /** The module it's declared in, with forward slashes. */
    readonly file: string;
    /** Where it's declared in its file, from 1. */
    readonly line: number;
    readonly column: number;
    /** The first paragraph of its doc comment, if it has one. */
    readonly doc: string | undefined;
    readonly fields: readonly TuningField[];
}

/** One value in a tuning object, which may be inside a table in it. */
export interface TuningField {
    /** The keys that lead to it from the tuning object: `['speedPerSecond']`, or `['pointsInFormation', 'scout']`. */
    readonly path: readonly string[];
    readonly kind: KnobKind;
    /** The value written in the file. */
    readonly value: KnobValue;
    /** Where its value is written, from 1. */
    readonly line: number;
    readonly column: number;
    /** The first paragraph of its doc comment, if it has one. */
    readonly doc: string | undefined;
}

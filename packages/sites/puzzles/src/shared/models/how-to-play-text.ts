import type { ControlRow } from '@mvtjs/site-kit/entry-types';

/**
 * How to play a puzzle game, written once: the card that says how to play
 * shows its rules and controls, and the info panel shows them too, with
 * the notes. An entry keeps it beside its details, in `start/`, as plain
 * data, so the details load nothing more with it.
 */
export interface HowToPlayText {
    /** The rules, a short paragraph each. The info panel shows them as its introduction. */
    readonly rules: readonly string[];
    /** The controls for playing a puzzle, one row for each thing the player does. */
    readonly controls: readonly ControlRow[];
    /** Anything else worth knowing, for the info panel only. */
    readonly notes: readonly string[];
}

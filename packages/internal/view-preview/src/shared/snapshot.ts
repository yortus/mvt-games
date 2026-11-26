import type { KnobValue } from './knob-info';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A request to add a test that poses a view as the preview shows it, with the knobs as you've set them. */
export interface SnapshotRequest {
    /** The test file's path. */
    readonly file: string;
    /** Where the previewed test's pose starts, from 1, as the preview loaded the file. */
    readonly poseLine: number;
    readonly poseColumn: number;
    /** Each knob's literal, as the preview loaded the file. The file must still have them, or the knobs' indexes could name other literals. */
    readonly literals: readonly KnobValue[];
    /** The knobs you've changed, by index, with their values. */
    readonly values: readonly (readonly [number, KnobValue])[];
    /** The new test's name. */
    readonly name: string;
}

/** What a snapshot does to the test file. It inserts a copy of the test, or it's refused, with the reason. */
export type SnapshotEdit =
    | {
        readonly kind: 'insert';
        /** Where the copy goes, in the file's code. That's the end of the line that the previewed test ends on. */
        readonly offset: number;
        readonly text: string;
        /** Where the copy starts once it's inserted, from 1. */
        readonly line: number;
        readonly column: number;
    }
    | { readonly kind: 'refused'; readonly reason: string };

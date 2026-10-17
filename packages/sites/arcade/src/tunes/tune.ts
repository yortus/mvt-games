import type { Audio90Song } from '@mvtjs/audio';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** One of the tunes: a short study of one of the decade's styles, which loops. */
export interface Tune {
    /** Its title, as the demos list it. */
    readonly name: string;
    /** The style it studies, such as `'House'`. */
    readonly style: string;
    /** The techniques it shows, for the panel beside the scopes. */
    readonly techniques: readonly string[];
    readonly song: Audio90Song;
}

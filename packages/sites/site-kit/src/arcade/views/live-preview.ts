import type { ArcadeEntry } from '../../entry-types';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Plays an entry live on its card (attract mode). This is an output of the
 * wall's, as a sound chip is an output of an audio view's: the view calls
 * `play` on a change, and the page does the rest.
 */
export interface LivePreview {
    /** The element the entry plays in, drawn at the entry's play size. */
    readonly element: HTMLElement;
    /** The entry playing, if any. */
    readonly entry: ArcadeEntry | undefined;
    /** Whether the entry playing has drawn enough to show. */
    readonly isShowing: boolean;
    /** Plays `entry`, in place of any entry playing. With undefined, stops playing. */
    readonly play: (entry: ArcadeEntry | undefined) => void;
}

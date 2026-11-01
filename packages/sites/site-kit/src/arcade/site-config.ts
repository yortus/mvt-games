import type { ArcadeEntry, EntryKind } from '../entry-types';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * One of the sites the page runs: the arcade, the demos or the puzzles.
 * Each is a package of its own, which lists its entries and starts the page
 * with this.
 */
export interface SiteConfig {
    /** The site's folder under the site's root, and the last part of its Vite base: `'demos'` for `<base>demos/`. */
    readonly id: SiteKind;
    /** Its name, as the page's title has it: `'MVT Demos'`. */
    readonly name: string;
    /** Its name for assistive technology and the About note: `'Demos'`. */
    readonly label: string;
    /** What its marquee spells, in the pixel font's characters: `'DEMOS'`. */
    readonly wordmark: string;
    /** The About note's first paragraph: what the site holds. */
    readonly about: string;
    /** Every entry it lists. */
    readonly catalogue: readonly ArcadeEntry[];
    /** What its entries are. Games are played, and get controls; demos are watched. */
    readonly entryKind: EntryKind;
}

/** The sites, each a package and a folder of the site's root. */
export type SiteKind = 'arcade' | 'demos' | 'puzzles';

/** Every site, in the order the nav lists them. */
export const SITE_KINDS: readonly SiteKind[] = ['arcade', 'demos', 'puzzles'];

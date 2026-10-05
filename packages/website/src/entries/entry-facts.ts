import type { RendererKind } from './arcade-entry';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Facts about an entry measured from its source when the site is built, not
 * written by hand (`virtual:entry-facts`, from `scripts/vite-plugin-entry-facts.ts`).
 */
export interface EntryFacts {
    /** Lines in the entry's own source files, tests left out. */
    readonly lines: number;
    /** Its own source files, tests left out. */
    readonly files: number;
    /** The renderers it draws with. */
    readonly renderers: readonly RendererKind[];
    /** Its directory, from the repo's root (`packages/website/src/games/crumb-chase`). */
    readonly sourcePath: string;
}

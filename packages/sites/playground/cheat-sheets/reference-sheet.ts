import type { LibrarySpecifier } from '../libraries';
import type { RendererKind } from '#project-api';
import type { CheatSheetLink } from './cheat-sheet';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A cheat sheet as the build makes it: each entry with its signature, its
 * summary and its import line, read from the library's declarations. The
 * playground's pane, the embed's drawer and the book's appendix all show
 * these.
 */
export interface ReferenceSheet {
    readonly id: string;
    readonly title: string;
    readonly summary: string;
    /** The renderers whose projects the sheet suits. Undefined suits every renderer. */
    readonly renderers?: readonly RendererKind[];
    readonly groups: readonly ReferenceGroup[];
    readonly moreAt: readonly CheatSheetLink[];
}

export interface ReferenceGroup {
    readonly title: string;
    readonly entries: readonly ReferenceEntry[];
}

export interface ReferenceEntry {
    /** As the sheet names it, such as `createReaction`, `Graphics.circle` or `visible`. */
    readonly name: string;
    /** The library that exports it, or undefined for syntax. */
    readonly from?: LibrarySpecifier;
    /** The line that imports it, such as `import { watch } from '@mvtjs/utils';`, or undefined for syntax. */
    readonly importLine?: string;
    /**
     * The line that imports it in each renderer's projects, for a name that
     * every renderer's package exports, such as `setRefresh`. A project
     * imports it from its own renderer's package.
     */
    readonly importLineFor?: Readonly<Partial<Record<RendererKind, string>>>;
    readonly signature: string;
    /** The first sentence of its doc comment, or '' if it has none. */
    readonly summary: string;
    /** When you'd reach for it. Code is in backticks. */
    readonly useFor: string;
    readonly snippet?: string;
    /** The page of the book that teaches it. */
    readonly chapter?: ReferenceChapter;
}

export interface ReferenceChapter {
    /** Its path in the docs, such as `chapters/09-noticing-changes`. */
    readonly path: string;
    /** Its name in the book, such as `Chapter 9, Noticing Changes`. */
    readonly title: string;
}

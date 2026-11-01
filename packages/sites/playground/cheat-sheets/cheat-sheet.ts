import type { LibrarySpecifier } from '../libraries';
import type { RendererKind } from '#project-api';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A cheat sheet, as it's written: the APIs for one task, such as noticing
 * changes, whichever libraries they come from. The build fills in each
 * entry's signature and summary from the library's declarations, so a sheet
 * holds only what a person has to choose and write.
 */
export interface CheatSheet {
    /** A short id, such as `the-tick`, unique among the sheets. */
    readonly id: string;
    readonly title: string;
    /** A sentence saying what the sheet is for. Code goes in backticks. */
    readonly summary: string;
    /** The renderers whose projects the sheet suits. Undefined suits every renderer. */
    readonly renderers?: readonly RendererKind[];
    readonly groups: readonly CheatSheetGroup[];
    /** Where to read more, such as a library's official docs. */
    readonly moreAt?: readonly CheatSheetLink[];
}

export interface CheatSheetGroup {
    readonly title: string;
    readonly entries: readonly CheatSheetEntry[];
}

/**
 * One API on a sheet. An entry with `from` is an export, or a member of one,
 * and the build looks it up. An entry without `from` is syntax, such as a
 * JSX attribute, which nothing imports, so it gives its own `signature`.
 */
export interface CheatSheetEntry {
    /** The export's name, or a member's after a dot, such as `Graphics.circle`. For syntax, as it's written, such as `visible`. */
    readonly name: string;
    /** The library that exports it. */
    readonly from?: LibrarySpecifier;
    /** When you'd reach for it, in a sentence. Code goes in backticks. */
    readonly useFor: string;
    /** A few lines of code that show it in use. */
    readonly snippet?: string;
    /** A signature written by hand, for syntax, or in place of a generated one that's hard to read. */
    readonly signature?: string;
    /** The page of the book that teaches it, by its path in the docs, such as `chapters/09-noticing-changes`. */
    readonly chapter?: string;
}

export interface CheatSheetLink {
    readonly label: string;
    readonly url: string;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A change to one file: the text from `start` to `end` replaced by `newText`.
 * Offsets count characters from the file's start.
 */
export interface FileEdit {
    readonly path: string;
    readonly start: number;
    readonly end: number;
    readonly newText: string;
}

/** A way to fix a problem, as the editor offers it. */
export interface CodeFix {
    readonly description: string;
    readonly edits: readonly FileEdit[];
}

/** A type error or warning the language service found in a project file. */
export interface TypeProblem {
    readonly path: string;
    /** Lines and columns count from 1. */
    readonly line: number;
    readonly column: number;
    /** Where the problem is, as offsets from the file's start. */
    readonly start: number;
    readonly length: number;
    readonly message: string;
    readonly severity: 'error' | 'warning';
    readonly fixes: readonly CodeFix[];
}

/** One completion the editor can offer. */
export interface CompletionEntry {
    readonly name: string;
    /** TypeScript's kind of element, such as `method`, `property` or `function`. */
    readonly kind: string;
    readonly sortText: string;
    /** For an auto-import, the module it comes from. */
    readonly source?: string;
    /** For an auto-import, what TypeScript needs to make its import. */
    readonly data?: unknown;
    readonly insertText?: string;
}

export interface CompletionList {
    readonly isMemberCompletion: boolean;
    readonly entries: readonly CompletionEntry[];
}

/** A completion's type, documentation, and the import it adds, if any. */
export interface CompletionDetails {
    readonly displayText: string;
    readonly documentation: string;
    readonly edits: readonly FileEdit[];
}

/** What hovering over a name shows: its type, and its documentation. */
export interface QuickInfo {
    readonly start: number;
    readonly length: number;
    readonly displayText: string;
    readonly documentation: string;
}

/** The signature of the call being typed, with the parameter the cursor is in. */
export interface SignatureHelp {
    /** The signature as text, such as `circle(x: number, y: number, radius: number): Graphics`. */
    readonly label: string;
    /** Where the active parameter is in the label, if there is one. */
    readonly activeStart?: number;
    readonly activeEnd?: number;
    readonly documentation: string;
}

/** Where a name is declared: in a project file, or in a library's declarations, which open read-only. */
export interface DefinitionTarget {
    readonly path: string;
    readonly line: number;
    readonly column: number;
    /** Whether the declaration is in a library rather than the project. */
    readonly isLibrary: boolean;
}

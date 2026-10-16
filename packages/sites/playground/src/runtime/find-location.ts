// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A place in a project file. Lines and columns count from 1. */
export interface SourceLocation {
    readonly path: string;
    readonly line: number;
    readonly column?: number;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Finds the first place in a project file that an error names: in its
 * message first (a loop guard's says where its loop is), then in its stack.
 * Frames in the libraries and the playground's own code are passed over.
 */
export function findProjectLocation(message: string, stack: string, paths: ReadonlySet<string>): SourceLocation | undefined {
    for (const text of [message, stack]) {
        for (const match of text.matchAll(PLACE)) {
            const path = match[1];
            if (!paths.has(path)) continue;
            return { path, line: Number(match[2]), column: match[3] === undefined ? undefined : Number(match[3]) };
        }
    }
    return undefined;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * A path, a line and maybe a column, after a space, a bracket or an `@`, as
 * stack traces write them: `at f (views/x.tsx:4:2)`, `f@views/x.tsx:4:2`.
 * The path may be named in the import map's way, `project:views/x.tsx`.
 */
const PLACE = /(?:^|[\s(@])(?:project:)?([\w.\-/]+\.(?:tsx?|css)):(\d+)(?::(\d+))?/g;

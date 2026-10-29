// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Splits a pattern or a step table into its rows, one per line, with each
 * line's indentation trimmed. A `#` starts a comment when it begins the line
 * or follows a space, and the comment runs to the end of the line. So
 * `| C-4 L  # bar 2` is a row with a comment after it, while `F#5` is a
 * note. Lines left blank once their comments are removed are skipped.
 */
export function splitRows(text: string): string[] {
    const rows: string[] = [];
    for (const line of text.split('\n')) {
        const comment = COMMENT.exec(line);
        const trimmed = (comment === null ? line : line.slice(0, comment.index)).trim();
        if (trimmed !== '') rows.push(trimmed);
    }
    return rows;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A `#` at the start of a line or after whitespace, which starts a comment. */
const COMMENT = /(?:^|\s)#/;

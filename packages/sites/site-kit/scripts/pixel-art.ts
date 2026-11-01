// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Splits a picture, written as one multiline string, into its rows of
 * pixels, one character per pixel. Each line's indentation is trimmed, and
 * blank lines are skipped, as the tracker notation's rows are. So a picture
 * can be indented with the code around it, and start and end on lines of
 * its own:
 *
 * ```ts
 * const BULLET = parsePixelArt(`
 *     .W.
 *     WWW
 *     .W.
 * `);
 * ```
 *
 * Unlike the tracker notation, a picture has no comments, since `#` is a
 * pixel in some of them. Put a comment above the picture instead.
 */
export function parsePixelArt(picture: string): string[] {
    const rows: string[] = [];
    for (const line of picture.split('\n')) {
        const row = line.trim();
        if (row !== '') rows.push(row);
    }
    return rows;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

// Each entry has an address of its own, inside the Arcade's: the Arcade's
// path with the entry's id added, as a folder. With the Arcade at
// `/arcade/`, Crumb Chase is at `/arcade/crumb-chase/`. A link to it can
// then preview as the entry, since each address is a page of its own.

/** The path of the entry with `id`, in the Arcade at `arcadePath` (which ends in `/`). */
export function formatEntryPath(arcadePath: string, id: string): string {
    return `${arcadePath}${encodeURIComponent(id)}/`;
}

/**
 * Reads what `path` names in the Arcade at `arcadePath` (which ends in `/`).
 * It returns `''` for the Arcade's own path, the wall, and an entry's id for
 * an entry's path. It returns undefined for a path outside the Arcade, or
 * deeper in it. A missing last `/`, or an `index.html` after it, is the same
 * path. The id is not checked against the entries.
 */
export function parseEntryPath(path: string, arcadePath: string): string | undefined {
    if (path === arcadePath.slice(0, -1)) return '';
    if (!path.startsWith(arcadePath)) return undefined;
    let rest = path.slice(arcadePath.length);
    if (rest === 'index.html') return '';
    if (rest.endsWith('/index.html')) rest = rest.slice(0, -'index.html'.length);
    if (rest.endsWith('/')) rest = rest.slice(0, -1);
    if (rest.includes('/')) return undefined;
    try {
        return decodeURIComponent(rest);
    }
    catch {
        // A `%` that starts no character names nothing
        return undefined;
    }
}

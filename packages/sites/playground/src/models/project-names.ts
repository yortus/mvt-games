// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * A name for a project that no other has: the name itself, if it is free,
 * or else its base with the first number from 2 that is free, as "New Pixi
 * project 2". The base is the name without a number it ends in, so "Clock 2"
 * goes on to "Clock 3", not "Clock 2 2". Names match whatever their case.
 */
export function toUniqueProjectName(name: string, taken: Iterable<string>): string {
    const takenNames = new Set<string>();
    for (const t of taken) takenNames.add(t.trim().toLowerCase());
    const trimmed = name.trim();
    if (!takenNames.has(trimmed.toLowerCase())) return trimmed;
    const base = trimmed.replace(/ \d+$/, '');
    for (let number = 2; ; number++) {
        const candidate = `${base} ${number}`;
        if (!takenNames.has(candidate.toLowerCase())) return candidate;
    }
}

/** Whether a name is one of the taken ones, whatever its case. */
export function isProjectNameTaken(name: string, taken: Iterable<string>): boolean {
    const wanted = name.trim().toLowerCase();
    for (const t of taken) if (t.trim().toLowerCase() === wanted) return true;
    return false;
}

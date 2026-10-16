import { type ArcadeEntry, type EntryFacts, ENTRY_KINDS, ERAS, GENRES, RENDERER_KINDS } from '../../entry-types';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The groups of tags entries are filtered by. */
export type TagGroup = 'kind' | 'era' | 'genre' | 'renderer';

/** One tag a visitor can filter by: a value in a group. */
export interface TagChip {
    readonly group: TagGroup;
    readonly value: string;
}

/** The tags active, group by group. An entry must have every one: each narrows the search. */
export type ActiveTags = Readonly<Record<TagGroup, ReadonlySet<string>>>;

/** Every group of tags, in the order the arcade lists them. */
export const TAG_GROUPS: readonly TagGroup[] = ['kind', 'era', 'genre', 'renderer'];

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** The values `entry` has in `group`: none, one or several. */
export function tagValuesOf(entry: ArcadeEntry, facts: EntryFacts | undefined, group: TagGroup): readonly string[] {
    switch (group) {
        case 'kind': return [entry.tags.kind];
        case 'era': return entry.tags.era === undefined ? NONE : [entry.tags.era];
        case 'genre': return entry.tags.genres;
        case 'renderer': return facts?.renderers ?? NONE;
    }
}

/** Every tag some entry has, group by group, each group in its display order. */
export function chipsFor(entries: readonly ArcadeEntry[], factsFor: (id: string) => EntryFacts | undefined): TagChip[] {
    const chips: TagChip[] = [];
    for (const group of TAG_GROUPS) {
        for (const value of GROUP_ORDERS[group]) {
            const isUsed = entries.some((entry) => tagValuesOf(entry, factsFor(entry.id), group).includes(value));
            if (isUsed) chips.push({ group, value });
        }
    }
    return chips;
}

/** An empty set of active tags, for the caller to fill. */
export function noActiveTags(): Record<TagGroup, Set<string>> {
    return { kind: new Set(), era: new Set(), genre: new Set(), renderer: new Set() };
}

/** Whether `entry` has every active tag. */
export function matchesTags(entry: ArcadeEntry, facts: EntryFacts | undefined, active: ActiveTags): boolean {
    for (const group of TAG_GROUPS) {
        const wanted = active[group];
        if (wanted.size === 0) continue;
        const values = tagValuesOf(entry, facts, group);
        for (const value of wanted) {
            if (!values.includes(value)) return false;
        }
    }
    return true;
}

/** The words of a search, in lower case: what `matchesWords` takes. */
export function searchWordsOf(text: string): string[] {
    return text.toLowerCase().split(/\s+/).filter((word) => word !== '');
}

/**
 * Whether `entry` matches every word of a search: each is somewhere in its
 * name, or begins a word of its summary, description, techniques or the
 * title it is inspired by (`'flock'` finds flocking), or begins one of its
 * tags (`'sim'` finds simulations).
 */
export function matchesWords(entry: ArcadeEntry, facts: EntryFacts | undefined, words: readonly string[]): boolean {
    if (words.length === 0) return true;
    const name = entry.name.toLowerCase();
    const prose = proseWordsOf(entry);
    for (const word of words) {
        if (name.includes(word)) continue;
        if (prose.some((proseWord) => proseWord.startsWith(word))) continue;
        const isTag = TAG_GROUPS.some((group) => tagValuesOf(entry, facts, group).some((value) => value.startsWith(word)));
        if (!isTag) return false;
    }
    return true;
}

/** Puts `indices`, into `entries`, in order of the entries' names. */
export function sortByName(indices: number[], entries: readonly ArcadeEntry[]): void {
    indices.sort((a, b) => entries[a].name.localeCompare(entries[b].name) || a - b);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const NONE: readonly string[] = [];

/** Each entry's summary, description, techniques and the title it is inspired by, as lower-case words: worked out once. */
const proseWords = new WeakMap<ArcadeEntry, readonly string[]>();

function proseWordsOf(entry: ArcadeEntry): readonly string[] {
    let words = proseWords.get(entry);
    if (words === undefined) {
        const text = [entry.summary, entry.description, ...(entry.techniques ?? []), entry.inspiredBy?.title ?? ''].join(' ').toLowerCase();
        words = text.split(/[^\p{L}\p{N}]+/u).filter((word) => word !== '');
        proseWords.set(entry, words);
    }
    return words;
}

const GROUP_ORDERS: Readonly<Record<TagGroup, readonly string[]>> = {
    kind: ENTRY_KINDS,
    era: ERAS,
    genre: GENRES,
    renderer: RENDERER_KINDS,
};

import { type ActiveTags, noActiveTags, TAG_GROUPS, type TagChip } from './entry-filters';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What the arcade keeps in its URL's query, so a search can be shared and reloaded. */
export interface ArcadeQuery {
    readonly active: ActiveTags;
    /** What was typed in the search, beside the tags. */
    readonly text: string;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Reads the tags and text from a query string (`?era=1980s,1990s&genre=maze&q=chase`).
 * Tags no chip offers are ignored.
 */
export function parseArcadeQuery(search: string, chips: readonly TagChip[]): ArcadeQuery {
    const params = new URLSearchParams(search);
    const active = noActiveTags();
    for (const group of TAG_GROUPS) {
        const values = params.get(group)?.split(',') ?? [];
        for (const value of values) {
            if (chips.some((c) => c.group === group && c.value === value)) active[group].add(value);
        }
    }
    return { active, text: params.get(TEXT_PARAM) ?? '' };
}

/**
 * `search` with the tags and text written into it, as a query string
 * (starting `?`, or empty). Other parameters are kept: an entry may keep
 * settings of its own there.
 */
export function formatArcadeQuery(search: string, query: ArcadeQuery, chips: readonly TagChip[]): string {
    const params = new URLSearchParams(search);
    for (const group of TAG_GROUPS) {
        // Written in the chips' order, so equal states give equal URLs
        const values = chips.filter((c) => c.group === group && query.active[group].has(c.value)).map((c) => c.value);
        if (values.length > 0) params.set(group, values.join(','));
        else params.delete(group);
    }
    // A link from before each site held one kind of entry may name one. The site says it now
    params.delete(OLD_KIND_PARAM);
    if (query.text === '') params.delete(TEXT_PARAM);
    else params.set(TEXT_PARAM, query.text);
    const text = params.toString().replaceAll('%2C', ',');
    return text === '' ? '' : `?${text}`;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TEXT_PARAM = 'q';

/** The parameter that named an entry's kind, game or demo, before each site held one kind. */
const OLD_KIND_PARAM = 'kind';

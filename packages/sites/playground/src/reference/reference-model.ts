import type { ReferenceEntry, ReferenceSheet } from '../../cheat-sheets';
import type { RendererKind } from '../project-api';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * One row of the cheat sheet as it shows: a sheet's introduction, a
 * group's title, an entry, or a note, such as "Nothing matches".
 */
export type ReferenceRow =
    | { readonly kind: 'sheet'; readonly sheet: ReferenceSheet }
    | { readonly kind: 'group'; readonly title: string }
    | { readonly kind: 'entry'; readonly entry: ReferenceEntry }
    | { readonly kind: 'note'; readonly text: string };

/** A name that a project imports from a library, such as `watch` from `@mvtjs/utils`. */
export interface ImportedName {
    readonly name: string;
    readonly from: string;
}

/** The id that `chosenId` takes for the list of what the project uses, in place of a sheet's. */
export const USED_ID = 'used';

/** The most entries a search lists. */
export const MAX_MATCHES = 40;

/**
 * The cheat sheets, as the playground's pane and the embed's drawer show
 * them: the sheets that suit the project's renderer, the one chosen, a
 * search across them, and the entry open. Given the names the project
 * imports, it lists the entries for them too, as "Used here".
 */
export interface ReferenceModel {
    /** Every sheet, once they've loaded, or undefined while they load. */
    sheets: readonly ReferenceSheet[] | undefined;
    /** The project's renderer, which picks the sheets shown, and the package that the view tick API is imported from. */
    renderer: RendererKind;
    /** Whether every sheet shows, whatever the renderer. */
    isShowingAll: boolean;
    /** The names the project imports. Some name on a sheet shown makes the list of what the project uses. */
    usedNames: readonly ImportedName[];
    /**
     * The sheet shown, by its id, or `USED_ID` for what the project uses.
     * An id that isn't shown reads as the first sheet's.
     */
    chosenId: string;
    /** The search typed, or '' for none. A search lists the entries that match, from every sheet shown. */
    query: string;
    /** The sheets shown: those that suit the renderer, or all of them. Empty while they load. */
    readonly shownSheets: readonly ReferenceSheet[];
    /** Whether there's a list of what the project uses. */
    readonly hasUsed: boolean;
    /** The rows to show, for the sheet chosen, or the search. A new array only when they change. */
    readonly rows: readonly ReferenceRow[];
    /** The entry open, which shows its snippet, its import and its links, or undefined. */
    readonly openEntry: ReferenceEntry | undefined;
    /** Opens an entry, or closes it if it's open. */
    readonly toggleEntry: (entry: ReferenceEntry) => void;
    /** The line that imports an entry in a project of this renderer, or undefined for syntax, which nothing imports. */
    readonly importLineOf: (entry: ReferenceEntry) => string | undefined;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ReferenceModelOptions {
    readonly renderer: RendererKind;
    readonly sheets?: readonly ReferenceSheet[];
    readonly usedNames?: readonly ImportedName[];
    readonly chosenId?: string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the cheat sheets' model, on the first sheet, or on `chosenId`. */
export function createReferenceModel(options: ReferenceModelOptions): ReferenceModel {
    let sheets = options.sheets;
    let renderer = options.renderer;
    let isShowingAll = false;
    let usedNames = options.usedNames ?? [];
    let chosenId = options.chosenId ?? '';
    let query = '';
    let openEntry: ReferenceEntry | undefined;
    let shownSheets: readonly ReferenceSheet[] = [];
    let usedEntries: readonly ReferenceEntry[] = [];
    let rows: readonly ReferenceRow[] = [];
    recompute();

    return {
        get sheets() { return sheets; },
        set sheets(value) {
            sheets = value;
            recompute();
        },
        get renderer() { return renderer; },
        set renderer(value) {
            if (value === renderer) return;
            renderer = value;
            recompute();
        },
        get isShowingAll() { return isShowingAll; },
        set isShowingAll(value) {
            if (value === isShowingAll) return;
            isShowingAll = value;
            recompute();
        },
        get usedNames() { return usedNames; },
        set usedNames(value) {
            usedNames = value;
            recompute();
        },
        get chosenId() { return toShownId(chosenId); },
        set chosenId(value) {
            if (value === chosenId) return;
            chosenId = value;
            recompute();
        },
        get query() { return query; },
        set query(value) {
            if (value === query) return;
            query = value;
            recompute();
        },
        get shownSheets() { return shownSheets; },
        get hasUsed() { return usedEntries.length > 0; },
        get rows() { return rows; },
        get openEntry() { return openEntry; },

        toggleEntry(entry) {
            openEntry = openEntry === entry ? undefined : entry;
        },

        importLineOf(entry) {
            return entry.importLineFor?.[renderer] ?? entry.importLine;
        },
    };

    /** Works out the sheets shown, the entries the project uses, and the rows, from the state as it is now. */
    function recompute(): void {
        shownSheets = sheets === undefined
            ? []
            : sheets.filter((sheet) => isShowingAll || sheet.renderers === undefined || sheet.renderers.includes(renderer));
        usedEntries = findUsedEntries(shownSheets, usedNames);
        rows = makeRows();
    }

    function makeRows(): readonly ReferenceRow[] {
        if (sheets === undefined) return [];
        const typed = query.trim().toLowerCase();
        if (typed !== '') return makeMatchRows(shownSheets, typed, query.trim());
        const shownId = toShownId(chosenId);
        if (shownId === USED_ID) return makeUsedRows(shownSheets, usedEntries);
        const sheet = shownSheets.find((s) => s.id === shownId);
        if (sheet === undefined) return [];
        const made: ReferenceRow[] = [{ kind: 'sheet', sheet }];
        for (const group of sheet.groups) {
            made.push({ kind: 'group', title: group.title });
            for (const entry of group.entries) made.push({ kind: 'entry', entry });
        }
        return made;
    }

    /** The id of the sheet shown: the one chosen, if it's shown, or else the first sheet shown. */
    function toShownId(id: string): string {
        if (id === USED_ID && usedEntries.length > 0) return USED_ID;
        if (shownSheets.some((sheet) => sheet.id === id)) return id;
        return shownSheets[0]?.id ?? '';
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * The entries for the names the project imports, from the sheets shown, in
 * the sheets' order. An entry for a member, such as `Graphics.circle`, counts
 * when its owner is imported. An entry of the view tick API counts when the
 * name comes from any renderer's package.
 */
function findUsedEntries(sheets: readonly ReferenceSheet[], names: readonly ImportedName[]): readonly ReferenceEntry[] {
    if (names.length === 0) return [];
    const found: ReferenceEntry[] = [];
    for (const sheet of sheets) {
        for (const group of sheet.groups) {
            for (const entry of group.entries) {
                if (entry.from === undefined) continue;
                const root = entry.name.split('.')[0];
                if (names.some((n) => n.name === root && isFromLibraryOf(entry, n.from))) found.push(entry);
            }
        }
    }
    return found;
}

function isFromLibraryOf(entry: ReferenceEntry, specifier: string): boolean {
    if (entry.from === specifier) return true;
    const lines = entry.importLineFor;
    return lines !== undefined && Object.keys(lines).some((renderer) => `@mvtjs/${renderer}` === specifier);
}

/** The entries the project uses, under the title of the sheet each is on. */
function makeUsedRows(sheets: readonly ReferenceSheet[], entries: readonly ReferenceEntry[]): readonly ReferenceRow[] {
    const made: ReferenceRow[] = [{ kind: 'note', text: 'The APIs this example imports, from the cheat sheets. Choose a sheet above for the rest.' }];
    for (const sheet of sheets) {
        let isTitled = false;
        for (const group of sheet.groups) {
            for (const entry of group.entries) {
                if (!entries.includes(entry)) continue;
                if (!isTitled) made.push({ kind: 'group', title: sheet.title });
                isTitled = true;
                made.push({ kind: 'entry', entry });
            }
        }
    }
    return made;
}

/**
 * The entries that match a search, under the title of the sheet each is on:
 * those whose names start with it first, then those whose names hold it,
 * then those whose descriptions do. An entry that two sheets share, such as
 * a JSX attribute, is listed once.
 */
function makeMatchRows(sheets: readonly ReferenceSheet[], typed: string, shown: string): readonly ReferenceRow[] {
    const ranked: { rank: number; sheet: ReferenceSheet; entry: ReferenceEntry }[] = [];
    const seen = new Set<string>();
    for (const sheet of sheets) {
        for (const group of sheet.groups) {
            for (const entry of group.entries) {
                const rank = rankMatch(entry, typed);
                const key = `${entry.name}\n${entry.signature}`;
                if (rank === undefined || seen.has(key)) continue;
                seen.add(key);
                ranked.push({ rank, sheet, entry });
            }
        }
    }
    if (ranked.length === 0) return [{ kind: 'note', text: `Nothing on the cheat sheets matches "${shown}".` }];
    // A stable sort, so entries of the same rank stay in the sheets' order
    ranked.sort((a, b) => a.rank - b.rank);
    const made: ReferenceRow[] = [];
    let lastSheet: ReferenceSheet | undefined;
    for (const { sheet, entry } of ranked.slice(0, MAX_MATCHES)) {
        if (sheet !== lastSheet) made.push({ kind: 'group', title: sheet.title });
        lastSheet = sheet;
        made.push({ kind: 'entry', entry });
    }
    return made;
}

function rankMatch(entry: ReferenceEntry, typed: string): number | undefined {
    const name = entry.name.toLowerCase();
    if (name.startsWith(typed) || name.includes(`.${typed}`)) return 0;
    if (name.includes(typed)) return 1;
    if (entry.useFor.toLowerCase().includes(typed) || entry.summary.toLowerCase().includes(typed)) return 2;
    return undefined;
}

import type { ArcadeEntry, EntryFacts, EntryStarter } from '../../entry-types';
import { type ArcadeQuery, parseArcadeQuery } from './arcade-query';
import {
    type ActiveTags, chipsFor, matchesTags, matchesWords, noActiveTags, searchWordsOf, sortByName, type TagChip, tagValuesOf,
} from './entry-filters';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The arcade: the entries it lists, the search that picks them (tags, and
 * words), and the entry running, if any. It holds no session: the page starts
 * and ends sessions as the phase changes.
 */
export interface ArcadeModel {
    /** Every entry the arcade lists, in a fixed order: other members address them by index into it. */
    readonly entries: readonly ArcadeEntry[];
    /** What was measured of an entry's source when the site was built. */
    readonly factsFor: (id: string) => EntryFacts | undefined;

    // --- Searching ----------------------------------------------------------

    /** Every tag some entry has, group by group, in a fixed order: other members address them by index into it. */
    readonly chips: readonly TagChip[];
    /**
     * How many entries the wall would show were this chip chosen: those with
     * its tag and every active one, whatever the words (choosing a chip
     * clears them).
     */
    readonly chipCountAt: (index: number) => number;
    /**
     * Whether choosing this chip would narrow the search: some of the
     * entries the active tags let through have its tag, and some do not.
     */
    readonly isChipOfferedAt: (index: number) => boolean;
    /** How many chips are active. */
    readonly activeChipCount: number;
    /** The active chip chosen `position`th, as its index in `chips`: in the order they were chosen. */
    readonly activeChipAt: (position: number) => number;
    /** Makes the chip's tag active, and clears the words typed to find it. */
    readonly chooseChipAt: (index: number) => void;
    /** Makes the chip's tag no longer active. */
    readonly removeChipAt: (index: number) => void;
    /**
     * What has been typed beside the tags. An entry shows only if each of its
     * words is in the entry's name, begins a word of its summary, description,
     * techniques or the title it is inspired by, or begins one of its tags.
     */
    searchText: string;
    /** Clears the tags and the words. */
    readonly clearSearch: () => void;
    /** The tags and words, for the page's URL. */
    readonly query: ArcadeQuery;
    /** Counts each change of tags or words, so the page knows when to write its URL. */
    readonly queryRevision: number;
    /** How many entries the wall shows: those the search picks, by name. */
    readonly shownCount: number;
    /** The entry shown `position`th, as its index in `entries`. */
    readonly shownIndexAt: (position: number) => number;

    // --- Running ------------------------------------------------------------

    /** Where the arcade is: browsing, or an entry loading, loaded or playing. */
    readonly phase: ArcadePhase;
    /** The entry chosen last: running, loading, or the one just left. */
    readonly activeEntry: ArcadeEntry | undefined;
    /** The active entry, loaded, from `'ready'` on. */
    readonly starter: EntryStarter | undefined;
    /** Why the last launch failed, until the visitor dismisses it or launches again. */
    readonly loadFailure: string | undefined;
    /** Whether the entry running is paused. Only a playing entry can be. */
    isPaused: boolean;
    /** Counts restarts, so the page knows when to start the entry afresh. */
    readonly restartCount: number;
    /** Loads the entry with `id`, from browsing; otherwise does nothing. */
    readonly launch: (id: string) => void;
    /** Starts the loaded entry: the page reports this once the way into it hands over. */
    readonly startPlaying: () => void;
    /** Starts the playing entry again, from the beginning. */
    readonly restart: () => void;
    /** Leaves the entry, whether it is loading or running, and goes back to the wall. */
    readonly exit: () => void;
    /** Forgets the last launch's failure. */
    readonly dismissLoadFailure: () => void;

    // --- The info panels ----------------------------------------------------
    // One at a time: an entry's, or the arcade's own, about the arcade.

    /** The entry whose info panel is open. */
    readonly infoEntry: ArcadeEntry | undefined;
    /** Opens the info panel of the entry with `id`, in place of any panel open; does nothing for an entry not listed. */
    readonly openInfo: (id: string) => void;
    /** Closes the entry's info panel, if one is open. */
    readonly closeInfo: () => void;
    /** Whether the arcade's own info panel is open. */
    readonly isAboutOpen: boolean;
    /** Opens the arcade's own info panel, in place of any panel open. */
    readonly openAbout: () => void;
    /** Closes the arcade's own info panel, if it is open. */
    readonly closeAbout: () => void;

    /** Nothing in the arcade moves with time: its entries' sessions are the page's. */
    readonly update: (deltaMs: number) => void;
}

/**
 * Where the arcade is: showing its wall, loading an entry the visitor chose,
 * holding it loaded until the way into it hands over, or running it.
 */
export type ArcadePhase = 'browsing' | 'loading' | 'ready' | 'playing';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ArcadeModelOptions {
    readonly entries: readonly ArcadeEntry[];
    readonly factsFor: (id: string) => EntryFacts | undefined;
    /** Loads an entry, and gets everything ready to start it. */
    readonly loadEntry: (entry: ArcadeEntry) => Promise<EntryStarter>;
    /** The page's query string, for the search to start with. */
    readonly search?: string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createArcadeModel(options: ArcadeModelOptions): ArcadeModel {
    const { entries, factsFor, loadEntry } = options;
    const chips = chipsFor(entries, factsFor);

    // The search: the chips chosen, in the order they were (a URL holds no
    // order: its tags count as chosen in the chips' order), and the words
    const initial = parseArcadeQuery(options.search ?? '', chips);
    const chosen: number[] = [];
    for (let c = 0; c < chips.length; c++) {
        if (initial.active[chips[c].group].has(chips[c].value)) chosen.push(c);
    }
    let searchText = initial.text;
    let queryRevision = 0;

    // Derived from the search, and kept until it changes
    let active: ActiveTags = noActiveTags();
    const isChosenAt: boolean[] = chips.map(() => false);
    const shown: number[] = [];
    const chipCounts: number[] = chips.map(() => 0);
    /** How many entries the active tags let through, whatever the words. */
    let taggedCount = 0;
    deriveFromSearch();

    let phase: ArcadePhase = 'browsing';
    let activeEntry: ArcadeEntry | undefined;
    let starter: EntryStarter | undefined;
    let loadFailure: string | undefined;
    let isPaused = false;
    let restartCount = 0;
    /** Counts launches, so a load that finishes after the visitor has left is ignored. */
    let launchCount = 0;
    /** The info panel open, if any: an entry's, or the arcade's own. */
    let panel: ArcadeEntry | 'about' | undefined;

    const model: ArcadeModel = {
        entries,
        factsFor,

        chips,
        chipCountAt: (index) => chipCounts[index],
        isChipOfferedAt: (index) => !isChosenAt[index] && chipCounts[index] > 0 && chipCounts[index] < taggedCount,
        get activeChipCount() {
            return chosen.length;
        },
        activeChipAt: (position) => chosen[position],
        chooseChipAt(index) {
            if (!isChosenAt[index]) chosen.push(index);
            searchText = '';
            changed();
        },
        removeChipAt(index) {
            const position = chosen.indexOf(index);
            if (position < 0) return;
            chosen.splice(position, 1);
            changed();
        },
        get searchText() {
            return searchText;
        },
        set searchText(value) {
            if (value === searchText) return;
            searchText = value;
            changed();
        },
        clearSearch() {
            chosen.length = 0;
            searchText = '';
            changed();
        },
        get query() {
            return { active, text: searchText };
        },
        get queryRevision() {
            return queryRevision;
        },
        get shownCount() {
            return shown.length;
        },
        shownIndexAt: (position) => shown[position],

        get phase() {
            return phase;
        },
        get activeEntry() {
            return activeEntry;
        },
        get starter() {
            return starter;
        },
        get loadFailure() {
            return loadFailure;
        },
        get isPaused() {
            return isPaused;
        },
        set isPaused(value) {
            isPaused = phase === 'playing' && value;
        },
        get restartCount() {
            return restartCount;
        },

        launch(id) {
            if (phase !== 'browsing') return;
            const entry = entries.find((e) => e.id === id);
            if (entry === undefined) return;
            activeEntry = entry;
            starter = undefined;
            loadFailure = undefined;
            panel = undefined;
            phase = 'loading';
            const launch = ++launchCount;
            loadEntry(entry).then(
                (loaded) => {
                    if (launch !== launchCount || phase !== 'loading') return;
                    starter = loaded;
                    phase = 'ready';
                },
                (error: unknown) => {
                    if (launch !== launchCount || phase !== 'loading') return;
                    loadFailure = `${entry.name} could not be loaded: ${error instanceof Error ? error.message : String(error)}`;
                    phase = 'browsing';
                },
            );
        },
        startPlaying() {
            if (phase !== 'ready') return;
            phase = 'playing';
            isPaused = false;
        },
        restart() {
            if (phase !== 'playing') return;
            isPaused = false;
            restartCount++;
        },
        exit() {
            if (phase === 'browsing') return;
            // A load still running is ignored when it finishes
            launchCount++;
            phase = 'browsing';
            starter = undefined;
            isPaused = false;
        },
        dismissLoadFailure() {
            loadFailure = undefined;
        },

        get infoEntry() {
            return panel === 'about' ? undefined : panel;
        },
        openInfo(id) {
            panel = entries.find((e) => e.id === id) ?? panel;
        },
        closeInfo() {
            if (panel !== 'about') panel = undefined;
        },
        get isAboutOpen() {
            return panel === 'about';
        },
        openAbout() {
            panel = 'about';
        },
        closeAbout() {
            if (panel === 'about') panel = undefined;
        },

        update(_deltaMs) {
            // Nothing to advance
        },
    };

    return model;

    function changed(): void {
        queryRevision++;
        deriveFromSearch();
    }

    /** The active tags, the entries shown, by name, and each chip's count, from the chips chosen and the words. */
    function deriveFromSearch(): void {
        const tags = noActiveTags();
        isChosenAt.fill(false);
        for (let i = 0; i < chosen.length; i++) {
            const chip = chips[chosen[i]];
            tags[chip.group].add(chip.value);
            isChosenAt[chosen[i]] = true;
        }
        active = tags;

        const words = searchWordsOf(searchText);
        const isTagged = entries.map((entry) => matchesTags(entry, factsFor(entry.id), active));
        taggedCount = 0;
        shown.length = 0;
        for (let i = 0; i < entries.length; i++) {
            if (!isTagged[i]) continue;
            taggedCount++;
            if (matchesWords(entries[i], factsFor(entries[i].id), words)) shown.push(i);
        }
        sortByName(shown, entries);
        for (let c = 0; c < chips.length; c++) {
            const { group, value } = chips[c];
            let count = 0;
            for (let i = 0; i < entries.length; i++) {
                if (isTagged[i] && tagValuesOf(entries[i], factsFor(entries[i].id), group).includes(value)) count++;
            }
            chipCounts[c] = count;
        }
    }
}

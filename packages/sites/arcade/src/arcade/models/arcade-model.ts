import type { HighscoreStore } from '../../highscores';
import type { ArcadeEntry, EntryDetails, EntryFacts, EntryStarter } from '../../entry-types';
import { LAUNCH_MS, REVEAL_MS } from '../data';
import { type ArcadeQuery, parseArcadeQuery } from './arcade-query';
import { createHighscoresModel, type HighscoresModel } from './highscores-model';
import {
    type ActiveTags, chipsFor, matchesTags, matchesWords, noActiveTags, searchWordsOf, sortByName, type TagChip, tagValuesOf,
} from './entry-filters';
import { clampVolume, type ArcadeSoundSettings, DEFAULT_SOUND_SETTINGS } from './sound-settings';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The Arcade's state. It holds the entries it lists, the search that picks
 * them by tags and words, and the entry running, if any. It holds no
 * session. The page starts and ends sessions as the phase changes.
 */
export interface ArcadeModel {
    /** Every entry the Arcade lists, in a fixed order. Other members address them by their index in it. */
    readonly entries: readonly ArcadeEntry[];
    /** What was measured of an entry's code when the site was built. */
    readonly factsFor: (id: string) => EntryFacts | undefined;

    // --- The entries' long text ---------------------------------------------
    // Each entry's description, instructions and techniques load after the
    // cards, so that the home page's first load holds only what the cards show.

    /** The long text of the entry with `id`, once it has loaded. */
    readonly detailsFor: (id: string) => EntryDetails | undefined;
    /**
     * Loads the long text of every entry whose text has not loaded. The page
     * calls it after its first paint. Opening an entry's info panel, or
     * launching it, loads that entry's text at once. The search reads each
     * entry's text as it arrives.
     */
    readonly loadDetails: () => void;

    // --- Searching ----------------------------------------------------------

    /** Every tag some entry has, group by group, in a fixed order. Other members address them by their index in it. */
    readonly chips: readonly TagChip[];
    /**
     * How many entries have this chip's tag and every active one, whatever
     * the words. It is how many the wall would show were the chip chosen in
     * place of the words.
     */
    readonly chipCountAt: (index: number) => number;
    /**
     * Whether choosing this chip would narrow the search. It would if some of
     * the entries the active tags let through have its tag, and some do not.
     */
    readonly isChipOfferedAt: (index: number) => boolean;
    /** How many chips are active. */
    readonly activeChipCount: number;
    /** The active chip chosen `position`th, as its index in `chips`. The chips are in the order they were chosen. */
    readonly activeChipAt: (position: number) => number;
    /** Makes the chip's tag active. The words stay as they are. */
    readonly chooseChipAt: (index: number) => void;
    /** Makes the chip's tag no longer active. */
    readonly removeChipAt: (index: number) => void;
    /**
     * What has been typed beside the tags. An entry shows only if each of its
     * words is in the entry's name, begins a word of its summary, description,
     * techniques or the title it is inspired by, or begins one of its tags.
     * An entry's description and techniques count once they have loaded.
     */
    searchText: string;
    /** Clears the tags and the words. */
    readonly clearSearch: () => void;
    /** The tags and words, for the page's URL. */
    readonly query: ArcadeQuery;
    /** Counts each change of tags or words, so the page knows when to write its URL. */
    readonly queryRevision: number;
    /**
     * How many entries the wall shows. These are the entries the search
     * picks: the visitor's favourites first, then the rest, each part in
     * order of name.
     */
    readonly shownCount: number;
    /** The entry shown `position`th, as its index in `entries`. */
    readonly shownIndexAt: (position: number) => number;

    // --- Favourites ---------------------------------------------------------
    // The entries the visitor has marked, which the page keeps between visits.

    /** The ids of the visitor's favourite entries, in the order marked. The model replaces the array whenever it changes, and only then. */
    readonly favouriteIds: readonly string[];
    /** Whether the entry with `id` is one of the visitor's favourites. */
    readonly isFavourite: (id: string) => boolean;
    /** Marks the entry with `id` as a favourite, or unmarks it if it is one. Does nothing for an entry not listed. */
    readonly toggleFavourite: (id: string) => void;

    // --- Running ------------------------------------------------------------

    /** Where the Arcade is. It is browsing, or an entry is launching, revealing or playing. */
    readonly phase: ArcadePhase;
    /** How long the phase has lasted, in milliseconds. The way into an entry is drawn from it. */
    readonly elapsedMs: number;
    /**
     * Whether the active entry has started: it is revealing or playing. The
     * page runs a session of it from the moment it starts until the visitor
     * leaves.
     */
    readonly isEntryStarted: boolean;
    /** The entry chosen last. It is running, loading, or the one just left. */
    readonly activeEntry: ArcadeEntry | undefined;
    /** The active entry, once it has loaded. */
    readonly starter: EntryStarter | undefined;
    /** Why the last launch failed, until the visitor dismisses it or launches again. */
    readonly loadFailure: string | undefined;
    /**
     * Whether the entry started is paused. Only an entry started can be, and
     * not while a score of its is placing, or while it offers to resume. One
     * paused as it is revealed stays paused once it is.
     */
    isPaused: boolean;
    /**
     * Whether the entry started stands still: revealing, paused, offering to
     * resume a saved game, or waiting while a score of its places, so that
     * nothing can restart the run behind the prompt. The page stops the entry
     * while it is.
     */
    readonly isEntryFrozen: boolean;
    /** Counts restarts, so the page knows when to start the entry afresh. */
    readonly restartCount: number;
    /**
     * Launches the entry with `id`: loads it, starts it once the way in has
     * had its time, and lets it run once it has been revealed. Does nothing
     * unless the phase is `'browsing'`.
     */
    readonly launch: (id: string, options?: LaunchOptions) => void;
    /** Starts the entry started again, from the beginning. */
    readonly restart: () => void;
    /** Leaves the entry, whether it is loading or running, and goes back to the wall. */
    readonly exit: () => void;
    /** Forgets the last launch's failure. */
    readonly dismissLoadFailure: () => void;

    // --- Saved games --------------------------------------------------------
    // The page saves a game as the visitor leaves it, and the next time they
    // start it, the Arcade offers to resume it.

    /**
     * Whether the entry started has a saved game, and the visitor is asked
     * whether to resume it or start afresh. The page loads the saved game as
     * the entry starts, so it shows behind the offer, and the entry stands
     * still until the visitor chooses.
     */
    readonly isResumeOffered: boolean;
    /** Closes the offer, and lets the saved game play on. Does nothing unless one is offered. */
    readonly resume: () => void;
    /** Closes the offer, and starts the entry afresh, as `restart` does. Does nothing unless one is offered. */
    readonly startAfresh: () => void;

    // --- Highscores ---------------------------------------------------------

    /** Every game's highscore table, and a score placing in one. */
    readonly highscores: HighscoresModel;
    /**
     * The playing entry's run has ended with `score`: the page reports it as
     * the session's `scoring` says so. For an entry with a highscore table, a
     * score that places waits for initials, and holds the entry.
     */
    readonly runEnded: (score: number) => void;
    // --- Sound --------------------------------------------------------------
    // The visitor's sound settings, which the page keeps between visits.

    /** The sound settings as one object. The model replaces the object whenever a setting changes, and only then. */
    readonly soundSettings: ArcadeSoundSettings;
    /**
     * The music's volume, from 0 (off) to 1. A value outside that range is
     * clamped, and NaN becomes 0. Setting it forgets the level that
     * `turnMusicOn` would restore.
     */
    musicVolume: number;
    /** The effects' volume, as for `musicVolume`. */
    effectsVolume: number;
    /** Turns the music off, and keeps its volume for `turnMusicOn` to restore. Does nothing if the music is off. */
    readonly turnMusicOff: () => void;
    /** Turns the music on at the volume it was turned off at, or at the default. Does nothing if the music is on. */
    readonly turnMusicOn: () => void;
    /** Turns the effects off, as `turnMusicOff` does the music. */
    readonly turnEffectsOff: () => void;
    /** Turns the effects on, as `turnMusicOn` does the music. */
    readonly turnEffectsOn: () => void;
    /**
     * Whether all sound is muted, the music and the effects. Muting and
     * unmuting leave the volumes as they are, so each sound comes back at the
     * level it had.
     */
    isSoundMuted: boolean;

    // --- The info panels ----------------------------------------------------
    // One panel is open at a time. It is an entry's, or the Arcade's own.

    /** The entry whose info panel is open. */
    readonly infoEntry: ArcadeEntry | undefined;
    /** Opens the info panel of the entry with `id`, in place of any panel open. Does nothing for an entry not listed. */
    readonly openInfo: (id: string) => void;
    /** Closes the entry's info panel, if one is open. */
    readonly closeInfo: () => void;
    /** Whether the Arcade's own info panel is open. */
    readonly isAboutOpen: boolean;
    /** Opens the Arcade's own info panel, in place of any panel open. */
    readonly openAbout: () => void;
    /** Closes the Arcade's own info panel, if it is open. */
    readonly closeAbout: () => void;

    // --- The Perfmon --------------------------------------------------------

    /**
     * Whether the Perfmon is open: a panel of how fast the page runs, over the
     * wall or the entry playing. It always starts closed.
     */
    isPerfmonOpen: boolean;

    /**
     * Times the way into an entry, and advances the highscores. Nothing else
     * in the Arcade moves with time, and its entries' sessions are the page's.
     */
    readonly update: (deltaMs: number) => void;
}

/**
 * Where the Arcade is:
 * - `'browsing'`: it shows its wall.
 * - `'launching'`: it loads the entry the visitor chose, while the way in
 *   leaves the wall. It lasts until the entry has loaded, and for at least
 *   `LAUNCH_MS` after a launch from the wall.
 * - `'revealing'`: the entry has started, and stands still while it shows,
 *   for `REVEAL_MS`.
 * - `'playing'`: the entry runs.
 */
export type ArcadePhase = 'browsing' | 'launching' | 'revealing' | 'playing';

/** How an entry is launched. */
export interface LaunchOptions {
    /**
     * Whether the visitor came straight to the entry, by its own address,
     * with no wall to leave. Then there is no way out of the wall to wait
     * for, and the entry starts as soon as it has loaded. Defaults to false.
     */
    readonly isDirect?: boolean;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What `createArcadeModel` needs to make the Arcade's model. */
export interface ArcadeModelOptions {
    /** Every entry the Arcade lists. */
    readonly entries: readonly ArcadeEntry[];
    /** What was measured of an entry's code when the site was built. */
    readonly factsFor: (id: string) => EntryFacts | undefined;
    /** Loads an entry, and gets everything ready to start it. */
    readonly loadEntry: (entry: ArcadeEntry) => Promise<EntryStarter>;
    /** The page's query string, for the search to start with. */
    readonly search?: string;
    /** Where the highscore tables are kept. */
    readonly highscoreStore: HighscoreStore;
    /** The initials the visitor entered on a visit before, if the page remembered them. */
    readonly rememberedInitials?: string;
    /** The sound settings the visitor last left. Defaults to `DEFAULT_SOUND_SETTINGS`. */
    readonly soundSettings?: ArcadeSoundSettings;
    /** The ids of the entries the visitor marked as favourites on a visit before. Ids of entries not listed are dropped. */
    readonly favouriteIds?: readonly string[];
    /** Whether the page has a saved game for the entry with `id`. Without it, no entry has one. */
    readonly hasSavedGame?: (id: string) => boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the Arcade's model. It starts on the wall, with the search that `options.search` holds. */
export function createArcadeModel(options: ArcadeModelOptions): ArcadeModel {
    const { entries, factsFor, loadEntry } = options;
    const chips = chipsFor(entries, factsFor);
    const indexById = new Map(entries.map((entry, i) => [entry.id, i]));

    // Each entry's long text, once loaded, and whether it has been asked for
    const details: (EntryDetails | undefined)[] = entries.map(() => undefined);
    const isDetailsAskedAt: boolean[] = entries.map(() => false);

    // The favourites: as ids, for the page to keep, and as a flag for each entry, for the wall's order
    const isFavouriteAt: boolean[] = entries.map((entry) => options.favouriteIds?.includes(entry.id) === true);
    let favouriteIds: readonly string[] = (options.favouriteIds ?? []).filter((id, i, ids) => ids.indexOf(id) === i && entries.some((e) => e.id === id));

    // The search is the chips chosen, in the order they were, and the words.
    // A URL holds no order, so its tags count as chosen in the chips' order.
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
    let elapsedMs = 0;
    /** The shortest time this launch lasts: none for a direct one, which has no wall to leave. */
    let launchMs = 0;
    let activeEntry: ArcadeEntry | undefined;
    let starter: EntryStarter | undefined;
    let loadFailure: string | undefined;
    let isPaused = false;
    let restartCount = 0;
    let isResumeOffered = false;
    let soundSettings = options.soundSettings ?? DEFAULT_SOUND_SETTINGS;
    /** Counts launches, so a load that finishes after the visitor has left is ignored. */
    let launchCount = 0;
    /** The info panel open, if any. It is an entry's, or the Arcade's own. */
    let panel: ArcadeEntry | 'about' | undefined;
    let isPerfmonOpen = false;
    const highscores = createHighscoresModel({ store: options.highscoreStore, rememberedInitials: options.rememberedInitials });

    const model: ArcadeModel = {
        entries,
        factsFor,

        detailsFor(id) {
            const index = indexById.get(id);
            return index === undefined ? undefined : details[index];
        },
        loadDetails() {
            for (let i = 0; i < entries.length; i++) askForDetailsAt(i);
        },

        chips,
        chipCountAt: (index) => chipCounts[index],
        isChipOfferedAt: (index) => !isChosenAt[index] && chipCounts[index] > 0 && chipCounts[index] < taggedCount,
        get activeChipCount() {
            return chosen.length;
        },
        activeChipAt: (position) => chosen[position],
        chooseChipAt(index) {
            if (!isChosenAt[index]) chosen.push(index);
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

        get favouriteIds() {
            return favouriteIds;
        },
        isFavourite: (id) => favouriteIds.includes(id),
        toggleFavourite(id) {
            const index = entries.findIndex((e) => e.id === id);
            if (index < 0) return;
            isFavouriteAt[index] = !isFavouriteAt[index];
            favouriteIds = isFavouriteAt[index] ? [...favouriteIds, id] : favouriteIds.filter((f) => f !== id);
            // The wall's order changes, and the search does not
            deriveFromSearch();
        },

        get phase() {
            return phase;
        },
        get elapsedMs() {
            return elapsedMs;
        },
        get isEntryStarted() {
            return isEntryStarted();
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
            isPaused = isEntryStarted() && highscores.placing === 'none' && !isResumeOffered && value;
        },
        get isEntryFrozen() {
            return phase === 'revealing' || isPaused || isResumeOffered || highscores.placing !== 'none';
        },
        get restartCount() {
            return restartCount;
        },
        get soundSettings() {
            return soundSettings;
        },
        get musicVolume() {
            return soundSettings.musicVolume;
        },
        set musicVolume(value) {
            changeSound({ musicVolume: clampVolume(value), musicVolumeBeforeOff: undefined });
        },
        get effectsVolume() {
            return soundSettings.effectsVolume;
        },
        set effectsVolume(value) {
            changeSound({ effectsVolume: clampVolume(value), effectsVolumeBeforeOff: undefined });
        },
        turnMusicOff() {
            if (soundSettings.musicVolume === 0) return;
            changeSound({ musicVolume: 0, musicVolumeBeforeOff: soundSettings.musicVolume });
        },
        turnMusicOn() {
            if (soundSettings.musicVolume > 0) return;
            changeSound({ musicVolume: soundSettings.musicVolumeBeforeOff ?? DEFAULT_SOUND_SETTINGS.musicVolume, musicVolumeBeforeOff: undefined });
        },
        turnEffectsOff() {
            if (soundSettings.effectsVolume === 0) return;
            changeSound({ effectsVolume: 0, effectsVolumeBeforeOff: soundSettings.effectsVolume });
        },
        turnEffectsOn() {
            if (soundSettings.effectsVolume > 0) return;
            changeSound({ effectsVolume: soundSettings.effectsVolumeBeforeOff ?? DEFAULT_SOUND_SETTINGS.effectsVolume, effectsVolumeBeforeOff: undefined });
        },
        get isSoundMuted() {
            return soundSettings.isMuted;
        },
        set isSoundMuted(value) {
            changeSound({ isMuted: value });
        },

        launch(id, launchOptions) {
            if (phase !== 'browsing') return;
            const entry = entries.find((e) => e.id === id);
            if (entry === undefined) return;
            askForDetailsAt(entries.indexOf(entry));
            activeEntry = entry;
            starter = undefined;
            loadFailure = undefined;
            panel = undefined;
            launchMs = launchOptions?.isDirect === true ? 0 : LAUNCH_MS;
            enter('launching');
            const launch = ++launchCount;
            loadEntry(entry).then(
                (loaded) => {
                    // The next update starts it, once the way in has had its time
                    if (launch !== launchCount || phase !== 'launching') return;
                    starter = loaded;
                },
                (error: unknown) => {
                    if (launch !== launchCount || phase !== 'launching') return;
                    loadFailure = `${entry.name} could not be loaded: ${error instanceof Error ? error.message : String(error)}`;
                    enter('browsing');
                },
            );
        },
        restart() {
            if (!isEntryStarted()) return;
            isPaused = false;
            isResumeOffered = false;
            highscores.close();
            restartCount++;
        },
        exit() {
            if (phase === 'browsing') return;
            // A load still running is ignored when it finishes
            launchCount++;
            enter('browsing');
            starter = undefined;
            isPaused = false;
            isResumeOffered = false;
            highscores.close();
        },
        dismissLoadFailure() {
            loadFailure = undefined;
        },

        get isResumeOffered() {
            return isResumeOffered;
        },
        resume() {
            isResumeOffered = false;
        },
        startAfresh() {
            if (!isResumeOffered) return;
            model.restart();
        },

        highscores,
        runEnded(score) {
            if (!isEntryStarted() || activeEntry?.hasHighscores !== true) return;
            highscores.runEnded(activeEntry.id, score);
            // The page sees a run end a frame after it does, and the visitor
            // may have paused since: a score that places takes over from the menu
            if (highscores.placing !== 'none') isPaused = false;
        },

        get infoEntry() {
            return panel === 'about' ? undefined : panel;
        },
        openInfo(id) {
            panel = entries.find((e) => e.id === id) ?? panel;
            const index = indexById.get(id);
            if (index !== undefined) askForDetailsAt(index);
            // The panel shows the entry's table: as it stands now
            if (panel !== 'about' && panel?.id === id && panel.hasHighscores === true) highscores.reload();
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
        get isPerfmonOpen() {
            return isPerfmonOpen;
        },
        set isPerfmonOpen(value) {
            isPerfmonOpen = value;
        },

        update(deltaMs) {
            highscores.update(deltaMs);
            elapsedMs += deltaMs;
            if (phase === 'launching' && starter !== undefined && elapsedMs >= launchMs) startEntry();
            else if (phase === 'revealing' && elapsedMs >= REVEAL_MS) enter('playing');
        },
    };

    return model;

    function enter(next: ArcadePhase): void {
        phase = next;
        elapsedMs = 0;
    }

    function isEntryStarted(): boolean {
        return phase === 'revealing' || phase === 'playing';
    }

    /** Starts the loaded entry, which stands still while it is revealed. */
    function startEntry(): void {
        enter('revealing');
        isPaused = false;
        // Fresh tables, for where a run will place, and for the game's "HI"
        if (activeEntry?.hasHighscores === true) highscores.reload();
        isResumeOffered = activeEntry !== undefined && options.hasSavedGame?.(activeEntry.id) === true;
    }

    /**
     * Loads the long text of the entry at `index`, unless it has been asked
     * for already. Once it arrives, the search reads it. A load that fails can
     * be asked for again.
     */
    function askForDetailsAt(index: number): void {
        if (isDetailsAskedAt[index]) return;
        isDetailsAskedAt[index] = true;
        entries[index].loadDetails().then(
            (loaded) => {
                details[index] = loaded;
                deriveFromSearch();
            },
            () => {
                isDetailsAskedAt[index] = false;
            },
        );
    }

    /** Replaces the sound settings with a copy changed as `change` says, if it changes anything. */
    function changeSound(change: Partial<ArcadeSoundSettings>): void {
        let isChanged = false;
        for (const key in change) {
            const k = key as keyof ArcadeSoundSettings;
            if (change[k] !== soundSettings[k]) isChanged = true;
        }
        if (isChanged) soundSettings = { ...soundSettings, ...change };
    }

    function changed(): void {
        queryRevision++;
        deriveFromSearch();
    }

    /**
     * Works out the active tags, the entries shown (favourites first, each
     * part in order of name), and each chip's count, from the chips chosen
     * and the words.
     */
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
            if (matchesWords(entries[i], factsFor(entries[i].id), details[i], words)) shown.push(i);
        }
        sortByName(shown, entries);
        putFavouritesFirst();
        for (let c = 0; c < chips.length; c++) {
            const { group, value } = chips[c];
            let count = 0;
            for (let i = 0; i < entries.length; i++) {
                if (isTagged[i] && tagValuesOf(entries[i], factsFor(entries[i].id), group).includes(value)) count++;
            }
            chipCounts[c] = count;
        }
    }

    /** Moves the favourites among the entries shown to the front, keeping the order within each part. */
    function putFavouritesFirst(): void {
        const favourites = shown.filter((i) => isFavouriteAt[i]);
        if (favourites.length === 0) return;
        const others = shown.filter((i) => !isFavouriteAt[i]);
        shown.length = 0;
        shown.push(...favourites, ...others);
    }
}

import type { ArcadeEntry, EntryFacts, EntryStarter } from '../../entry-types';
import { type ArcadeQuery, parseArcadeQuery } from './arcade-query';
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

    // --- Searching ----------------------------------------------------------

    /** Every tag some entry has, group by group, in a fixed order. Other members address them by their index in it. */
    readonly chips: readonly TagChip[];
    /**
     * How many entries the wall would show if this chip were chosen. These
     * are the entries with its tag and every active one, whatever the words,
     * because choosing a chip clears the words.
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
    /** How many entries the wall shows. These are the entries the search picks, in order of name. */
    readonly shownCount: number;
    /** The entry shown `position`th, as its index in `entries`. */
    readonly shownIndexAt: (position: number) => number;

    // --- Running ------------------------------------------------------------

    /** Where the Arcade is. It is browsing, or an entry is loading, loaded or playing. */
    readonly phase: ArcadePhase;
    /** The entry chosen last. It is running, loading, or the one just left. */
    readonly activeEntry: ArcadeEntry | undefined;
    /** The active entry, loaded, from `'ready'` on. */
    readonly starter: EntryStarter | undefined;
    /** Why the last launch failed, until the visitor dismisses it or launches again. */
    readonly loadFailure: string | undefined;
    /** Whether the entry running is paused. Only a playing entry can be. */
    isPaused: boolean;
    /** Counts restarts, so the page knows when to start the entry afresh. */
    readonly restartCount: number;
    /** Loads the entry with `id`. Does nothing unless the phase is `'browsing'`. */
    readonly launch: (id: string) => void;
    /** Starts the loaded entry, held still until `letGo`. Does nothing unless the phase is `'ready'`. */
    readonly startPlaying: () => void;
    /**
     * Whether the started entry is held still. It shows its first frame but
     * does not run, from `startPlaying` until `letGo` or `exit`. A held entry
     * stays still whether or not it is paused.
     */
    readonly isHeld: boolean;
    /** Lets the held entry run. Does nothing if no entry is held. */
    readonly letGo: () => void;
    /** Starts the playing entry again, from the beginning. */
    readonly restart: () => void;
    /** Leaves the entry, whether it is loading or running, and goes back to the wall. */
    readonly exit: () => void;
    /** Forgets the last launch's failure. */
    readonly dismissLoadFailure: () => void;

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

    /** Does nothing. Nothing in the Arcade moves with time, and its entries' sessions are the page's. */
    readonly update: (deltaMs: number) => void;
}

/**
 * Where the Arcade is. It shows its wall (`'browsing'`), loads an entry the
 * visitor chose (`'loading'`), holds it loaded until the way into it hands
 * over (`'ready'`), or runs it (`'playing'`).
 */
export type ArcadePhase = 'browsing' | 'loading' | 'ready' | 'playing';

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
    /** The sound settings the visitor last left. Defaults to `DEFAULT_SOUND_SETTINGS`. */
    readonly soundSettings?: ArcadeSoundSettings;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the Arcade's model. It starts on the wall, with the search that `options.search` holds. */
export function createArcadeModel(options: ArcadeModelOptions): ArcadeModel {
    const { entries, factsFor, loadEntry } = options;
    const chips = chipsFor(entries, factsFor);

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
    let activeEntry: ArcadeEntry | undefined;
    let starter: EntryStarter | undefined;
    let loadFailure: string | undefined;
    let isPaused = false;
    let isHeld = false;
    let restartCount = 0;
    let soundSettings = options.soundSettings ?? DEFAULT_SOUND_SETTINGS;
    /** Counts launches, so a load that finishes after the visitor has left is ignored. */
    let launchCount = 0;
    /** The info panel open, if any. It is an entry's, or the Arcade's own. */
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
            isHeld = true;
        },
        get isHeld() {
            return isHeld;
        },
        letGo() {
            if (phase !== 'playing') return;
            isHeld = false;
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
            isHeld = false;
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

    /** Works out the active tags, the entries shown in order of name, and each chip's count, from the chips chosen and the words. */
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

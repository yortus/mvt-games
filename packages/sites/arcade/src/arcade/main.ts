import { ENTRY_FACTS } from 'virtual:entry-facts';
import { createFetchHighscoreStore, createMemoryHighscoreStore, GAMES, type HighscoreStore } from '../highscores';
import { refreshView, updateView } from '@mvtjs/html';
import { assert, type MetricKind, type PerformanceMeter, watch } from '@mvtjs/utils';
import { CATALOGUE, findEntry } from '../entries';
import type { ArcadeEntry, EntryStarter } from '../entry-types';
import { isHandheldDevice } from '../device';
import { createEntryHost, createPageSound, isTouchDevice } from '../runner';
import { createLocalStore } from '../storage';
import {
    type ArcadeSoundSettings,
    createArcadeModel,
    DEFAULT_SOUND_SETTINGS,
    formatArcadeQuery,
    formatEntryPath,
    formatSoundSettings,
    HANDHELD_SOUND_SETTINGS,
    parseEntryPath,
    parseSoundSettings,
} from './models';
import { type ArcadeAudioViews, ArcadeView, loadArcadeAudioViews, loadPerfmon, type Perfmon } from './views';
import './arcade.css';

// The Arcade's page. One loop runs everything, in the MVT order. It updates
// the Arcade's model first. Then the entry host ticks the entry running, if
// any, with its models, its views and its renderers. Last come the Arcade's
// views, which are in the page and in the site's nav. The sound chips keep
// the sound card's time, so the loop doesn't tick them.
//
// The page starts and ends the entry's sessions as the model starts and
// leaves the entry. It keeps the URL in step with the model. The search is in the
// query, and the entry is in the path: each entry's address is the Arcade's,
// with the entry's id added (`arcade/crumb-chase/`). The build makes a copy
// of this page at each one, with the entry's own title and link preview. An
// info panel that is open, an entry's or the Arcade's, has a history step of
// its own. The page also
// plays an entry live on its card (attract mode) when the wall asks, in a
// second host that takes no input.
//
// The page also connects the games to their highscore tables. It watches the
// running session's `scoring` for the end of a run, and remembers the
// visitor's initials between visits.
//
// It keeps the visitor's favourites between visits too. It saves a game every
// few seconds of play, and as the visitor leaves it, for the model to offer
// to resume next time.
//
// While the Perfmon is open, the loop measures each of its frames, whatever
// the entry's renderer, with the GPU's time for an entry drawn with Pixi.

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

const root = pageElement('arcade');
/** The site's root, where the docs and the playground are too. */
const SITE_PATH = import.meta.env.BASE_URL;
/** The Arcade's own path, in the site. `vite.config.ts` builds the page into this folder. */
const ARCADE_PATH = `${SITE_PATH}arcade/`;

const isTouch = isTouchDevice();
const stage = document.createElement('div');
stage.className = 'runner-stage';
// The page's sound has the entries' chips, and two of its own: one plays the
// menus' sounds, and the other the music slider's preview. The host pauses an
// entry's chips as it pauses the game.
const sound = createPageSound({ isEnabled: true });
const host = createEntryHost({ element: stage, isTouch, sound });
// The Arcade has sounds of its own. Browsers play no sound before the
// visitor's first press. So the chips, the Arcade's sounds and the views that
// play them all load on that press, and none of them is in the page's first
// load.
/** The views that play the Arcade's own sounds, once they have loaded. */
let audioViews: ArcadeAudioViews | undefined;
/** Whether the page has started to load its sound. */
let hasSoundStartedLoading = false;
// A touch counts as a press only as it ends, so the page listens for `touchend` too.
window.addEventListener('pointerdown', onPress, { capture: true });
window.addEventListener('touchend', onPress, { capture: true });
window.addEventListener('keydown', onPress, { capture: true });

// Attract mode plays one entry at a time live on its card, where there is a
// pointer to rest on a card. It plays in a host of its own, so it adds one
// WebGL renderer at most. It is presentation, so the model never knows.
const liveElement = isTouch ? undefined : document.createElement('div');
const liveHost = liveElement === undefined ? undefined : createEntryHost({ element: liveElement, isTouch: false, takesInput: false });
if (liveElement !== undefined) liveElement.className = 'card-live-stage';
/** The entry playing live, once it has started, and how many frames it has drawn on its card. */
let liveEntry: ArcadeEntry | undefined;
let liveFrames = 0;
/** Counts the entries asked to play live, so a load overtaken by another is dropped. */
let liveRequests = 0;
/** The host's preparations, one after another. Two at once could each make a renderer. */
let livePreparing: Promise<void> = Promise.resolve();

// Declared before the model is made, which reads them.
/** What the page keeps in the browser between visits: the visitor's settings, initials, favourites and saved games. */
const store = createLocalStore();
/** Where the visitor's sound settings are kept between visits. It is older than the other keys, so it is named differently. */
const SOUND_SETTINGS_KEY = 'mvt-arcade-sound';
/** The sound settings the visitor saved on an earlier visit, as text. It is undefined if they never changed the sound. */
const savedSoundSettings = store.read(SOUND_SETTINGS_KEY);
// A first visit takes the defaults. On a phone or a tablet, the sound starts
// muted. Desktops start with sound, as a games site is expected to.
const firstSoundSettings = savedSoundSettings !== undefined
    ? parseSoundSettings(savedSoundSettings)
    : isHandheldDevice() ? HANDHELD_SOUND_SETTINGS : DEFAULT_SOUND_SETTINGS;
// Declared before the model, which is made with the initials and favourites it keeps
/** Where the visitor's initials are kept between visits. */
const INITIALS_KEY = 'mvt-arcade:initials';
/** Where the ids of the visitor's favourite entries are kept between visits, as a JSON array. */
const FAVOURITES_KEY = 'mvt-arcade:favourites';
/** Where a game left part way through is kept, for the visitor to resume next time: this, then the entry's id. */
const SAVED_GAME_KEY = 'mvt-arcade:saved-game:';

const model = createArcadeModel({
    entries: CATALOGUE,
    factsFor: (id) => ENTRY_FACTS[id],
    search: location.search,
    highscoreStore: highscoreStoreFor(import.meta.env.VITE_HIGHSCORES_URL),
    // The model checks them. Storage can be blocked, as in a private window, which just means none
    rememberedInitials: store.read(INITIALS_KEY),
    soundSettings: firstSoundSettings,
    favouriteIds: readFavourites(),
    hasSavedGame: (id) => store.read(SAVED_GAME_KEY + id) !== undefined,
    loadEntry: async (entry) => {
        const starter = await entry.load();
        if (DEV) checkPlayArea(entry, starter);
        await host.prepare(starter);
        return starter;
    },
});

/** The last frame of the entry just left, for the way back to its card. */
let exitFrame: HTMLCanvasElement | undefined;
/** How long the entry running has played since its game was last saved, in milliseconds. */
let playedSinceSaveMs = 0;

// The visitor's system setting for less motion, followed as it changes
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
// On a phone or a tablet held upright, a game wider than tall plays turned on
// its side, to be played with the device turned. One with its orientation
// unlocked turns the page too, and the game shows upright again
const canTurn = isHandheldDevice();
const portrait = window.matchMedia('(orientation: portrait)');

root.append(ArcadeView({
    model,
    stage,
    exitFrame: () => exitFrame,
    isMotionReduced: () => reducedMotion.matches,
    liveElement,
    navTools: pageElement('site-nav-tools'),
    homeLinks: [...document.querySelectorAll<HTMLElement>('.site-nav-brand, .site-nav-links a.active')],
    liveEntry: () => liveEntry,
    isLiveShowing: () => liveFrames >= LIVE_SHOWN_AFTER_FRAMES,
    pageSfx: sound.pageSfx,
    pageMusic: sound.pageMusic,
    audioViews: () => audioViews,
    // The model replaces its settings object whenever one changes, so the first object still there means no change
    isSoundOffByDefault: () => savedSoundSettings === undefined && model.soundSettings === firstSoundSettings && model.isSoundMuted,
    isTurned: isRunnerTurned,
    entryHref: (entry) => formatEntryPath(ARCADE_PATH, entry.id),
    docsHref: `${SITE_PATH}docs/`,
    performance: () => meter,
    perfmon: () => perfmon,
    unmeasuredMetrics,
    onLiveWanted: playLive,
    playRectFor: (entry, starter) => host.playRectFor({
        screenWidth: entry.screenWidth,
        screenHeight: entry.screenHeight,
        starter,
        hasControls: entry.tags.kind === 'game',
    }),
}));

// Declared before the page follows the URL below, which reads them
/** The page's title on the wall, as its `<title>` has it. Each entry's copy of the page puts the entry's name before it. */
const ARCADE_TITLE = 'MVT Arcade';
/** Marks the history step an entry's URL was pushed on, so leaving it knows to step back. */
const ENTRY_STEP = 'arcade-entry';
/** Begins the mark of the history step an entry's info panel was opened on, which ends with the entry's id. */
const INFO_STEP = 'arcade-info:';
/** Marks the history step the Arcade's own info panel was opened on. */
const ABOUT_STEP = 'arcade-about';
/** How many times the page has stepped back in history itself, whose arrival it has not yet seen. */
let ownStepsBack = 0;

// An info panel's step, reloaded, opens its panel again. The watcher is made after it, so its baseline has the panel open
followPanelStep();
const watcher = watch({
    phase: () => model.phase,
    isEntryStarted: () => model.isEntryStarted,
    restarts: () => model.restartCount,
    query: () => model.queryRevision,
    panel: panelStep,
    isRunOver: () => host.session?.scoring?.isOver() === true,
    initials: () => model.highscores.lastInitials,
    isPerfmonOpen: () => model.isPerfmonOpen,
});

/** The sound settings last given to the host and saved. */
let keptSoundSettings = model.soundSettings;
applySoundSettings(keptSoundSettings);
/** The favourites last saved. The model replaces its array whenever they change. */
let keptFavouriteIds = model.favouriteIds;

// A game is saved every few seconds of play (in the loop), as the visitor
// leaves it, and as the page is hidden or closed, which a phone may do
// without warning. A browser that crashes or is killed gets no warning at
// all, which is why the loop saves too.
window.addEventListener('pagehide', saveGame);
// The chips hold their sound themselves while the page is hidden
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveGame();
});

// A link to an entry (`arcade/crumb-chase/`) launches it; going back or forward in history follows,
// so Back from an entry returns to the wall, and Back from an info panel closes it
followUrl();
window.addEventListener('popstate', onHistoryStep);

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

let lastTimeMs: number | undefined;
/** Measures each frame, while the Perfmon is open. */
let meter: PerformanceMeter | undefined;
/** The Perfmon's panel and its meter, once they have loaded, the first time the Perfmon opens. */
let perfmon: Perfmon | undefined;
requestAnimationFrame(frame);
// The entries' long text loads once the wall is first drawn, not before it,
// so the home page's first load holds only what the cards show. A search
// that only an entry's description matches finds it when the text arrives
requestAnimationFrame(() => setTimeout(model.loadDetails, 0));

function frame(timeMs: number): void {
    meter?.startFrame();
    // A long gap (a hidden tab) is clamped rather than simulated
    const deltaMs = lastTimeMs === undefined ? 0 : Math.min(timeMs - lastTimeMs, MAX_STEP_MS);
    lastTimeMs = timeMs;

    model.update(deltaMs);
    followModel();
    host.tick(timeMs, deltaMs);
    // Only play time counts. A frozen entry, paused or offering to resume, has nothing new to save
    if (model.phase === 'playing' && !model.isEntryFrozen) {
        playedSinceSaveMs += deltaMs;
        if (playedSinceSaveMs >= SAVE_EVERY_MS) saveGame();
    }
    if (liveHost !== undefined) {
        liveHost.tick(timeMs, deltaMs);
        if (liveEntry !== undefined && liveElement?.isConnected === true) liveFrames++;
    }
    // The page's whole body is ticked, the Arcade and its tools in the site's nav
    updateView(document.body, deltaMs);
    refreshView(document.body);
    meter?.endFrame();

    requestAnimationFrame(frame);
}

/** Starts and ends the entry's sessions as the model starts and leaves the entry, and writes the URL. */
function followModel(): void {
    const { phase, isEntryStarted, restarts, query, panel, isRunOver, initials, isPerfmonOpen } = watcher.poll();
    if (isEntryStarted.changed) {
        // The session starts as the entry is revealed, and draws its first
        // frame, standing still, before the Arcade's views next draw
        if (isEntryStarted.current) {
            exitFrame = undefined;
            const { starter, activeEntry } = model;
            assert(starter !== undefined && activeEntry !== undefined, 'arcade: an entry starts only once it has loaded');
            host.start(starter, { bestScore: () => model.highscores.bestScoreFor(activeEntry.id) });
            playedSinceSaveMs = 0;
            if (model.isResumeOffered) loadSavedGame(activeEntry);
        }
        else if (isEntryStarted.previous === true) {
            saveGame();
            exitFrame = host.stop();
        }
    }
    if (restarts.changed) {
        host.restart();
        // The game saved is behind the visitor now. The new one is saved as they leave it
        if (model.activeEntry !== undefined) store.remove(SAVED_GAME_KEY + model.activeEntry.id);
    }
    // A run has ended, and its score may place
    if (isRunOver.changed && isRunOver.current) model.runEnded(host.session?.scoring?.score() ?? 0);
    // The host stays paused while the entry is frozen: standing still as it is revealed, paused by the visitor, or waiting while a score places.
    host.isPaused = model.isEntryFrozen;
    host.isTurned = isRunnerTurned();
    // Blocked storage means the initials are offered for the rest of this visit only
    if (initials.changed && initials.current !== undefined) store.write(INITIALS_KEY, initials.current);
    if (model.favouriteIds !== keptFavouriteIds) {
        keptFavouriteIds = model.favouriteIds;
        store.writeJson(FAVOURITES_KEY, keptFavouriteIds);
    }
    // The model replaces its sound settings object whenever one changes. The page gives the new settings to the host and saves them.
    if (model.soundSettings !== keptSoundSettings) {
        keptSoundSettings = model.soundSettings;
        applySoundSettings(keptSoundSettings);
        // Blocked or full storage means the settings hold for this visit only
        store.write(SOUND_SETTINGS_KEY, formatSoundSettings(keptSoundSettings));
    }
    if (isPerfmonOpen.changed) measurePerformance(isPerfmonOpen.current);
    if (phase.changed && phase.previous === 'browsing') writeUrl('enter');
    else if (phase.changed && phase.current === 'browsing') writeUrl('leave');
    else if (panel.changed) writePanelStep();
    else if (phase.changed || query.changed) writeUrl('replace');
}

/**
 * Loads the page's sound on the visitor's first press. It loads the chips
 * and the views that play the Arcade's own sounds. An entry that is launched
 * waits for the chips, because the host prepares them along with the entry.
 *
 * It runs in the press's handler, because the host makes its audio context
 * as it prepares the chips, and browsers let a context start only in a
 * press. A touch starts sound only as it ends, so a touch's `pointerdown` is
 * left to its `touchend`. That way the same tap makes the audio context and
 * starts it. Later presses do nothing, unless the views failed to load, in
 * which case the next press tries again.
 */
function onPress(e: Event): void {
    if (hasSoundStartedLoading || (e.type === 'pointerdown' && (e as PointerEvent).pointerType === 'touch')) return;
    hasSoundStartedLoading = true;
    void sound.prepare();
    loadArcadeAudioViews().then((views) => {
        audioViews = views;
    }).catch((error: unknown) => {
        console.warn('The Arcade\'s own sounds could not load.', error);
        hasSoundStartedLoading = false;
    });
}

/**
 * Plays `entry` live on its card, or stops playing. It plays at the play
 * size its card shows, so the card shows it as its thumbnail does. Only an
 * entry that draws with one WebGL renderer plays: the preview host lets go
 * of its own Pixi application for an entry that brings its own renderer.
 * The others keep their photo.
 */
function playLive(entry: ArcadeEntry | undefined): void {
    if (liveHost === undefined || liveElement === undefined) return;
    const request = ++liveRequests;
    liveHost.stop();
    liveEntry = undefined;
    liveFrames = 0;
    if (entry === undefined || !drawsWithOneRenderer(entry)) return;
    liveElement.style.width = `${entry.screenWidth}px`;
    liveElement.style.height = `${entry.screenHeight}px`;
    entry.load().then((starter) => {
        if (request !== liveRequests) return undefined;
        const prepared = livePreparing.then(() => liveHost.prepare(starter));
        // The next preparation waits for this one, whether or not it succeeds
        livePreparing = prepared.catch(() => undefined);
        return prepared.then(() => {
            if (request !== liveRequests) return;
            liveHost.start(starter);
            liveEntry = entry;
        });
    }).catch(() => {
        // The card keeps its photo; launching the entry will say what went wrong
    });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The longest step the loop takes, in milliseconds. A longer gap, such as a hidden tab's, is clamped to it. */
const MAX_STEP_MS = 50;
/**
 * How often a game playing is saved, in milliseconds of play. A save is a
 * small JSON string written to `localStorage`, so it costs little. A crash
 * loses no more than this.
 */
const SAVE_EVERY_MS = 5000;
/** How many frames a live entry draws on its card before it is shown, so it never shows blank. */
const LIVE_SHOWN_AFTER_FRAMES = 3;
const DEV = import.meta.env.DEV;

/**
 * Starts measuring each frame, for the Perfmon, or stops. Each opening starts
 * afresh. The meter and the GPU's timer cost a little each frame, so they run
 * only while the Perfmon is open. The first opening loads the Perfmon, and
 * measuring starts once it has, if the Perfmon is open still.
 */
function measurePerformance(isOn: boolean): void {
    meter?.destroy();
    meter = undefined;
    host.isGpuTimed = isOn;
    if (!isOn) return;
    loadPerfmon().then((loaded) => {
        perfmon = loaded;
        if (model.isPerfmonOpen && meter === undefined) meter = loaded.createPerformanceMeter({ takeGpuMs: host.takeGpuMs });
    }).catch((error: unknown) => {
        console.warn('The Perfmon could not load.', error);
    });
}

/** The starter the list of metrics not measured was last made for, and the list. */
let unmeasuredFor: EntryStarter | undefined;
let unmeasured: readonly MetricKind[] = ['gpuMs'];

/**
 * The metrics the Perfmon can't measure as things stand, shown as n/a: the
 * GPU's time unless a Pixi entry runs, and those the entry running says it
 * can't measure. Made again only when the entry running changes.
 */
function unmeasuredMetrics(): readonly MetricKind[] {
    const starter = host.session === undefined ? undefined : host.starter;
    if (starter === unmeasuredFor) return unmeasured;
    unmeasuredFor = starter;
    const own = starter?.unmeasuredMetrics ?? [];
    unmeasured = starter?.kind === 'pixi' ? own : ['gpuMs', ...own];
    return unmeasured;
}

/** Gives the host the sound settings. Muting mutes every chip, the entries' and the page's own. */
function applySoundSettings(settings: ArcadeSoundSettings): void {
    sound.settings = settings;
    sound.isMuted = settings.isMuted;
}

/**
 * Whether the runner is turned a quarter turn clockwise: on a phone or a
 * tablet held upright, for a game wider than tall. Only a game at a fixed
 * size on the host's Pixi stage turns, since the host maps the pointer
 * through the turn for that stage alone. Every game is one, and its starter,
 * once loaded, confirms it.
 */
function isRunnerTurned(): boolean {
    const entry = model.activeEntry;
    if (!canTurn || model.phase === 'browsing' || entry === undefined || !portrait.matches) return false;
    if (entry.tags.kind !== 'game' || entry.screenWidth <= entry.screenHeight) return false;
    const starter = model.starter;
    return starter === undefined || (starter.kind === 'pixi' && starter.fitTo === undefined);
}

/** Returns the ids of the entries the visitor marked as favourites on a visit before. The model drops any it does not list. */
function readFavourites(): string[] {
    const saved = store.readJson(FAVOURITES_KEY);
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [];
}

/**
 * Saves the game playing, for the visitor to resume next time, if its
 * session can save. A game with nothing worth resuming, such as a run that is
 * over, has any save it had removed. Previews and thumbnails are never saved:
 * they run in hosts of their own.
 */
function saveGame(): void {
    playedSinceSaveMs = 0;
    const entry = model.activeEntry;
    const session = host.session;
    if (entry === undefined || session?.saveGame === undefined) return;
    const saved = session.saveGame();
    if (saved === undefined || !store.writeJson(SAVED_GAME_KEY + entry.id, saved)) store.remove(SAVED_GAME_KEY + entry.id);
}

/**
 * Loads the game saved for `entry` into the session just started, so it
 * shows behind the offer to resume it. A save the session cannot load, from
 * an older version of the game say, is removed, and the offer is closed: the
 * session plays on as it started.
 */
function loadSavedGame(entry: ArcadeEntry): void {
    const saved = store.readJson(SAVED_GAME_KEY + entry.id);
    const isLoaded = saved !== undefined && host.session?.loadGame?.(saved) === true;
    if (isLoaded) return;
    store.remove(SAVED_GAME_KEY + entry.id);
    model.resume();
}

function pageElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (element === null) throw new Error(`The page has no #${id} element`);
    return element;
}

/**
 * Writes the URL. Going into an entry adds a step to the browser's history,
 * with the wall beneath it, so Back (a phone's back button, say) returns to
 * the wall rather than leaving the Arcade, even from a link straight to the
 * entry. Played from its info panel, the entry takes over the panel's step
 * instead, so Back from it returns to the wall, not to the panel. Leaving the
 * entry some other way (its exit, or a failed load) takes its step back off.
 * Everything else rewrites the step the page is on. The title is written
 * after the steps, or once the step back lands (see writeTitle).
 */
function writeUrl(step: 'enter' | 'leave' | 'replace'): void {
    const wall = wallUrl();
    const entry = playingEntry();
    const url = entry === undefined ? wall : entryUrl(entry);
    const state: unknown = history.state;
    if (step === 'enter' && entry !== undefined && state !== ENTRY_STEP) {
        if (isPanelState(state)) {
            history.replaceState(ENTRY_STEP, '', url);
        }
        else {
            history.replaceState(undefined, '', wall);
            history.pushState(ENTRY_STEP, '', url);
        }
    }
    else if (step === 'leave' && state === ENTRY_STEP) {
        // The step back finds the Arcade already browsing, and writes the title when it lands
        stepBack();
        return;
    }
    else {
        // An entry's or a panel's step stays one through a reload, or Forward back to it
        const kept = state === ENTRY_STEP || isPanelState(state) ? state : undefined;
        history.replaceState(kept, '', url);
    }
    writeTitle();
}

/**
 * Writes the page's title, which names the entry playing, as its own copy of
 * the page does. Chrome keeps a title with each history step and shows that
 * step's title when the page steps back to it. Then it updates the tab only if
 * the title changes. So the title is written once the history step it belongs
 * to is current, never before the step is written or stepped back to.
 */
function writeTitle(): void {
    const entry = playingEntry();
    document.title = entry === undefined ? ARCADE_TITLE : `${entry.name} - ${ARCADE_TITLE}`;
}

/** The entry playing, if one is: from its launch until the Arcade is back on the wall. */
function playingEntry(): ArcadeEntry | undefined {
    return model.phase === 'browsing' ? undefined : model.activeEntry;
}

/**
 * Writes the info panel's history step, as the panel open changes. Opening a
 * panel adds a step at the same URL, so Back closes it; closing it takes the
 * step back off; one panel opening as another closes takes over its step.
 */
function writePanelStep(): void {
    const panel = panelStep();
    const isPanelStep = isPanelState(history.state);
    if (panel !== undefined && !isPanelStep) history.pushState(panel, '', wallUrl());
    else if (panel !== undefined) history.replaceState(panel, '', wallUrl());
    else if (isPanelStep) stepBack();
}

/** The wall's URL: the Arcade's path, with the search in its query. */
function wallUrl(): string {
    return ARCADE_PATH + formatArcadeQuery(location.search, model.query, model.chips);
}

/** The URL of `entry` playing: its own path, keeping the search in the query for the way back to the wall. */
function entryUrl(entry: ArcadeEntry): string {
    return formatEntryPath(ARCADE_PATH, entry.id) + formatArcadeQuery(location.search, model.query, model.chips);
}

/**
 * The mark of the history step for the info panel open, if one is. A panel
 * opened over the entry playing has none: Back from an entry leaves it,
 * whatever is open over it.
 */
function panelStep(): string | undefined {
    if (model.phase !== 'browsing') return undefined;
    if (model.infoEntry !== undefined) return INFO_STEP + model.infoEntry.id;
    return model.isAboutOpen ? ABOUT_STEP : undefined;
}

function isPanelState(state: unknown): boolean {
    return state === ABOUT_STEP || infoIdOf(state) !== undefined;
}

/** The id of the entry whose info panel a history step was opened for, if it was. */
function infoIdOf(state: unknown): string | undefined {
    return typeof state === 'string' && state.startsWith(INFO_STEP) ? state.slice(INFO_STEP.length) : undefined;
}

/** Steps back in history, noting it is the page's own doing, not the visitor's. */
function stepBack(): void {
    ownStepsBack++;
    history.back();
}

/**
 * Follows a step through history. A step the visitor made, with Back or
 * Forward, opens or closes the info panels as the step says, and goes into
 * or out of an entry as its URL says. A step the page made itself has
 * nothing to tell the model. The panels may also have changed since the page
 * made it, as when a card's info opened as the Arcade's closed. So the
 * history follows the model instead, and the panel that is open gets its
 * step.
 */
function onHistoryStep(): void {
    if (ownStepsBack > 0) {
        ownStepsBack--;
        writeTitle();
        writePanelStep();
    }
    else {
        followPanelStep();
        followUrl();
    }
}

/** Opens or closes the info panels as the history step says: Back from a panel closes it, Forward opens it again. */
function followPanelStep(): void {
    const state: unknown = history.state;
    const id = infoIdOf(state);
    if (id !== undefined) {
        model.openInfo(id);
    }
    else if (state === ABOUT_STEP) {
        model.openAbout();
    }
    else {
        model.closeInfo();
        model.closeAbout();
    }
}

/**
 * Follows the URL's path. An entry's path launches the entry, and the
 * Arcade's own path leaves any entry for the wall. A path that names no
 * entry, as the site's 404 page may be shown at, is rewritten to the wall's.
 */
function followUrl(): void {
    const id = parseEntryPath(location.pathname, ARCADE_PATH);
    if (id === '') {
        model.exit();
        return;
    }
    if (id === undefined || findEntry(id) === undefined) {
        writeUrl('replace');
        return;
    }
    // Straight to the entry, from a link or a step through history: there is no wall to leave
    if (model.phase === 'browsing') model.launch(id, { isDirect: true });
}

/** Whether `entry` draws with one WebGL renderer, Pixi or three.js, with or without HTML beside it. */
function drawsWithOneRenderer(entry: ArcadeEntry): boolean {
    const renderers = ENTRY_FACTS[entry.id]?.renderers ?? [];
    let webgl = 0;
    for (let i = 0; i < renderers.length; i++) {
        if (renderers[i] !== 'html') webgl++;
    }
    return webgl === 1;
}

/**
 * In development, an entry's listed play area must be the one it plays at:
 * for an entry that lays itself out (`fitTo`), the one it lays out to when it
 * is fitted to that area.
 */
function checkPlayArea(entry: ArcadeEntry, starter: EntryStarter): void {
    if (starter.kind !== 'pixi') return;
    starter.fitTo?.(entry.screenWidth, entry.screenHeight);
    assert(
        starter.screenWidth === entry.screenWidth && starter.screenHeight === entry.screenHeight,
        () => `${entry.id}: listed as ${entry.screenWidth}x${entry.screenHeight}, `
            + `but plays at ${starter.screenWidth}x${starter.screenHeight}; correct its entry`,
    );
}

/**
 * The highscore tables: kept by the Worker at `url`, which the build names
 * (`VITE_HIGHSCORES_URL`), or, with none, in memory, by the Worker's rules,
 * and forgotten when the page closes, as in development.
 */
function highscoreStoreFor(url: string | undefined): HighscoreStore {
    return url === undefined || url === '' ? createMemoryHighscoreStore({ games: GAMES }) : createFetchHighscoreStore({ url });
}

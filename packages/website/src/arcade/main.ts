import { ENTRY_FACTS } from 'virtual:entry-facts';
import { refreshView, updateView } from '@mvtjs/html';
import { assert, watch } from '@mvtjs/utils';
import { CATALOGUE, findEntry } from '../entries';
import type { ArcadeEntry, EntryStarter } from '../entry-types';
import { createEntryHost, createPageSound, isTouchDevice } from '../runner';
import { type ArcadeSoundSettings, createArcadeModel, formatArcadeQuery, formatSoundSettings, parseSoundSettings } from './models';
import { type ArcadeAudioViews, ArcadeView, loadArcadeAudioViews } from './views';
import './arcade.css';

// The Arcade's page. One loop runs everything, in the MVT order. It updates
// the Arcade's model first. Then the entry host ticks the entry running, if
// any, with its models, its views and its renderers. Last come the Arcade's
// views, which are in the page and in the site's nav. The page's own sound
// chip, which plays the Arcade's sounds, advances its clock before those
// views and sends what they wrote after them.
//
// The page starts and ends the entry's sessions as the model's phase
// changes. It keeps the URL in step with the model. The search is in the
// query, and the entry is in the fragment. An info panel that is open, an
// entry's or the Arcade's, has a history step of its own. The page also
// plays an entry live on its card (attract mode) when the wall asks, in a
// second host that takes no input.

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

const root = pageElement('arcade');

const isTouch = isTouchDevice();
const stage = document.createElement('div');
stage.className = 'runner-stage';
// The page's sound has two chips. The host ticks the entries' chip with each
// session. The page ticks its own chip, which plays the menus' sounds.
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

// Declared before the model is made, which reads it.
/** Where the visitor's sound settings are kept between visits. */
const SOUND_SETTINGS_KEY = 'mvt-arcade-sound';

const model = createArcadeModel({
    entries: CATALOGUE,
    factsFor: (id) => ENTRY_FACTS[id],
    search: location.search,
    soundSettings: readSoundSettings(),
    loadEntry: async (entry) => {
        const starter = await entry.load();
        if (DEV) checkPlayArea(entry, starter);
        await host.prepare(starter);
        return starter;
    },
});

/** The last frame of the entry just left, for the way back to its card. */
let exitFrame: HTMLCanvasElement | undefined;

// The visitor's system setting for less motion, followed as it changes
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

root.append(ArcadeView({
    model,
    stage,
    exitFrame: () => exitFrame,
    isMotionReduced: () => reducedMotion.matches,
    liveElement,
    navTools: pageElement('site-nav-tools'),
    liveEntry: () => liveEntry,
    isLiveShowing: () => liveFrames >= LIVE_SHOWN_AFTER_FRAMES,
    pageSound: sound.pageAudio80,
    audioViews: () => audioViews,
    onLiveWanted: playLive,
    playRectFor: (entry, starter) => host.playRectFor({
        screenWidth: entry.screenWidth,
        screenHeight: entry.screenHeight,
        starter,
        hasControls: entry.tags.kind === 'game',
    }),
}));

// Declared before the page follows the URL below, which reads them
/** Marks the history step an entry's URL was pushed on, so leaving it knows to step back. */
const ENTRY_STEP = 'arcade-entry';
/** Begins the mark of the history step an entry's info panel was opened on, which ends with the entry's id. */
const INFO_STEP = 'arcade-info:';
/** Marks the history step the Arcade's own info panel was opened on. */
const ABOUT_STEP = 'arcade-about';
/** How many times the page has stepped back in history itself, whose arrival it has not yet seen. */
let ownStepsBack = 0;

const watcher = watch({
    phase: () => model.phase,
    restarts: () => model.restartCount,
    query: () => model.queryRevision,
    panel: panelStep,
});
// An info panel's step, reloaded, opens its panel again
followPanelStep();
watcher.poll();

/** The sound settings last given to the host and saved. */
let keptSoundSettings = model.soundSettings;
applySoundSettings(keptSoundSettings);

// A link to an entry (`#crumb-chase`) launches it; going back or forward in history follows,
// so Back from an entry returns to the wall, and Back from an info panel closes it
launchFromFragment();
window.addEventListener('hashchange', launchFromFragment);
window.addEventListener('popstate', onHistoryStep);

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

let lastTimeMs: number | undefined;
requestAnimationFrame(frame);

function frame(timeMs: number): void {
    // A long gap (a hidden tab) is clamped rather than simulated
    const deltaMs = lastTimeMs === undefined ? 0 : Math.min(timeMs - lastTimeMs, MAX_STEP_MS);
    lastTimeMs = timeMs;

    model.update(deltaMs);
    followModel();
    host.tick(timeMs, deltaMs);
    if (liveHost !== undefined) {
        liveHost.tick(timeMs, deltaMs);
        if (liveEntry !== undefined && liveElement?.isConnected === true) liveFrames++;
    }
    // The page's whole body is ticked, the Arcade and its tools in the site's
    // nav. The page's own chip keeps time with it, as an entry's chip does
    // with its session. Its clock advances before the views, and what they
    // wrote is sent after them.
    sound.pageControls.update(deltaMs);
    updateView(document.body, deltaMs);
    refreshView(document.body);
    sound.pageControls.flush();

    requestAnimationFrame(frame);
}

/** Starts and ends the entry's sessions as the model's phase changes, and writes the URL. */
function followModel(): void {
    const { phase, restarts, query, panel } = watcher.poll();
    if (phase.changed) {
        if (phase.value === 'playing') {
            exitFrame = undefined;
            assert(model.starter !== undefined, 'arcade: an entry plays only once it has loaded');
            host.start(model.starter);
        }
        else if (phase.previous === 'playing') {
            exitFrame = host.stop();
        }
    }
    if (restarts.changed) host.restart();
    // The host stays paused while the entry is held still as it first shows, and while the visitor pauses it.
    host.isPaused = model.isPaused || model.isHeld;
    // The model replaces its sound settings object whenever one changes. The page gives the new settings to the host and saves them.
    if (model.soundSettings !== keptSoundSettings) {
        keptSoundSettings = model.soundSettings;
        applySoundSettings(keptSoundSettings);
        writeSoundSettings(keptSoundSettings);
    }
    if (phase.changed && phase.previous === 'browsing') writeUrl('enter');
    else if (phase.changed && phase.value === 'browsing') writeUrl('leave');
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
/** How many frames a live entry draws on its card before it is shown, so it never shows blank. */
const LIVE_SHOWN_AFTER_FRAMES = 3;
const DEV = import.meta.env.DEV;

/** Gives the host the sound settings. Muting mutes both chips, the entries' and the page's own. */
function applySoundSettings(settings: ArcadeSoundSettings): void {
    sound.settings = settings;
    sound.entryControls.isMuted = settings.isMuted;
    sound.pageControls.isMuted = settings.isMuted;
}

/** Reads the sound settings the visitor last left. Returns the defaults if storage is blocked or holds no valid settings. */
function readSoundSettings(): ArcadeSoundSettings {
    try {
        return parseSoundSettings(localStorage.getItem(SOUND_SETTINGS_KEY) ?? undefined);
    }
    catch {
        return parseSoundSettings(undefined);
    }
}

/** Saves the sound settings for the visitor's next visit. */
function writeSoundSettings(settings: ArcadeSoundSettings): void {
    try {
        localStorage.setItem(SOUND_SETTINGS_KEY, formatSoundSettings(settings));
    }
    catch {
        // Storage is blocked or full. The settings still hold for this visit.
    }
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
 * Everything else rewrites the step the page is on.
 */
function writeUrl(step: 'enter' | 'leave' | 'replace'): void {
    const wall = wallUrl();
    const entry = model.phase === 'browsing' ? undefined : model.activeEntry;
    const state: unknown = history.state;
    if (step === 'enter' && entry !== undefined && state !== ENTRY_STEP) {
        if (isPanelState(state)) {
            history.replaceState(ENTRY_STEP, '', `${wall}#${entry.id}`);
        }
        else {
            history.replaceState(undefined, '', wall);
            history.pushState(ENTRY_STEP, '', `${wall}#${entry.id}`);
        }
    }
    else if (step === 'leave' && state === ENTRY_STEP) {
        // The hashchange this brings finds the Arcade already browsing
        stepBack();
    }
    else {
        // An entry's or a panel's step stays one through a reload, or Forward back to it
        const kept = state === ENTRY_STEP || isPanelState(state) ? state : undefined;
        history.replaceState(kept, '', entry === undefined ? wall : `${wall}#${entry.id}`);
    }
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

/** The wall's URL: the page's, with the search in its query. */
function wallUrl(): string {
    return location.pathname + formatArcadeQuery(location.search, model.query, model.chips);
}

/** The mark of the history step for the info panel open, if one is. */
function panelStep(): string | undefined {
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
 * Forward, opens or closes the info panels as the step says. A step the page
 * made itself has nothing to tell the model. The panels may also have
 * changed since the page made it, as when a card's info opened as the
 * Arcade's closed. So the history follows the model instead, and the panel
 * that is open gets its step.
 */
function onHistoryStep(): void {
    if (ownStepsBack > 0) {
        ownStepsBack--;
        writePanelStep();
    }
    else {
        followPanelStep();
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

function launchFromFragment(): void {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id === '') {
        model.exit();
        return;
    }
    if (findEntry(id) === undefined) {
        writeUrl('replace');
        return;
    }
    if (model.phase === 'browsing') model.launch(id);
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

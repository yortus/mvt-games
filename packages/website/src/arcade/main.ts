import { ENTRY_FACTS } from 'virtual:entry-facts';
import { refreshView, updateView } from '@mvtjs/html';
import { assert, watch } from '@mvtjs/utils';
import { CATALOGUE, findEntry } from '../entries';
import type { ArcadeEntry, EntryStarter } from '../entry-types';
import { createEntryHost, isTouchDevice } from '../runner';
import { createArcadeModel, formatArcadeQuery } from './models';
import { ArcadeView } from './views';
import './arcade.css';

// The arcade's page. One loop runs everything, in the MVT order: the arcade's
// model, then the entry running, if any (its models, its views, its
// renderers, through the entry host), then the arcade's views, which are in
// the page and in the site's nav. The page starts and ends the entry's
// sessions as the model's phase changes, and keeps the URL in step with the
// model: the search in the query, the entry in the fragment, and an info
// panel open (an entry's, or the arcade's) in a history step of its own. It
// also plays an entry live on its card (attract mode), when the wall asks, in
// a second host that takes no input.

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

const root = pageElement('arcade');

const isTouch = isTouchDevice();
const stage = document.createElement('div');
stage.className = 'runner-stage';
const host = createEntryHost({ element: stage, isTouch });

// Attract mode, where there is a pointer to rest on a card: one entry at a
// time plays live on its card, in a host of its own, so one WebGL renderer
// more at most. Presentation, so the model never knows.
const liveElement = isTouch ? undefined : document.createElement('div');
const liveHost = liveElement === undefined ? undefined : createEntryHost({ element: liveElement, isTouch: false, takesInput: false });
if (liveElement !== undefined) liveElement.className = 'card-live-stage';
/** The entry playing live, once it has started, and how many frames it has drawn on its card. */
let liveEntry: ArcadeEntry | undefined;
let liveFrames = 0;
/** Counts the entries asked to play live, so a load overtaken by another is dropped. */
let liveRequests = 0;
/** The host's preparations, one after another: two at once could each make a renderer. */
let livePreparing: Promise<void> = Promise.resolve();

const model = createArcadeModel({
    entries: CATALOGUE,
    factsFor: (id) => ENTRY_FACTS[id],
    search: location.search,
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
/** Marks the history step the arcade's own info panel was opened on. */
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
    // The page's whole body: the arcade, and its magnifier in the site's nav
    updateView(document.body, deltaMs);
    refreshView(document.body);

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
    host.isPaused = model.isPaused;
    if (phase.changed && phase.previous === 'browsing') writeUrl('enter');
    else if (phase.changed && phase.value === 'browsing') writeUrl('leave');
    else if (panel.changed) writePanelStep();
    else if (phase.changed || query.changed) writeUrl('replace');
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

const MAX_STEP_MS = 50;
/** Frames a live entry draws on its card before it is shown, so it never shows blank. */
const LIVE_SHOWN_AFTER_FRAMES = 3;
const DEV = import.meta.env.DEV;

function pageElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (element === null) throw new Error(`The page has no #${id} element`);
    return element;
}

/**
 * Writes the URL. Going into an entry adds a step to the browser's history,
 * with the wall beneath it, so Back (a phone's back button, say) returns to
 * the wall rather than leaving the arcade, even from a link straight to the
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
        // The hashchange this brings finds the arcade already browsing
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
 * Follows a step through history. The visitor's own (Back or Forward) opens
 * or closes the info panels as the step says. One the page made itself has
 * nothing to say to the model, and the panels may have changed since it was
 * made (a card's info opened as the arcade's closed): the history follows the
 * model instead, so the panel open has its step.
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

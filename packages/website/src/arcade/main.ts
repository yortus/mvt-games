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
// renderers, through the entry host), then the arcade's views. The page
// starts and ends the entry's sessions as the model's phase changes, and keeps
// the URL in step with the model: the search in the query, the entry
// in the fragment. It also plays an entry live on its card (attract mode),
// when the wall asks, in a second host that takes no input.

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

const watcher = watch({
    phase: () => model.phase,
    restarts: () => model.restartCount,
    query: () => model.queryRevision,
});
watcher.poll();

// A link to an entry (`#crumb-chase`) launches it; going back or forward in history follows
launchFromFragment();
window.addEventListener('hashchange', launchFromFragment);

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
    updateView(root, deltaMs);
    refreshView(root);

    requestAnimationFrame(frame);
}

/** Starts and ends the entry's sessions as the model's phase changes, and writes the URL. */
function followModel(): void {
    const { phase, restarts, query } = watcher.poll();
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
    if (phase.changed || query.changed) writeUrl();
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

function writeUrl(): void {
    const search = formatArcadeQuery(location.search, model.query, model.chips);
    const entry = model.phase === 'browsing' ? undefined : model.activeEntry;
    history.replaceState(undefined, '', location.pathname + search + (entry === undefined ? '' : `#${entry.id}`));
}

function launchFromFragment(): void {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id === '') {
        model.exit();
        return;
    }
    if (findEntry(id) === undefined) {
        writeUrl();
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

import { ENTRY_FACTS } from 'virtual:entry-facts';
import { refreshView, updateView } from '@mvtjs/html';
import { assert, watch } from '@mvtjs/utils';
import { CATALOGUE, findEntry } from '../catalogue';
import type { ArcadeEntry, EntryStarter } from '../entries';
import { createEntryHost, isTouchDevice } from '../runner';
import { createArcadeModel, formatArcadeQuery } from './models';
import { ArcadeView } from './views';
import './arcade.css';

// The arcade's page. One loop runs everything, in the MVT order: the arcade's
// model, then the entry running, if any (its models, its views, its
// renderers, through the entry host), then the arcade's views. The page
// starts and ends the entry's sessions as the model's phase changes, and keeps
// the URL in step with the model: the search in the query, the entry
// in the fragment.

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

const root = pageElement('arcade');

const stage = document.createElement('div');
stage.className = 'runner-stage';
const host = createEntryHost({ element: stage, isTouch: isTouchDevice() });

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

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const MAX_STEP_MS = 50;
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

/** In development, an entry's listed play area must be the one it plays at, unless it follows the viewport. */
function checkPlayArea(entry: ArcadeEntry, starter: EntryStarter): void {
    if (starter.kind !== 'pixi' || starter.fitsViewport) return;
    assert(
        starter.screenWidth === entry.screenWidth && starter.screenHeight === entry.screenHeight,
        () => `${entry.id}: listed as ${entry.screenWidth}x${entry.screenHeight}, `
            + `but plays at ${starter.screenWidth}x${starter.screenHeight}; correct its entry`,
    );
}

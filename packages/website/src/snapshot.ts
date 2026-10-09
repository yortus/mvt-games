import { Application, TextureSource } from 'pixi.js';
import { refreshView, updateView, type View } from '@mvtjs/pixi';
import type { AudioControls } from '@mvtjs/audio';
import { createHeadlessAudio80 } from '@mvtjs/audio/headless';
import { CATALOGUE, findEntry } from './entries';
import { type ArcadeEntry, type EntrySession, thumbnailCropOf } from './entry-types';

// This is the snapshot page (`snapshot.html`). Only
// `scripts/generate-thumbnails.ts` uses it. The dev server serves it, and the
// build leaves it out.
//
// Opened as `snapshot.html?entry=<id>`, it starts that entry at its play
// size. It advances the entry in frame-sized steps, for as long as the entry
// asks (`thumbnailAdvanceMs`). Each step plays any controls the entry asks
// for (`thumbnailInput`), advances its models and its sound chip's clock, and
// updates its views. Then the page refreshes the views, sends the chip's
// writes, and draws once, in the order the entry host uses. It then resolves
// `window.snapshot` with the rectangle to capture.
//
// Opened without an entry, it resolves `window.snapshot` with every entry's
// id, play area and thumbnail crop. The script sizes the viewport to each
// entry, so an entry whose play area follows the viewport lays itself out as
// designed. The script also captures the picture sharp enough for its crop to
// fill a card.
//
// The steps are small because a model with phases or timelines would skip
// what happens between them in one giant step.

/** What the page resolves `window.snapshot` with. */
interface SnapshotResult {
    readonly entries?: readonly {
        readonly id: string;
        readonly width: number;
        readonly height: number;
        readonly cropWidth: number;
        readonly cropHeight: number;
    }[];
    readonly rect?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

Object.assign(window, { snapshot: takeSnapshot() });

async function takeSnapshot(): Promise<SnapshotResult> {
    const id = new URLSearchParams(location.search).get('entry');
    if (id === null) {
        return {
            entries: CATALOGUE.map((entry) => ({
                id: entry.id,
                width: entry.screenWidth,
                height: entry.screenHeight,
                cropWidth: thumbnailCropOf(entry).width,
                cropHeight: thumbnailCropOf(entry).height,
            })),
        };
    }
    const entry = findEntry(id);
    if (entry === undefined) throw new Error(`No entry '${id}'`);

    const root = document.getElementById('snapshot');
    if (root === null) throw new Error('The page has no #snapshot element');
    await start(entry, root);
    // Let the frame drawn reach the screen
    await waitForFrame();
    await waitForFrame();
    const bounds = root.getBoundingClientRect();
    return { rect: { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height } };
}

async function start(entry: ArcadeEntry, root: HTMLElement): Promise<void> {
    const starter = await entry.load();
    const advanceMs = starter.thumbnailAdvanceMs ?? STEP_MS;

    if (starter.kind === 'pixi') {
        // An entry that lays itself out is photographed at the play area its metadata lists
        starter.fitTo?.(entry.screenWidth, entry.screenHeight);
        const isPixelArt = starter.pixelArt ?? false;
        TextureSource.defaultOptions.scaleMode = isPixelArt ? 'nearest' : 'linear';
        const app = new Application();
        await app.init({
            width: starter.screenWidth,
            height: starter.screenHeight,
            // It is drawn sharp enough for a thumbnail larger than the play area. Pixel art is enlarged as pixels instead
            resolution: isPixelArt ? 1 : 2,
            antialias: !isPixelArt,
            roundPixels: isPixelArt,
            background: 0x000000,
            autoStart: false,
        });
        app.canvas.style.width = `${starter.screenWidth}px`;
        app.canvas.style.height = `${starter.screenHeight}px`;
        root.style.width = app.canvas.style.width;
        root.style.height = app.canvas.style.height;
        if (isPixelArt) app.canvas.style.imageRendering = 'pixelated';
        root.append(app.canvas);
        // The entry runs headless, with no host and a silent chip, as when it is measured
        const { audio80, controls } = createHeadlessAudio80();
        const session = starter.start({ stage: app.stage, sound: audio80 });
        advance({ session, views: [app.stage], controls, totalMs: advanceMs, input: starter.thumbnailInput });
        app.render();
        return;
    }

    root.style.width = `${entry.screenWidth}px`;
    root.style.height = `${entry.screenHeight}px`;
    const { audio80, controls } = createHeadlessAudio80();
    const session = starter.start({ element: root, sound: audio80 });
    // Give the entry time to size itself, and to make renderers that start asynchronously
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    advance({ session, views: session.views, controls, totalMs: advanceMs });
    session.render();
}

/** What `advance` advances, and for how long. */
interface AdvanceOptions {
    readonly session: EntrySession;
    /** The roots of the session's views. */
    readonly views: readonly View[];
    /** The controls of the chip that the session plays on. */
    readonly controls: AudioControls;
    readonly totalMs: number;
    /** Plays the entry's controls before each step, as `PixiEntryStarter.thumbnailInput` does. */
    readonly input?: (session: EntrySession, elapsedMs: number) => void;
}

/**
 * Advances a session by `totalMs` in frame-sized steps, then refreshes its
 * views once and sends the chip's writes.
 */
function advance(options: AdvanceOptions): void {
    const { session, views, controls, totalMs, input } = options;
    let remaining = totalMs;
    while (remaining > 0) {
        const step = Math.min(STEP_MS, remaining);
        input?.(session, totalMs - remaining);
        session.update(step);
        controls.update(step);
        for (let i = 0; i < views.length; i++) updateView(views[i], step);
        remaining -= step;
    }
    for (let i = 0; i < views.length; i++) refreshView(views[i]);
    controls.flush();
}

function waitForFrame(): Promise<number> {
    return new Promise((resolve) => requestAnimationFrame(resolve));
}

/** One frame at 60 frames a second, rounded down. */
const STEP_MS = 16;

/** How long an element entry is given to lay itself out and make its renderers. */
const SETTLE_MS = 500;

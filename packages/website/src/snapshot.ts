import { Application, TextureSource } from 'pixi.js';
import { CATALOGUE, findEntry } from './entries';
import { type ArcadeEntry, thumbnailCropOf } from './entry-types';
import { advanceHeadless, startPixiHeadless, thumbnailMomentOf } from './runner';

// The snapshot page (`snapshot.html`), for `scripts/generate-thumbnails.ts`
// only: it is served by the dev server and left out of the build. Opened as
// `snapshot.html?entry=<id>`, it starts that entry at its play size, advances
// it as long as the entry asks (`thumbnailAdvanceMs`) in frame-sized steps,
// updating its models and views and playing any controls it asks for
// (`thumbnailInput`), then refreshes and draws once (the runner's
// `startPixiHeadless` and `advanceHeadless`, which the visual tests share). It then
// resolves `window.snapshot` with the rectangle to capture. Opened without an
// entry, it resolves it with every entry's id, play area and thumbnail crop,
// so the script can size the viewport to each (an entry whose play area
// follows the viewport then lays itself out as designed) and capture the
// picture sharp enough for its crop to fill a card.

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

Object.assign(window, { snapshot: snapshot() });

async function snapshot(): Promise<SnapshotResult> {
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
    await nextFrame();
    await nextFrame();
    const bounds = root.getBoundingClientRect();
    return { rect: { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height } };
}

async function start(entry: ArcadeEntry, root: HTMLElement): Promise<void> {
    const starter = await entry.load();
    const totalMs = thumbnailMomentOf(starter);

    if (starter.kind === 'pixi') {
        // Fitted before the application is sized: an entry that lays itself out is
        // photographed at the play area its metadata lists
        starter.fitTo?.(entry.screenWidth, entry.screenHeight);
        const isPixelArt = starter.pixelArt ?? false;
        TextureSource.defaultOptions.scaleMode = isPixelArt ? 'nearest' : 'linear';
        const app = new Application();
        await app.init({
            width: starter.screenWidth,
            height: starter.screenHeight,
            // Drawn sharp enough for a thumbnail larger than the play area; pixel art is enlarged as pixels instead
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
        const session = startPixiHeadless({ entry, starter, stage: app.stage });
        advanceHeadless({ session, views: [app.stage], totalMs, input: starter.thumbnailInput });
        app.render();
        return;
    }

    root.style.width = `${entry.screenWidth}px`;
    root.style.height = `${entry.screenHeight}px`;
    const session = starter.start({ element: root });
    // Give the entry time to size itself, and to make renderers that start asynchronously
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    advanceHeadless({ session, views: session.views, totalMs });
    session.render();
}

function nextFrame(): Promise<number> {
    return new Promise((resolve) => requestAnimationFrame(resolve));
}

/** How long an element entry is given to lay itself out and make its renderers. */
const SETTLE_MS = 500;

import { Application, Container, RenderTexture } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import type { ArcadeEntry, EntrySession, PixiEntryStarter } from '../entries';
import { boidsEntry } from './boids';
import { fallingSandEntry } from './falling-sand';
import { reorderingListsEntry } from './reordering-lists';

// ---------------------------------------------------------------------------
// Demo registry
// ---------------------------------------------------------------------------

/** The demos drawn with Pixi, the only ones this gallery can run. */
const demos: readonly ArcadeEntry[] = [
    boidsEntry,
    fallingSandEntry,
    reorderingListsEntry,
];

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------

const galleryEl = document.getElementById('gallery')!;
const gridEl = document.getElementById('gallery-grid')!;
const runnerEl = document.getElementById('demo-runner')!;
const modalEl = document.getElementById('info-modal')!;
const infoCloseEl = document.getElementById('info-close')!;
const infoNameEl = document.getElementById('info-name')!;
const infoDescEl = document.getElementById('info-desc')!;
const infoTechniquesEl = document.getElementById('info-techniques')!;
const infoSourceEl = document.getElementById('info-source-container')!;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let activeApp: Application | undefined;
let activeSession: EntrySession | undefined;
let escapeHandler: ((e: KeyboardEvent) => void) | undefined;
let resizeHandler: (() => void) | undefined;

// ---------------------------------------------------------------------------
// Build gallery cards
// ---------------------------------------------------------------------------

const thumbImages: HTMLImageElement[] = [];

for (let i = 0; i < demos.length; i++) {
    const entry = demos[i];

    const card = document.createElement('div');
    card.className = 'demo-card';

    const img = document.createElement('img');
    img.className = 'demo-card-thumb';
    img.alt = entry.name;
    thumbImages.push(img);

    const body = document.createElement('div');
    body.className = 'demo-card-body';

    const title = document.createElement('div');
    title.className = 'demo-card-title';
    title.textContent = entry.name;

    const actions = document.createElement('div');
    actions.className = 'demo-card-actions';

    const runBtn = document.createElement('button');
    runBtn.className = 'btn-run';
    runBtn.textContent = 'Run';
    runBtn.addEventListener('click', () => launchDemo(i));

    const infoBtn = document.createElement('button');
    infoBtn.textContent = 'Info';
    infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showInfo(i);
    });

    actions.appendChild(runBtn);
    actions.appendChild(infoBtn);
    body.appendChild(title);
    body.appendChild(actions);
    card.appendChild(img);
    card.appendChild(body);
    gridEl.appendChild(card);
}

// ---------------------------------------------------------------------------
// Thumbnail generation
// ---------------------------------------------------------------------------

let thumbnailsGenerated = false;

function ensureThumbnails(): void {
    if (thumbnailsGenerated) return;
    thumbnailsGenerated = true;
    generateThumbnails();
}

async function generateThumbnails(): Promise<void> {
    const TICK_MS = 16;

    const thumbApp = new Application();
    await thumbApp.init({
        width: 480,
        height: 320,
        background: 0x000000,
        antialias: true,
    });
    // Keep the canvas offscreen - we only need the renderer
    thumbApp.canvas.style.display = 'none';
    document.body.appendChild(thumbApp.canvas);

    for (let i = 0; i < demos.length; i++) {
        const entry = demos[i];
        try {
            const starter = await loadPixiStarter(entry);

            const tempStage = new Container();
            const session = starter.start({ stage: tempStage });

            const totalMs = starter.thumbnailAdvanceMs ?? TICK_MS;
            let remaining = totalMs;
            while (remaining > 0) {
                const step = remaining < TICK_MS ? remaining : TICK_MS;
                session.update(step);
                updateView(tempStage, step);
                remaining -= step;
            }
            refreshView(tempStage);

            const renderTexture = RenderTexture.create({
                width: starter.screenWidth,
                height: starter.screenHeight,
            });
            thumbApp.renderer.render({ container: tempStage, target: renderTexture });

            const dataUrl = await thumbApp.renderer.extract.image({
                target: renderTexture,
                format: 'png',
            });
            thumbImages[i].src = dataUrl.src;

            renderTexture.destroy(true);
            session.destroy();
            tempStage.destroy({ children: true });
        }
        catch {
            // Failed to generate thumbnail - leave img blank
        }
    }

    thumbApp.destroy(true, { children: true });
}

// ---------------------------------------------------------------------------
// Launch / exit demo
// ---------------------------------------------------------------------------

function setUrlFragment(demoId: string | undefined): void {
    const url = demoId ? '#' + demoId : location.pathname + location.search;
    history.replaceState(undefined, '', url);
}

async function launchDemo(index: number): Promise<void> {
    const entry = demos[index];
    const starter = await loadPixiStarter(entry);

    setUrlFragment(entry.id);
    galleryEl.style.display = 'none';
    runnerEl.classList.add('active');

    const app = new Application();
    await app.init({
        width: starter.screenWidth,
        height: starter.screenHeight,
        background: 0x1a1a2e,
        antialias: true,
    });
    app.canvas.style.touchAction = 'none';
    runnerEl.appendChild(app.canvas);
    fitCanvas(app, starter);

    // Back button
    const backBtn = document.createElement('button');
    backBtn.className = 'back-button';
    backBtn.innerHTML = '&#x2190;';
    backBtn.setAttribute('aria-label', 'Back to gallery');
    backBtn.addEventListener('click', exitDemo);
    runnerEl.appendChild(backBtn);

    const session = starter.start({ stage: app.stage, host: { renderer: app.renderer, ticker: app.ticker } });

    // Each frame ticks the demo's models, then the whole stage.
    app.ticker.add((ticker) => {
        session.update(ticker.deltaMS);
        updateView(app.stage, ticker.deltaMS);
        refreshView(app.stage);
    });

    activeApp = app;
    activeSession = session;

    // Resize handling - debounced so continuous dragging doesn't thrash
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    resizeHandler = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            fitCanvas(app, starter);
            session.resize?.();
        }, 150);
    };
    window.addEventListener('resize', resizeHandler);

    escapeHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            exitDemo();
        }
    };
    window.addEventListener('keydown', escapeHandler);
}

/**
 * Size the canvas to the demo, shrunk to fit the runner if need be, and
 * render at the pixel density it is displayed at. Rendering at a resolution
 * of 1 and letting the browser scale the canvas blurs everything, text most
 * visibly, on any screen whose device pixel ratio is not 1.
 */
function fitCanvas(app: Application, starter: PixiEntryStarter): void {
    const width = starter.screenWidth;
    const height = starter.screenHeight;
    const scale = Math.min(
        1,
        (runnerEl.clientWidth - CANVAS_MARGIN_PX * 2) / width,
        (runnerEl.clientHeight - CANVAS_MARGIN_PX * 2) / height,
    );
    const dpr = window.devicePixelRatio || 1;

    app.renderer.resize(width, height, scale * dpr);
    app.canvas.style.width = `${Math.floor(width * scale)}px`;
    app.canvas.style.height = `${Math.floor(height * scale)}px`;
}

/** Space kept clear around the canvas, matching the runner's CSS. */
const CANVAS_MARGIN_PX = 12;

function exitDemo(): void {
    if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        resizeHandler = undefined;
    }

    if (escapeHandler) {
        window.removeEventListener('keydown', escapeHandler);
        escapeHandler = undefined;
    }

    if (activeSession) {
        activeSession.destroy();
        activeSession = undefined;
    }

    if (activeApp) {
        activeApp.destroy(true, { children: true });
        activeApp = undefined;
    }

    // Remove back button if still present
    const backBtn = runnerEl.querySelector('.back-button');
    if (backBtn) backBtn.remove();

    runnerEl.classList.remove('active');
    galleryEl.style.display = '';
    setUrlFragment(undefined);
    ensureThumbnails();
}

// ---------------------------------------------------------------------------
// Info modal
// ---------------------------------------------------------------------------

function showInfo(index: number): void {
    const entry = demos[index];

    infoNameEl.textContent = entry.name;
    infoDescEl.textContent = entry.description;

    infoTechniquesEl.innerHTML = '';
    const techniques = entry.techniques ?? [];
    for (let i = 0; i < techniques.length; i++) {
        const li = document.createElement('li');
        li.textContent = techniques[i];
        infoTechniquesEl.appendChild(li);
    }

    const link = document.createElement('a');
    link.className = 'source-link';
    link.href = `https://github.com/yortus/mvt-games/tree/main/packages/website/src/demos/${entry.id}`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'View Source';
    infoSourceEl.replaceChildren(link);

    modalEl.classList.add('active');
}

function dismissInfo(): void {
    modalEl.classList.remove('active');
}

infoCloseEl.addEventListener('click', dismissInfo);

modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) dismissInfo();
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalEl.classList.contains('active')) {
        e.preventDefault();
        dismissInfo();
    }
});

// ---------------------------------------------------------------------------
// Auto-launch from URL fragment, or show gallery
// ---------------------------------------------------------------------------

const initialHash = location.hash.slice(1);
const autoLaunchIndex = initialHash
    ? demos.findIndex((d) => d.id === initialHash)
    : -1;

if (autoLaunchIndex >= 0) {
    launchDemo(autoLaunchIndex);
}
else {
    if (initialHash) setUrlFragment(undefined);
    ensureThumbnails();
}

/** Loads a demo, which this gallery can run only if it is drawn with Pixi. */
async function loadPixiStarter(entry: ArcadeEntry): Promise<PixiEntryStarter> {
    const starter = await entry.load();
    if (starter.kind !== 'pixi') throw new Error(`${entry.id} is not drawn with Pixi`);
    return starter;
}

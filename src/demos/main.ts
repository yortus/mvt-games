import { Application, Container, RenderTexture } from 'pixi.js';
import type { DemoEntry, DemoSession } from './demo-entry';
import { createBoidsEntry } from './boids';
import { createTsxPixiEntry } from './tsx-pixi';

// ---------------------------------------------------------------------------
// Demo registry
// ---------------------------------------------------------------------------

const demos: DemoEntry[] = [
    createBoidsEntry(),
    createTsxPixiEntry(),
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
let activeSession: DemoSession | undefined;
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
            await entry.load?.();

            const tempStage = new Container();
            const session = entry.start(tempStage);

            const totalMs = entry.thumbnailAdvanceMs ?? TICK_MS;
            let remaining = totalMs;
            while (remaining > 0) {
                const step = remaining < TICK_MS ? remaining : TICK_MS;
                session.update(step);
                remaining -= step;
            }

            const renderTexture = RenderTexture.create({
                width: entry.screenWidth,
                height: entry.screenHeight,
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

function setUrlFragment(demoId: string | null): void {
    const url = demoId ? '#' + demoId : location.pathname + location.search;
    history.replaceState(null, '', url);
}

async function launchDemo(index: number): Promise<void> {
    const entry = demos[index];

    setUrlFragment(entry.id);
    galleryEl.style.display = 'none';
    runnerEl.classList.add('active');

    const app = new Application();
    await app.init({
        width: entry.screenWidth,
        height: entry.screenHeight,
        background: 0x1a1a2e,
        antialias: true,
    });
    app.canvas.style.touchAction = 'none';
    runnerEl.appendChild(app.canvas);

    // Back button
    const backBtn = document.createElement('button');
    backBtn.className = 'back-button';
    backBtn.innerHTML = '&#x2190;';
    backBtn.setAttribute('aria-label', 'Back to gallery');
    backBtn.addEventListener('click', exitDemo);
    runnerEl.appendChild(backBtn);

    await entry.load?.();
    const session = entry.start(app.stage);

    app.ticker.add((ticker) => {
        session.update(ticker.deltaMS);
    });

    activeApp = app;
    activeSession = session;

    // Resize handling - debounced so continuous dragging doesn't thrash
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    resizeHandler = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const w = entry.screenWidth;
            const h = entry.screenHeight;
            app.renderer.resize(w, h);
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
    setUrlFragment(null);
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
    for (let i = 0; i < entry.techniques.length; i++) {
        const li = document.createElement('li');
        li.textContent = entry.techniques[i];
        infoTechniquesEl.appendChild(li);
    }

    infoSourceEl.innerHTML = '';
    if (entry.sourceUrl) {
        const link = document.createElement('a');
        link.className = 'source-link';
        link.href = entry.sourceUrl;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'View Source';
        infoSourceEl.appendChild(link);
    }

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
    if (initialHash) setUrlFragment(null);
    ensureThumbnails();
}

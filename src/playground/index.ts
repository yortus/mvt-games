// ---------------------------------------------------------------------------
// MVT Playground - Main bootstrap
// ---------------------------------------------------------------------------
// Wires together: editor panel, controls panel, console panel, sandbox host,
// preset selector, URL state, and keyboard shortcuts.
// ---------------------------------------------------------------------------

import { createEditorPanel } from './editor-panel';
import { createControlsPanel } from './controls-panel';
import { createConsolePanel } from './console-panel';
import { createSandboxHost, type SandboxMessage } from './sandbox';
import { presets, getPresetById, type Preset } from './presets';
import { readState, pushState } from './url-state';

// ---------------------------------------------------------------------------
// New project template
// ---------------------------------------------------------------------------

const NEW_PROJECT_MODEL = `// Model - owns state and logic
// Advance state in update(deltaMs).

function createModel(): any {
    return {
        update(deltaMs: number) {
        },
    };
}
`;

const NEW_PROJECT_VIEW = `// View - stateless renderer
// Read state from model, write to scene graph.

function createView(model: any): any {
    const view = new Container();

    return {
        view,
        refresh() {
        },
    };
}
`;

const CUSTOM_STORAGE_KEY = 'mvt-playground-custom';

// ---------------------------------------------------------------------------
// Build DOM structure
// ---------------------------------------------------------------------------

function buildLayout(root: HTMLElement): {
    header: HTMLElement;
    presetSelect: HTMLSelectElement;
    shareBtn: HTMLButtonElement;
    editorContainer: HTMLElement;
    controlsContainer: HTMLElement;
    canvasContainer: HTMLElement;
    canvasPlaceholder: HTMLElement;
    consoleContainer: HTMLElement;
    footer: HTMLElement;
    modelTab: HTMLButtonElement;
    viewTab: HTMLButtonElement;
    canvasTab: HTMLButtonElement;
    setActivePanel: (panel: 'model' | 'view' | 'canvas') => void;
} {
    root.className = 'pg-root';

    // Header
    const header = document.createElement('div');
    header.className = 'pg-header';

    const title = document.createElement('div');
    title.className = 'pg-header-title';
    title.innerHTML = 'MVT Playground';
    header.appendChild(title);

    // Preset selector
    const presetSelect = document.createElement('select');
    presetSelect.className = 'pg-preset-select';

    const customOpt = document.createElement('option');
    customOpt.value = '__custom__';
    customOpt.textContent = 'Custom Project';
    presetSelect.appendChild(customOpt);

    const sep = document.createElement('option');
    sep.disabled = true;
    sep.textContent = '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500';
    presetSelect.appendChild(sep);

    for (let i = 0; i < presets.length; i++) {
        const opt = document.createElement('option');
        opt.value = presets[i].id;
        opt.textContent = presets[i].name;
        opt.title = presets[i].description;
        presetSelect.appendChild(opt);
    }
    header.appendChild(presetSelect);

    const spacer = document.createElement('div');
    spacer.className = 'pg-header-spacer';
    header.appendChild(spacer);

    // Share button
    const shareBtn = document.createElement('button');
    shareBtn.className = 'pg-btn';
    shareBtn.textContent = 'Share';
    shareBtn.title = 'Copy playground URL to clipboard';
    header.appendChild(shareBtn);

    root.appendChild(header);

    // Panel toggle tabs (visible on narrow screens via CSS)
    // Replaces the editor's own Model/View tabs in portrait layout
    const panelTabs = document.createElement('div');
    panelTabs.className = 'pg-panel-tabs';

    const modelTab = document.createElement('button');
    modelTab.className = 'pg-panel-tab active';
    modelTab.textContent = 'Model';
    panelTabs.appendChild(modelTab);

    const viewTab = document.createElement('button');
    viewTab.className = 'pg-panel-tab';
    viewTab.textContent = 'View';
    panelTabs.appendChild(viewTab);

    const canvasTab = document.createElement('button');
    canvasTab.className = 'pg-panel-tab';
    canvasTab.textContent = 'Canvas';
    panelTabs.appendChild(canvasTab);

    function setActivePanel(panel: 'model' | 'view' | 'canvas'): void {
        modelTab.classList.toggle('active', panel === 'model');
        viewTab.classList.toggle('active', panel === 'view');
        canvasTab.classList.toggle('active', panel === 'canvas');
        if (panel === 'model' || panel === 'view') {
            editorContainer.classList.remove('pg-panel-hidden');
            rightPanel.classList.add('pg-panel-hidden');
        }
        else {
            rightPanel.classList.remove('pg-panel-hidden');
            editorContainer.classList.add('pg-panel-hidden');
        }
    }

    root.appendChild(panelTabs);

    // Left column: editor
    const editorContainer = document.createElement('div');
    editorContainer.className = 'pg-editor-panel';
    root.appendChild(editorContainer);

    // Right column: controls + canvas + console
    const rightPanel = document.createElement('div');
    rightPanel.className = 'pg-right-panel';

    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'pg-controls';
    rightPanel.appendChild(controlsContainer);

    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'pg-canvas-area';
    const placeholder = document.createElement('div');
    placeholder.className = 'pg-canvas-placeholder';
    placeholder.textContent = 'Click "Run" or press Ctrl+Enter to execute';
    canvasContainer.appendChild(placeholder);
    rightPanel.appendChild(canvasContainer);

    const consoleContainer = document.createElement('div');
    consoleContainer.className = 'pg-console';
    rightPanel.appendChild(consoleContainer);

    root.appendChild(rightPanel);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'pg-footer';
    footer.innerHTML = '<span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> Run</span>'
        + '<span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Enter</kbd> Reset</span>';
    root.appendChild(footer);

    return { header, presetSelect, shareBtn, editorContainer, controlsContainer, canvasContainer, canvasPlaceholder: placeholder, consoleContainer, footer, modelTab, viewTab, canvasTab, setActivePanel };
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

function main(): void {
    const root = document.getElementById('playground-root');
    if (!root) throw new Error('Missing #playground-root element');

    const layout = buildLayout(root);

    // Create components
    const editor = createEditorPanel();
    const controls = createControlsPanel();
    const consolePanel = createConsolePanel();
    const sandbox = createSandboxHost();

    // Mount components
    editor.mount(layout.editorContainer);
    controls.mount(layout.controlsContainer);
    consolePanel.mount(layout.consoleContainer);
    sandbox.mount(layout.canvasContainer);

    // ---- Panel tab wiring (narrow-screen Model/View/Canvas toggle) ---------

    layout.modelTab.addEventListener('click', () => {
        layout.setActivePanel('model');
        editor.setActiveTab('model');
    });
    layout.viewTab.addEventListener('click', () => {
        layout.setActivePanel('view');
        editor.setActiveTab('view');
    });
    layout.canvasTab.addEventListener('click', () => {
        layout.setActivePanel('canvas');
    });

    // Set initial state for narrow screens
    if (window.matchMedia('(max-width: 768px)').matches) {
        layout.setActivePanel('model');
    }

    // ---- Custom code persistence -------------------------------------------

    let isCustom = false;

    function saveCustomCode(): void {
        const data = JSON.stringify({
            m: editor.getModelCode(),
            v: editor.getViewCode(),
            w: controls.getCanvasWidth(),
            h: controls.getCanvasHeight(),
        });
        localStorage.setItem(CUSTOM_STORAGE_KEY, data);
    }

    function loadCustomCode(): boolean {
        const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
        if (!raw) return false;
        try {
            const data = JSON.parse(raw) as { m?: string; v?: string; w?: number; h?: number };
            if (data.m) editor.setModelCode(data.m);
            if (data.v) editor.setViewCode(data.v);
            if (data.w) controls.setCanvasWidth(data.w);
            if (data.h) controls.setCanvasHeight(data.h);
            return true;
        }
        catch {
            return false;
        }
    }

    // ---- Sandbox message handling ------------------------------------------

    // Track whether we should auto-run once the sandbox is ready
    let pendingAutoRun = false;

    sandbox.onMessage((msg: SandboxMessage) => {
        switch (msg.kind) {
            case 'running':
                controls.setRunning(true);
                controls.setPaused(false);
                layout.canvasPlaceholder.style.display = 'none';
                consolePanel.log('log', 'Session started');
                break;

            case 'stopped':
                controls.setRunning(false);
                controls.setPaused(false);
                layout.canvasPlaceholder.style.display = '';
                consolePanel.log('log', 'Session stopped');
                break;

            case 'error':
                consolePanel.log('error', msg.message, msg.source);
                break;

            case 'console':
                consolePanel.log(msg.level, msg.args.join(' '));
                break;

            case 'ready':
                if (pendingAutoRun) {
                    pendingAutoRun = false;
                    doRun();
                }
                break;

            case 'pong':
                // Watchdog response - handled internally by sandbox host
                break;
        }
    });

    // ---- Control actions ---------------------------------------------------

    function doRun(): void {
        if (isCustom) saveCustomCode();
        consolePanel.clear();
        const modelCode = editor.getModelCode();
        const viewCode = editor.getViewCode();
        const w = controls.getCanvasWidth();
        const h = controls.getCanvasHeight();
        sandbox.run(modelCode, viewCode, w, h);
        sandbox.focus();
    }

    function doReset(): void {
        consolePanel.clear();
        const modelCode = editor.getModelCode();
        const viewCode = editor.getViewCode();
        const w = controls.getCanvasWidth();
        const h = controls.getCanvasHeight();
        sandbox.reset(modelCode, viewCode, w, h);
    }

    controls.onAction((action) => {
        switch (action.kind) {
            case 'run':
                doRun();
                break;
            case 'stop':
                sandbox.stop();
                break;
            case 'pause':
                controls.setPaused(true);
                sandbox.pause();
                break;
            case 'resume':
                controls.setPaused(false);
                sandbox.resume();
                break;
            case 'step':
                sandbox.step(16.67);
                break;
            case 'reset':
                doReset();
                break;
            case 'speed':
                sandbox.setSpeed(action.speed);
                break;
        }
    });

    // ---- Preset loading ----------------------------------------------------

    function loadPreset(preset: Preset): void {
        editor.setModelCode(preset.modelCode);
        editor.setViewCode(preset.viewCode);
        editor.setActiveTab('model');
        layout.setActivePanel('model');
        if (preset.canvasWidth) controls.setCanvasWidth(preset.canvasWidth);
        if (preset.canvasHeight) controls.setCanvasHeight(preset.canvasHeight);
        layout.presetSelect.value = preset.id;
        consolePanel.clear();
        consolePanel.log('log', `Loaded preset: ${preset.name}`);
    }

    layout.presetSelect.addEventListener('change', () => {
        const id = layout.presetSelect.value;
        if (!id) return;

        if (id === '__custom__') {
            sandbox.stop();
            consolePanel.clear();
            if (!loadCustomCode()) {
                editor.setModelCode(NEW_PROJECT_MODEL);
                editor.setViewCode(NEW_PROJECT_VIEW);
                controls.setCanvasWidth(400);
                controls.setCanvasHeight(400);
            }
            editor.setActiveTab('model');
            layout.setActivePanel('model');
            isCustom = true;
            pushState({});
            return;
        }

        // Switching to a preset - save custom code if leaving custom mode
        if (isCustom) {
            saveCustomCode();
            isCustom = false;
        }

        const preset = getPresetById(id);
        if (preset) {
            loadPreset(preset);
            pushState({ presetId: id });
            doRun();
        }
    });

    // ---- Share button -------------------------------------------------------

    layout.shareBtn.addEventListener('click', () => {
        pushState({
            modelCode: editor.getModelCode(),
            viewCode: editor.getViewCode(),
            canvasWidth: controls.getCanvasWidth(),
            canvasHeight: controls.getCanvasHeight(),
        });
        navigator.clipboard.writeText(window.location.href).then(() => {
            layout.shareBtn.textContent = 'Copied!';
            setTimeout(() => {
                layout.shareBtn.textContent = 'Share';
            }, 2000);
        }).catch(() => {
            // Fallback: select the URL
            consolePanel.log('warn', 'Could not copy to clipboard. Copy the URL manually.');
        });
    });

    // ---- Keyboard shortcuts ------------------------------------------------

    document.addEventListener('keydown', (e) => {
        // Ctrl+Enter = Run
        if (e.ctrlKey && !e.shiftKey && e.key === 'Enter') {
            e.preventDefault();
            doRun();
        }
        // Ctrl+Shift+Enter = Reset
        if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
            e.preventDefault();
            doReset();
        }
    });

    // ---- Persist custom code on unload -------------------------------------

    window.addEventListener('beforeunload', () => {
        if (isCustom) saveCustomCode();
    });

    // ---- Restore state from URL --------------------------------------------

    const initialState = readState();
    if (initialState.presetId) {
        const preset = getPresetById(initialState.presetId);
        if (preset) {
            loadPreset(preset);
            pendingAutoRun = true;
        }
    }
    else if (initialState.modelCode || initialState.viewCode) {
        // Shared custom code - load into editor but do NOT auto-run.
        // Auto-running untrusted code from a shared URL would be a security
        // risk because the sandbox iframe shares the page origin.
        if (initialState.modelCode) editor.setModelCode(initialState.modelCode);
        if (initialState.viewCode) editor.setViewCode(initialState.viewCode);
        if (initialState.canvasWidth) controls.setCanvasWidth(initialState.canvasWidth);
        if (initialState.canvasHeight) controls.setCanvasHeight(initialState.canvasHeight);
        layout.presetSelect.value = '__custom__';
        isCustom = true;
        saveCustomCode();
    }
    else if (loadCustomCode()) {
        // Restored saved custom code from localStorage
        layout.presetSelect.value = '__custom__';
        isCustom = true;
    }
    else {
        // Default: load the first preset
        const defaultPreset = presets[0];
        if (defaultPreset) {
            loadPreset(defaultPreset);
            pendingAutoRun = true;
        }
    }
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

main();

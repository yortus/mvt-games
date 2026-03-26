// ---------------------------------------------------------------------------
// Controls panel - Run/Pause/Step/Reset/Speed controls
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ControlsPanel {
    /** Mount into a container element. */
    mount(container: HTMLElement): void;

    /** Register event handlers for control actions. */
    onAction(handler: (action: ControlAction) => void): void;

    /** Update the displayed running state. */
    setRunning(running: boolean): void;

    /** Update the displayed paused state. */
    setPaused(paused: boolean): void;

    /** Get the current speed multiplier. */
    getSpeed(): number;

    /** Get the current canvas width. */
    getCanvasWidth(): number;

    /** Get the current canvas height. */
    getCanvasHeight(): number;

    /** Set the canvas width and update the input. */
    setCanvasWidth(w: number): void;

    /** Set the canvas height and update the input. */
    setCanvasHeight(h: number): void;

    /** Destroy and clean up. */
    destroy(): void;
}

export type ControlAction =
    | { kind: 'run' }
    | { kind: 'stop' }
    | { kind: 'pause' }
    | { kind: 'resume' }
    | { kind: 'step' }
    | { kind: 'reset' }
    | { kind: 'speed'; speed: number };

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createControlsPanel(): ControlsPanel {
    let containerEl: HTMLElement | undefined;
    const actionHandlers: Set<(action: ControlAction) => void> = new Set();
    let running = false;
    let paused = false;
    let speed = 1;
    let canvasWidth = 400;
    let canvasHeight = 300;

    // DOM elements
    let runBtn: HTMLButtonElement | undefined;
    let pauseBtn: HTMLButtonElement | undefined;
    let stepBtn: HTMLButtonElement | undefined;
    let resetBtn: HTMLButtonElement | undefined;
    let speedSlider: HTMLInputElement | undefined;
    let speedLabel: HTMLSpanElement | undefined;
    let sizeDisplay: HTMLSpanElement | undefined;

    function emit(action: ControlAction): void {
        for (const handler of actionHandlers) {
            handler(action);
        }
    }

    function setBtnHtml(btn: HTMLButtonElement, icon: string, label: string): void {
        btn.innerHTML = icon + ' <span class="pg-btn-label">' + label + '</span>';
    }

    function updateButtons(): void {
        if (!runBtn || !pauseBtn || !stepBtn || !resetBtn) return;

        if (running) {
            setBtnHtml(runBtn, '\u25B6', 'Run');
            runBtn.disabled = false;
            pauseBtn.disabled = false;
            if (paused) {
                setBtnHtml(pauseBtn, '\u25B6', 'Resume');
            }
            else {
                setBtnHtml(pauseBtn, '\u23F8', 'Pause');
            }
            stepBtn.disabled = !paused;
            resetBtn.disabled = false;
        }
        else {
            setBtnHtml(runBtn, '\u25B6', 'Run');
            runBtn.disabled = false;
            pauseBtn.disabled = true;
            setBtnHtml(pauseBtn, '\u23F8', 'Pause');
            stepBtn.disabled = true;
            resetBtn.disabled = true;
        }
    }

    function buildDOM(container: HTMLElement): void {
        const toolbar = document.createElement('div');
        toolbar.className = 'pg-controls-toolbar';

        // Run button
        runBtn = document.createElement('button');
        runBtn.className = 'pg-btn pg-btn-primary';
        setBtnHtml(runBtn, '\u25B6', 'Run');
        runBtn.title = 'Run (Ctrl+Enter)';
        runBtn.addEventListener('click', () => emit({ kind: 'run' }));
        toolbar.appendChild(runBtn);

        // Pause/Resume button
        pauseBtn = document.createElement('button');
        pauseBtn.className = 'pg-btn';
        setBtnHtml(pauseBtn, '\u23F8', 'Pause');
        pauseBtn.disabled = true;
        pauseBtn.addEventListener('click', () => {
            if (paused) {
                emit({ kind: 'resume' });
            }
            else {
                emit({ kind: 'pause' });
            }
        });
        toolbar.appendChild(pauseBtn);

        // Step button
        stepBtn = document.createElement('button');
        stepBtn.className = 'pg-btn';
        setBtnHtml(stepBtn, '\u23ED', 'Step');
        stepBtn.title = 'Advance one frame (16.67ms)';
        stepBtn.disabled = true;
        stepBtn.addEventListener('click', () => emit({ kind: 'step' }));
        toolbar.appendChild(stepBtn);

        // Reset button
        resetBtn = document.createElement('button');
        resetBtn.className = 'pg-btn';
        setBtnHtml(resetBtn, '\u21BB', 'Reset');
        resetBtn.title = 'Destroy and re-run';
        resetBtn.disabled = true;
        resetBtn.addEventListener('click', () => emit({ kind: 'reset' }));
        toolbar.appendChild(resetBtn);

        // Speed slider (inline)
        const speedTitle = document.createElement('span');
        speedTitle.className = 'pg-controls-label pg-controls-sep';
        speedTitle.textContent = 'Speed:';
        toolbar.appendChild(speedTitle);

        speedSlider = document.createElement('input');
        speedSlider.type = 'range';
        speedSlider.className = 'pg-speed-slider';
        speedSlider.min = '0.1';
        speedSlider.max = '5';
        speedSlider.step = '0.1';
        speedSlider.value = '1';
        speedSlider.addEventListener('input', () => {
            speed = Number(speedSlider!.value);
            if (speedLabel) speedLabel.textContent = `${speed.toFixed(1)}x`;
            emit({ kind: 'speed', speed });
        });
        toolbar.appendChild(speedSlider);

        speedLabel = document.createElement('span');
        speedLabel.className = 'pg-speed-label';
        speedLabel.textContent = '1.0x';
        toolbar.appendChild(speedLabel);

        // Canvas size display (read-only, inline)
        const sizeTitle = document.createElement('span');
        sizeTitle.className = 'pg-controls-label pg-controls-sep';
        sizeTitle.textContent = 'Canvas:';
        toolbar.appendChild(sizeTitle);

        sizeDisplay = document.createElement('span');
        sizeDisplay.className = 'pg-controls-label';
        sizeDisplay.textContent = `${canvasWidth}\u00D7${canvasHeight}`;
        toolbar.appendChild(sizeDisplay);

        container.appendChild(toolbar);
    }

    const panel: ControlsPanel = {
        mount(container) {
            containerEl = container;
            buildDOM(container);
            updateButtons();
        },

        onAction(handler) {
            actionHandlers.add(handler);
        },

        setRunning(r) {
            running = r;
            updateButtons();
        },

        setPaused(p) {
            paused = p;
            updateButtons();
        },

        getSpeed() {
            return speed;
        },

        getCanvasWidth() {
            return canvasWidth;
        },

        getCanvasHeight() {
            return canvasHeight;
        },

        setCanvasWidth(w) {
            canvasWidth = Math.max(100, Math.min(1920, w));
            if (sizeDisplay) sizeDisplay.textContent = `${canvasWidth}\u00D7${canvasHeight}`;
        },

        setCanvasHeight(h) {
            canvasHeight = Math.max(100, Math.min(1080, h));
            if (sizeDisplay) sizeDisplay.textContent = `${canvasWidth}\u00D7${canvasHeight}`;
        },

        destroy() {
            actionHandlers.clear();
            if (containerEl) containerEl.innerHTML = '';
            containerEl = undefined;
        },
    };

    return panel;
}

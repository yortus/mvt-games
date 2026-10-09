import { Application, Container, TextureSource } from 'pixi.js';
import { refreshView, setRefresh, setUpdate, SKIP_DESCENDANTS, updateView } from '@mvtjs/pixi';
import type { Audio80, AudioControls } from '@mvtjs/audio';
import { KeyboardInputView, TouchInputView } from '#shared';
import type { EntryInputConfig, EntrySession, PixiEntryStarter } from '../entry-types';
import { fitPlayArea, type PlayArea } from './play-area';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The entry host's Pixi side. It is one Pixi application, whose stage holds
 * the entry's container, the on-screen touch controls and the keyboard input.
 * The host loads this module, and Pixi with it, the first time it prepares a
 * Pixi entry.
 */
export interface PixiStage {
    /** Whether it draws pixel art, which is fixed when its renderer is made. */
    readonly isPixelArt: boolean;
    /** Starts a session on the stage, and shows the canvas. */
    start: (starter: PixiEntryStarter) => EntrySession;
    /** Hides the canvas, once the session has ended. */
    hide: () => void;
    /** Runs one frame. It steps the application's ticker, which updates, refreshes and renders the stage. */
    tick: (timeMs: number) => void;
    /** Fits the canvas to an area of this size, in CSS pixels. */
    fit: (areaWidth: number, areaHeight: number) => void;
    /** Draws the play area of the frame now showing into a new canvas. */
    captureFrame: () => HTMLCanvasElement | undefined;
    /** Destroys the application, with its canvas and everything on its stage. */
    destroy: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make the entry host's Pixi stage. */
export interface PixiStageOptions {
    /** The element to add the canvas to. */
    readonly element: HTMLElement;
    /** Whether to draw pixel art. */
    readonly isPixelArt: boolean;
    /** Whether to draw touch controls for entries that take input. */
    readonly isTouch: boolean;
    /** Whether the entry takes input at all, from the keyboard or touch controls. */
    readonly takesInput: boolean;
    /** The session running, which the host owns. */
    readonly session: () => EntrySession | undefined;
    /** Whether the session is paused. */
    readonly isPaused: () => boolean;
    /** The host's Audio80, given to each session. */
    readonly audio80: Audio80;
    /** The Audio80's controls. The stage advances the chip's clock with the session's models, and sends its writes after each refresh. */
    readonly audioControls: AudioControls;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the entry host's Pixi stage, and adds its canvas to `options.element`. */
export async function createPixiStage(options: PixiStageOptions): Promise<PixiStage> {
    const { element, isPixelArt, isTouch, takesInput, audio80, audioControls } = options;

    const app = new Application();
    await app.init({
        width: 1,
        height: 1,
        background: 0x000000,
        antialias: !isPixelArt,
        roundPixels: isPixelArt,
        // It is not started, because the host's loop steps it once a frame
        autoStart: false,
        sharedTicker: false,
    });
    // A long gap, as after a hidden tab, is clamped rather than simulated
    app.ticker.minFPS = 1000 / MAX_STEP_MS;

    const canvas = app.canvas;
    canvas.className = 'entry-host-canvas';
    canvas.hidden = true;
    // Pinch-zoom, scrolling and double-tap zoom are blocked over the game
    canvas.style.touchAction = 'none';
    canvas.addEventListener('touchend', preventDoubleTapZoom, { passive: false });
    element.append(canvas);

    let starter: PixiEntryStarter | undefined;
    let area: PlayArea = { scale: 1, stageWidth: 1, stageHeight: 1, offsetX: 0, offsetY: 0 };
    let areaWidth = 0;
    let areaHeight = 0;

    // The entry's container sits out `updateView` while paused, and is still
    // refreshed, so it shows frozen. No entry knows about pause.
    const entryContainer = new Container();
    entryContainer.label = 'entry';
    setUpdate(entryContainer, () => (options.isPaused() ? SKIP_DESCENDANTS : undefined));
    app.stage.addChild(entryContainer);

    if (takesInput && isTouch) {
        const touchLayer = new Container();
        touchLayer.label = 'touch-controls';
        setRefresh(touchLayer, () => {
            touchLayer.visible = inputConfig() !== undefined && !options.isPaused();
            return touchLayer.visible ? undefined : SKIP_DESCENDANTS;
        });
        touchLayer.addChild(TouchInputView({
            canvasWidth: () => area.stageWidth,
            canvasHeight: () => area.stageHeight,
            gameX: () => area.offsetX,
            gameY: () => area.offsetY,
            gameWidth: () => starter?.screenWidth ?? 0,
            gameHeight: () => starter?.screenHeight ?? 0,
            scale: () => area.scale,
            hasDpad: () => (inputConfig()?.showDpad ?? true),
            hasPrimaryButton: () => inputConfig()?.showPrimary ?? false,
            hasSecondaryButton: () => inputConfig()?.showSecondary ?? false,
            primaryLabel: () => inputConfig()?.primaryLabel ?? 'A',
            secondaryLabel: () => inputConfig()?.secondaryLabel ?? 'B',
            isJoystickFloating: () => inputConfig()?.floatingJoystick ?? false,
            onXDirectionChanged: (dir) => inputConfig()?.onXDirectionChanged?.(dir),
            onYDirectionChanged: (dir) => inputConfig()?.onYDirectionChanged?.(dir),
            onPrimaryButtonChanged: (pressed) => inputConfig()?.onPrimaryButtonChanged?.(pressed),
            onSecondaryButtonChanged: (pressed) => inputConfig()?.onSecondaryButtonChanged?.(pressed),
        }));
        app.stage.addChild(touchLayer);
    }

    if (takesInput) {
        app.stage.addChild(KeyboardInputView({
            // The stage outlives each entry, so only handle key events while an entry that takes input is running
            isActive: () => inputConfig() !== undefined,
            onXDirectionChanged: (dir) => inputConfig()?.onXDirectionChanged?.(dir),
            onYDirectionChanged: (dir) => inputConfig()?.onYDirectionChanged?.(dir),
            onPrimaryButtonChanged: (pressed) => inputConfig()?.onPrimaryButtonChanged?.(pressed),
            onSecondaryButtonChanged: (pressed) => inputConfig()?.onSecondaryButtonChanged?.(pressed),
            onRestartButtonChanged: (pressed) => inputConfig()?.onRestartButtonChanged?.(pressed),
        }));
    }

    // Each step of the ticker runs the MVT order for the stage. First the
    // entry's models advance, and the Audio80's clock with them. Then the
    // stage's views update and refresh. Then the chip's writes are sent. The
    // application renders after this, from its own, later listener.
    app.ticker.add(() => {
        const deltaMs = app.ticker.deltaMS;
        const session = options.session();
        if (session !== undefined && !options.isPaused()) {
            session.update(deltaMs);
            audioControls.update(deltaMs);
        }
        updateView(app.stage, deltaMs);
        refreshView(app.stage);
        audioControls.flush();
    });

    const stage: PixiStage = {
        isPixelArt,

        start(next) {
            starter = next;
            // This applies to the textures the entry makes as it starts, such as text
            TextureSource.defaultOptions.scaleMode = isPixelArt ? 'nearest' : 'linear';
            const session = next.start({
                stage: entryContainer,
                host: { renderer: app.renderer, ticker: app.ticker },
                sound: audio80,
            });
            canvas.hidden = false;
            // The session's controls are known now, and they can change the fit
            fitTo(areaWidth, areaHeight, session.inputConfig);
            return session;
        },

        hide() {
            starter = undefined;
            canvas.hidden = true;
        },

        tick(timeMs) {
            app.ticker.update(timeMs);
        },

        fit(width, height) {
            fitTo(width, height, inputConfig());
        },

        captureFrame() {
            if (starter === undefined) return undefined;
            app.render();
            const resolution = app.renderer.resolution;
            const width = Math.round(starter.screenWidth * resolution);
            const height = Math.round(starter.screenHeight * resolution);
            if (width <= 0 || height <= 0) return undefined;
            const frame = document.createElement('canvas');
            frame.width = width;
            frame.height = height;
            const context = frame.getContext('2d');
            if (context === null) return undefined;
            context.drawImage(canvas, area.offsetX * resolution, area.offsetY * resolution, width, height, 0, 0, width, height);
            return frame;
        },

        destroy() {
            canvas.removeEventListener('touchend', preventDoubleTapZoom);
            app.destroy(true, { children: true });
        },
    };

    return stage;

    function inputConfig(): EntryInputConfig | undefined {
        return starter === undefined ? undefined : options.session()?.inputConfig;
    }

    function fitTo(width: number, height: number, config: EntryInputConfig | undefined): void {
        areaWidth = width;
        areaHeight = height;
        if (starter === undefined || width <= 0 || height <= 0) return;
        area = fitPlayArea({
            areaWidth: width,
            areaHeight: height,
            screenWidth: starter.screenWidth,
            screenHeight: starter.screenHeight,
            integerScale: starter.integerScale,
            hasTouchControls: takesInput && isTouch && config !== undefined,
        });
        const dpr = window.devicePixelRatio || 1;
        app.renderer.resize(area.stageWidth, area.stageHeight, area.scale * dpr);
        canvas.style.width = `${Math.floor(area.stageWidth * area.scale)}px`;
        canvas.style.height = `${Math.floor(area.stageHeight * area.scale)}px`;
        entryContainer.position.set(area.offsetX, area.offsetY);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The longest step a frame advances by. */
const MAX_STEP_MS = 50;

/** The longest gap between taps that a browser treats as a double tap. */
const DOUBLE_TAP_MS = 300;

let lastTouchEndMs = -Infinity;

/** Some browsers ignore `touch-action` for a double tap, so it is blocked here too. */
function preventDoubleTapZoom(e: TouchEvent): void {
    if (e.timeStamp - lastTouchEndMs <= DOUBLE_TAP_MS) e.preventDefault();
    lastTouchEndMs = e.timeStamp;
}

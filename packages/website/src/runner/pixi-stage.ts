import { Application, Container, TextureSource } from 'pixi.js';
import { refreshView, setRefresh, setUpdate, SKIP_DESCENDANTS, updateView } from '@mvtjs/pixi';
import { KeyboardInputView, TouchInputView } from '#shared';
import type { EntryInputConfig, EntrySession, PixiEntryStarter } from '../entries';
import { fitPlayArea, type PlayArea } from './play-area';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The entry host's Pixi side: one application, with the entry's container,
 * on-screen touch controls and keyboard input on its stage. Loaded with Pixi,
 * the first time a Pixi entry is prepared.
 */
export interface PixiStage {
    /** Whether it draws pixel art, which is fixed when its renderer is made. */
    readonly isPixelArt: boolean;
    /** Starts a session on the stage, and shows the canvas. */
    start: (starter: PixiEntryStarter) => EntrySession;
    /** Hides the canvas, once the session has ended. */
    hide: () => void;
    /** One frame: steps the application's ticker, which updates, refreshes and renders the stage. */
    tick: (timeMs: number) => void;
    /** Fits the canvas to an area of this size, in CSS pixels. */
    fit: (areaWidth: number, areaHeight: number) => void;
    /** Draws the play area of the frame now showing into a new canvas. */
    captureFrame: () => HTMLCanvasElement | undefined;
    destroy: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PixiStageOptions {
    /** The element to add the canvas to. */
    readonly element: HTMLElement;
    readonly isPixelArt: boolean;
    /** Whether to draw touch controls for entries that take input. */
    readonly isTouch: boolean;
    /** The session running, which the host owns. */
    readonly session: () => EntrySession | undefined;
    readonly isPaused: () => boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export async function createPixiStage(options: PixiStageOptions): Promise<PixiStage> {
    const { element, isPixelArt, isTouch } = options;

    const app = new Application();
    await app.init({
        width: 1,
        height: 1,
        background: 0x000000,
        antialias: !isPixelArt,
        roundPixels: isPixelArt,
        // Not started: the host's loop steps it, once a frame
        autoStart: false,
        sharedTicker: false,
    });
    // A long gap (a hidden tab) is clamped rather than simulated
    app.ticker.minFPS = 1000 / MAX_STEP_MS;

    const canvas = app.canvas;
    canvas.className = 'entry-host-canvas';
    canvas.hidden = true;
    // No pinch-zoom, scrolling or double-tap zoom over the game
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

    if (isTouch) {
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

    app.stage.addChild(KeyboardInputView({
        onXDirectionChanged: (dir) => inputConfig()?.onXDirectionChanged?.(dir),
        onYDirectionChanged: (dir) => inputConfig()?.onYDirectionChanged?.(dir),
        onPrimaryButtonChanged: (pressed) => inputConfig()?.onPrimaryButtonChanged?.(pressed),
        onSecondaryButtonChanged: (pressed) => inputConfig()?.onSecondaryButtonChanged?.(pressed),
        onRestartButtonChanged: (pressed) => inputConfig()?.onRestartButtonChanged?.(pressed),
    }));

    // Each step of the ticker runs the MVT order for the stage: the entry's
    // models, then the stage's update and refresh. The application renders
    // after, from its own, later listener.
    app.ticker.add(() => {
        const deltaMs = app.ticker.deltaMS;
        const session = options.session();
        if (session !== undefined && !options.isPaused()) session.update(deltaMs);
        updateView(app.stage, deltaMs);
        refreshView(app.stage);
    });

    const stage: PixiStage = {
        isPixelArt,

        start(next) {
            starter = next;
            // For the textures the entry makes as it starts, such as text
            TextureSource.defaultOptions.scaleMode = isPixelArt ? 'nearest' : 'linear';
            const session = next.start({ stage: entryContainer, host: { renderer: app.renderer, ticker: app.ticker } });
            canvas.hidden = false;
            // Its controls are known now, which can change the fit
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
            hasTouchControls: isTouch && config !== undefined,
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

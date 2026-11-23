import { Application, Container, Graphics, TextureSource } from 'pixi.js';
import { createGpuTimer, type GpuTimer, keepReleasedTextTextures, refreshView, setRefresh, setUpdate, SKIP_DESCENDANTS, updateView } from '@mvtjs/pixi';
import { TouchInputView } from '#input/pixi';
import type { ArcadeControls } from '../input';
import { type ArcadeControlsLayout, type ArcadeControlsUse, type EntrySession, type PixiEntryStarter, type SoundChipFinder, startPixiEntry, type StartOptions } from '../entry-types';
import { fitPlayArea, type PlayArea } from './play-area';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The entry host's Pixi side. It is one Pixi application, whose stage holds
 * the entry's container and the on-screen touch controls.
 * The host loads this module, and Pixi with it, the first time it prepares a
 * Pixi entry.
 */
export interface PixiStage {
    /** Whether it draws pixel art, which is fixed when its renderer is made. */
    readonly isPixelArt: boolean;
    /** Whether it can draw PixiJS 3D scenes, which is fixed when its renderer is made. */
    readonly draws3d: boolean;
    /**
     * Starts a session on the stage, passing `options` on to the entry, and
     * shows the canvas. A clear session (`isClear`) leaves the canvas clear
     * round the play area, so what's behind it shows there, and clips the
     * entry to its play area. Inside it, the entry's background colour still
     * fills it.
     */
    start: (starter: PixiEntryStarter, options: PixiStageStartOptions, isClear: boolean) => EntrySession;
    /** Hides the canvas, once the session has ended. */
    hide: () => void;
    /** Runs one frame. It steps the application's ticker, which updates, refreshes and renders the stage. */
    tick: (timeMs: number) => void;
    /** Fits the canvas to an area of this size, in CSS pixels. */
    fit: (areaWidth: number, areaHeight: number) => void;
    /** Draws the play area of the frame now showing into a new canvas. */
    captureFrame: () => HTMLCanvasElement | undefined;
    /**
     * Whether each render is timed on the GPU, for `takeGpuMs`. It costs a
     * little each frame, so it is off until it is asked for.
     */
    isGpuTimed: boolean;
    /**
     * Returns the median time on the GPU of the renders since the last call,
     * in milliseconds. Returns undefined if none were timed: while
     * `isGpuTimed` is off, or where the browser can't time the GPU.
     */
    takeGpuMs: () => number | undefined;
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
    /**
     * Whether the stage is made for an entry that draws 3D, after the entry's
     * `load` imported PixiJS 3D. PixiJS 3D adds itself only to the renderers
     * made after it's imported.
     */
    readonly draws3d: boolean;
    /** Whether to draw touch controls for entries that take input. */
    readonly isTouch: boolean;
    /** Whether the entry takes input at all, from the keyboard or touch controls. */
    readonly takesInput: boolean;
    /** The session running, which the host owns. */
    readonly session: () => EntrySession | undefined;
    /** The session's arcade controls, which the touch controls set. */
    readonly controls: () => ArcadeControls | undefined;
    /** Whether the session is paused. */
    readonly isPaused: () => boolean;
    /** Whether the page has turned the canvas a quarter turn clockwise, with a CSS transform on an ancestor. */
    readonly isTurned: () => boolean;
    /** Finds the chip of a kind, for a session that plays on one. */
    readonly findChip: SoundChipFinder;
}

/** How to start a session on the stage. It adds the session's arcade controls, if the host created any, to the page's start options. */
export interface PixiStageStartOptions extends StartOptions {
    readonly controls?: ArcadeControls;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the entry host's Pixi stage, and adds its canvas to `options.element`. */
export async function createPixiStage(options: PixiStageOptions): Promise<PixiStage> {
    const { element, isPixelArt, draws3d, isTouch, takesInput, findChip } = options;

    const app = new Application();
    await app.init({
        width: 1,
        height: 1,
        background: DEFAULT_BACKGROUND_COLOR,
        // A canvas made clear can be drawn opaque later, for each entry, but not the other way round
        backgroundAlpha: 0,
        antialias: !isPixelArt,
        roundPixels: isPixelArt,
        // It is not started, because the host's loop steps it once a frame
        autoStart: false,
        sharedTicker: false,
    });
    // A long gap, as after a hidden tab, is clamped rather than simulated
    app.ticker.minFPS = 1000 / MAX_STEP_MS;
    // A view built again finds its texts' textures still there. The stage
    // outlives each entry, so each entry's are released as its session ends.
    const keptTextTextures = keepReleasedTextTextures({ renderer: app.renderer, maxPixels: KEPT_TEXT_PIXELS });

    const canvas = app.canvas;
    canvas.className = 'entry-host-canvas';
    canvas.hidden = true;
    // Pinch-zoom, scrolling and double-tap zoom are blocked over the game
    canvas.style.touchAction = 'none';
    canvas.addEventListener('touchend', preventDoubleTapZoom, { passive: false });
    canvas.addEventListener('wheel', preventPinchZoom, { passive: false });
    element.append(canvas);
    // HTML the entry shows over its play area. Its own views are ticked by whoever puts them there,
    // so the page's walk skips them
    const overlay = document.createElement('div');
    overlay.className = 'entry-host-overlay';
    overlay.hidden = true;
    setUpdate(overlay, () => SKIP_DESCENDANTS);
    setRefresh(overlay, () => SKIP_DESCENDANTS);
    element.append(overlay);

    // Pixi finds where the pointer is on the canvas from the canvas's box in
    // the page. A canvas turned a quarter turn clockwise shows in a box that
    // is its height wide, with its own x running down the screen and its own
    // y running from the box's right edge to its left
    const events = app.renderer.events;
    const mapUpright = events.mapPositionToPoint.bind(events);
    events.mapPositionToPoint = (point, x, y) => {
        if (!options.isTurned()) {
            mapUpright(point, x, y);
            return;
        }
        const box = canvas.getBoundingClientRect();
        point.x = (y - box.top) * (canvas.width / box.height) / events.resolution;
        point.y = (box.right - x) * (canvas.height / box.width) / events.resolution;
    };

    let starter: PixiEntryStarter | undefined;
    // Whether the session running is clear round its play area
    let isClearSession = false;
    let gpuTimer: GpuTimer | undefined;
    let isGpuTimed = false;
    let area: PlayArea = { scale: 1, stageWidth: 1, stageHeight: 1, offsetX: 0, offsetY: 0 };
    let areaWidth = 0;
    let areaHeight = 0;

    // The entry's container sits out `updateView` while paused, and is still
    // refreshed, so it shows frozen. No entry knows about pause.
    const entryContainer = new Container();
    entryContainer.label = 'entry';
    // On a clear canvas, the entry's background colour fills its play area alone, behind it
    const backdrop = new Graphics();
    backdrop.label = 'backdrop';
    backdrop.visible = false;
    app.stage.addChild(backdrop);
    // On a clear canvas, the entry is clipped to its play area too. Anything it draws past its edges would
    // show over what's behind the canvas, such as the showcase that launched it. An opaque canvas covers it
    const clip = new Graphics();
    clip.label = 'clip';
    clip.visible = false;
    app.stage.addChild(clip);
    setUpdate(entryContainer, () => (options.isPaused() ? SKIP_DESCENDANTS : undefined));
    app.stage.addChild(entryContainer);

    if (takesInput && isTouch) {
        const touchLayer = new Container();
        touchLayer.label = 'touch-controls';
        setRefresh(touchLayer, () => {
            touchLayer.visible = layout() !== undefined && !options.isPaused();
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
            // An entry that lays itself out fills the area, so its controls go over it
            isOverGame: () => starter?.fitTo !== undefined,
            hasDpad: () => layout()?.showDpad ?? false,
            dpadKind: () => layout()?.dpadKind ?? 'four-way',
            hasPrimaryButton: () => layout()?.showPrimary ?? false,
            hasSecondaryButton: () => layout()?.showSecondary ?? false,
            primaryLabel: () => layout()?.primaryLabel ?? 'A',
            secondaryLabel: () => layout()?.secondaryLabel ?? 'B',
            isJoystickFloating: () => layout()?.floatingJoystick ?? false,
            onXDirectionChanged: (dir) => options.controls()?.setXDirection('touch', dir),
            onXAmountChanged: (amount) => options.controls()?.setXAmount('touch', amount),
            onYDirectionChanged: (dir) => options.controls()?.setYDirection('touch', dir),
            onPrimaryButtonChanged: (pressed) => options.controls()?.setHeld('touch', 'primary', pressed),
            onSecondaryButtonChanged: (pressed) => options.controls()?.setHeld('touch', 'secondary', pressed),
        }));
        app.stage.addChild(touchLayer);
    }

    // Each step of the ticker runs the MVT order for the stage. First the
    // entry's models advance, then the stage's views update and refresh. The
    // application renders after this, from its own, later listener.
    app.ticker.add(() => {
        const deltaMs = app.ticker.deltaMS;
        const session = options.session();
        if (session !== undefined && !options.isPaused()) session.update(deltaMs);
        updateView(app.stage, deltaMs);
        refreshView(app.stage);
    });

    const stage: PixiStage = {
        isPixelArt,
        draws3d,

        start(next, startOptions, isClear) {
            starter = next;
            isClearSession = isClear;
            // This applies to the textures the entry makes as it starts, such as text
            TextureSource.defaultOptions.scaleMode = isPixelArt ? 'nearest' : 'linear';
            // The stage outlives each entry, so each entry's colour is set as it starts
            app.renderer.background.color = next.backgroundColor ?? DEFAULT_BACKGROUND_COLOR;
            app.renderer.background.alpha = isClear ? 0 : 1;
            backdrop.visible = isClear;
            clip.visible = isClear;
            // eslint-disable-next-line @mvtjs/no-null -- Pixi takes null for no mask
            entryContainer.mask = isClear ? clip : null;
            const session = startPixiEntry(next, {
                ...startOptions,
                stage: entryContainer,
                isInPage: true,
                overlay,
            }, findChip);
            canvas.hidden = false;
            overlay.hidden = false;
            // The new entry's touch controls can change the fit
            fitTo(areaWidth, areaHeight, toLayout(next.arcadeControls));
            return session;
        },

        hide() {
            starter = undefined;
            canvas.hidden = true;
            overlay.hidden = true;
            // Whatever the entry left in the overlay goes with it
            overlay.replaceChildren();
            keptTextTextures.releaseAll();
        },

        tick(timeMs) {
            app.ticker.update(timeMs);
        },

        fit(width, height) {
            fitTo(width, height, layout());
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

        get isGpuTimed() {
            return isGpuTimed;
        },
        set isGpuTimed(value) {
            if (value === isGpuTimed) return;
            isGpuTimed = value;
            gpuTimer?.destroy();
            gpuTimer = value ? createGpuTimer({ renderer: app.renderer }) : undefined;
        },

        takeGpuMs() {
            return gpuTimer?.takeMedianMs();
        },

        destroy() {
            canvas.removeEventListener('touchend', preventDoubleTapZoom);
            canvas.removeEventListener('wheel', preventPinchZoom);
            overlay.remove();
            gpuTimer?.destroy();
            gpuTimer = undefined;
            // The page runs several renderers at once, such as an entry's and a card's live preview. Passing
            // `true` would also release Pixi's global resources, such as the shader programs that every renderer
            // shares, and break the others mid-frame. So the canvas is removed, and the shared resources stay
            app.destroy({ removeView: true, releaseGlobalResources: false }, { children: true });
        },
    };

    return stage;

    /** How the entry running lays out its touch controls, if it uses the arcade controls. */
    function layout(): ArcadeControlsLayout | undefined {
        return toLayout(starter?.arcadeControls);
    }

    function fitTo(width: number, height: number, config: ArcadeControlsLayout | undefined): void {
        areaWidth = width;
        areaHeight = height;
        if (starter === undefined || width <= 0 || height <= 0) return;
        area = fitPlayArea({
            areaWidth: width,
            areaHeight: height,
            screenWidth: starter.screenWidth,
            screenHeight: starter.screenHeight,
            integerScale: starter.integerScale,
            // An entry that lays itself out fills the area it's fitted to, with its touch controls over it,
            // so the stage doesn't keep room for them. Room kept would shrink it out of the shape it laid itself out in
            hasTouchControls: takesInput && isTouch && config !== undefined && starter.fitTo === undefined,
        });
        const dpr = window.devicePixelRatio || 1;
        app.renderer.resize(area.stageWidth, area.stageHeight, area.scale * dpr);
        canvas.style.width = `${Math.floor(area.stageWidth * area.scale)}px`;
        canvas.style.height = `${Math.floor(area.stageHeight * area.scale)}px`;
        entryContainer.position.set(area.offsetX, area.offsetY);
        // The play area's size can change as it's fitted, for an entry that lays itself out, so these follow it
        const { screenWidth, screenHeight } = starter;
        if (isClearSession) {
            backdrop.clear().rect(0, 0, screenWidth, screenHeight).fill(starter.backgroundColor ?? DEFAULT_BACKGROUND_COLOR);
            clip.clear().rect(0, 0, screenWidth, screenHeight).fill(0xffffff);
        }
        backdrop.position.set(area.offsetX, area.offsetY);
        clip.position.set(area.offsetX, area.offsetY);
        overlay.style.width = `${screenWidth}px`;
        overlay.style.height = `${screenHeight}px`;
        overlay.style.left = `${area.offsetX * area.scale}px`;
        overlay.style.top = `${area.offsetY * area.scale}px`;
        overlay.style.transform = `scale(${area.scale})`;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Returns the touch layout for an entry's use of the arcade controls. The keys only means no touch controls. */
function toLayout(use: ArcadeControlsUse | undefined): ArcadeControlsLayout | undefined {
    return use === 'keys-only' ? KEYS_ONLY_LAYOUT : use;
}

/** The layout of an entry that uses the arcade controls from the keys only. It leaves out every touch control. */
const KEYS_ONLY_LAYOUT: ArcadeControlsLayout = {};

/** The colour the canvas is filled with before an entry draws, unless the entry names its own. */
const DEFAULT_BACKGROUND_COLOR = 0x000000;

/** The longest step a frame advances by. */
const MAX_STEP_MS = 50;

/**
 * The most pixels of text textures kept for views built again, which is 4 MB
 * of GPU memory. A puzzle's calendar, with 60 labels, uses under a tenth of
 * it (89,344 pixels, measured).
 */
const KEPT_TEXT_PIXELS = 1_048_576;

/** The longest gap between taps that a browser treats as a double tap. */
const DOUBLE_TAP_MS = 300;

let lastTouchEndMs = -Infinity;

/** Some browsers ignore `touch-action` for a double tap, so it is blocked here too. */
function preventDoubleTapZoom(e: TouchEvent): void {
    if (e.timeStamp - lastTouchEndMs <= DOUBLE_TAP_MS) e.preventDefault();
    lastTouchEndMs = e.timeStamp;
}

/**
 * A trackpad's pinch reaches the page as the wheel with Control held, as
 * Control and the wheel do. Either would zoom the whole page, so over the
 * game it's blocked, as a pinch on a touch screen is. An entry can still
 * zoom with it, since Pixi passes the wheel on to the stage
 * (`listenToDragZoom`). Pixi listens for the wheel in a way that can't
 * block it, so the host blocks it here, on the canvas it owns.
 */
function preventPinchZoom(e: WheelEvent): void {
    if (e.ctrlKey) e.preventDefault();
}

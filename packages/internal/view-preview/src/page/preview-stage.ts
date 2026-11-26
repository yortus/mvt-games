import { refreshView, updateView, type View } from '@mvtjs/pixi';
import { Application, Container } from 'pixi.js';
import type { CanvasViewKind, DrawnImage, HtmlViewKind } from 'v-snap';
import type { RecordedTest } from './vsnap-stand-in';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Where the preview shows a test's view, and runs it. Each frame, while
 * it's playing, it moves time on by the frame's length. While it's paused,
 * time stands still. It updates the models the pose advanced, then the view, then
 * refreshes the view and draws it, as a game loop does.
 */
export interface PreviewStage {
    /** Runs a test's pose, and shows the view it returns in place of the last. */
    readonly show: (test: RecordedTest) => Promise<void>;
    readonly isPlaying: () => boolean;
    readonly setPlaying: (isPlaying: boolean) => void;
    /** Moves time on by one frame, playing or not. */
    readonly step: () => void;
    readonly setSpeed: (speed: number) => void;
    readonly setZoom: (zoom: number | 'fit') => void;
    /** The time played since the pose returned, in milliseconds. */
    readonly elapsedMs: () => number;
    /** How many models the pose advanced, which play moves on with the view. */
    readonly modelCount: () => number;
    /** The view's size in its own pixels, and the zoom it's shown at, for the toolbar. */
    readonly describeSize: () => string;
}

export interface PreviewStageOptions {
    /** The element the views are shown in. */
    readonly viewport: HTMLElement;
    /** The site's `vsnap.config.ts`, which lists its kinds of view. */
    readonly config: { readonly views: readonly unknown[]; readonly defaultKind?: string };
    /** Called after each frame. */
    readonly onFrame: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPreviewStage(options: PreviewStageOptions): PreviewStage {
    const { viewport, config, onFrame } = options;
    const models = new Set<Model>();
    const pixiApps = new Map<boolean, Promise<Application>>();
    const state = {
        current: undefined as Mounted | undefined,
        shows: 0,
        isNoting: false,
        isPlaying: false,
        isStepping: false,
        speed: 1,
        zoom: 'fit' as number | 'fit',
        elapsedMs: 0,
        lastTime: performance.now(),
    };

    // advanceTime reports the models it advances (see the plugin), and the
    // ones a pose advances are the ones play keeps running.
    (globalThis as { __viewPreview?: unknown }).__viewPreview = {
        noteAdvanced: (advanced: readonly Model[]) => {
            if (!state.isNoting) return;
            for (let i = 0; i < advanced.length; i++) models.add(advanced[i]);
        },
    };

    const runFrame = (now: number): void => {
        const frameMs = Math.min(now - state.lastTime, MAX_FRAME_MS);
        state.lastTime = now;
        const current = state.current;
        if (current !== undefined) {
            const deltaMs = state.isStepping ? FRAME_MS : state.isPlaying ? frameMs * state.speed : 0;
            state.isStepping = false;
            if (deltaMs > 0) {
                models.forEach((model) => model.update(deltaMs));
                if (current.view !== undefined) updateView(current.view, deltaMs);
                state.elapsedMs += deltaMs;
            }
            if (current.view !== undefined) refreshView(current.view);
            current.render(deltaMs > 0);
        }
        onFrame();
        requestAnimationFrame(runFrame);
    };
    requestAnimationFrame(runFrame);
    addEventListener('resize', () => state.current?.resize());

    const computeZoom = (width: number, height: number, isPixelArt: boolean): number => {
        if (state.zoom !== 'fit') return state.zoom;
        const fit = Math.min((viewport.clientWidth - VIEWPORT_MARGIN) / width, (viewport.clientHeight - VIEWPORT_MARGIN) / height);
        return isPixelArt ? Math.max(1, Math.floor(fit)) : Math.min(Math.max(fit, 0.1), MAX_SMOOTH_ZOOM);
    };

    /** Sizes a canvas on the page to show a view of `width` by `height` at the zoom, and returns the zoom. */
    const fitCanvas = (canvas: HTMLCanvasElement, width: number, height: number, isPixelArt: boolean): number => {
        const zoom = computeZoom(width, height, isPixelArt);
        canvas.style.width = `${Math.round(width * zoom)}px`;
        canvas.style.height = `${Math.round(height * zoom)}px`;
        canvas.classList.toggle('vp-pixelated', isPixelArt);
        return zoom;
    };

    const getPixiApp = (isPixelArt: boolean): Promise<Application> => {
        let app = pixiApps.get(isPixelArt);
        if (app === undefined) {
            const created = new Application();
            app = created.init({ width: 320, height: 240, antialias: !isPixelArt, roundPixels: isPixelArt, autoStart: false, preference: 'webgl' }).then(() => created);
            pixiApps.set(isPixelArt, app);
        }
        return app;
    };

    const mountPixi = async (kind: AnyCanvasKind, view: Container, imageOptions: Record<string, unknown>): Promise<Mounted> => {
        const isPixelArt = imageOptions.pixelArt === true;
        const app = await getPixiApp(isPixelArt);
        // Framed as v-snap frames it. An axis whose size the test leaves out is framed by the view's bounds, with a margin
        const bounds = view.getLocalBounds();
        const width = imageOptions.width as number | undefined;
        const height = imageOptions.height as number | undefined;
        const left = width === undefined ? Math.floor(bounds.x) - FRAME_MARGIN : 0;
        const top = height === undefined ? Math.floor(bounds.y) - FRAME_MARGIN : 0;
        const frameWidth = width ?? Math.max(1, Math.ceil(bounds.x + bounds.width) - left + FRAME_MARGIN);
        const frameHeight = height ?? Math.max(1, Math.ceil(bounds.y + bounds.height) - top + FRAME_MARGIN);
        const holder = new Container();
        holder.position.set(-left, -top);
        holder.addChild(view);
        app.stage.addChild(holder);
        app.renderer.background.color = (imageOptions.background as number | string | undefined) ?? DEFAULT_BACKGROUND;
        viewport.replaceChildren(app.canvas);
        const mounted: Mounted = {
            view,
            width: frameWidth,
            height: frameHeight,
            zoom: 1,
            resize: () => {
                mounted.zoom = computeZoom(frameWidth, frameHeight, isPixelArt);
                app.renderer.resize(frameWidth, frameHeight, isPixelArt ? 1 : Math.min(mounted.zoom * devicePixelRatio, MAX_RESOLUTION));
                fitCanvas(app.canvas, frameWidth, frameHeight, isPixelArt);
            },
            render: () => app.renderer.render(app.stage),
            dispose: () => {
                holder.removeChild(view);
                app.stage.removeChild(holder);
                holder.destroy();
                kind.dispose?.(view);
            },
        };
        mounted.resize();
        return mounted;
    };

    /** Mounts a view of a canvas kind other than Pixi's, which the kind's own `draw` draws each frame that time moves. */
    const mountDrawn = async (kind: AnyCanvasKind, view: View, imageOptions: Record<string, unknown>): Promise<Mounted> => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context === null) throw new Error('The preview could not get a 2D context to show the view on.');
        const draw = async (): Promise<void> => {
            const image = await kind.draw(view, { ...imageOptions, maxPixels: MAX_PIXELS });
            const isNewSize = canvas.width !== image.width || canvas.height !== image.height;
            copyImage({ image, canvas, context });
            if (isNewSize) mounted.resize();
        };
        let isDrawing = false;
        const mounted: Mounted = {
            view,
            width: 1,
            height: 1,
            zoom: 1,
            resize: () => {
                mounted.width = canvas.width;
                mounted.height = canvas.height;
                mounted.zoom = fitCanvas(canvas, canvas.width, canvas.height, imageOptions.pixelArt === true);
            },
            render: (hasMoved) => {
                if (!hasMoved || isDrawing) return;
                isDrawing = true;
                void draw().finally(() => {
                    isDrawing = false;
                });
            },
            dispose: () => kind.dispose?.(view),
        };
        viewport.replaceChildren(canvas);
        await draw();
        return mounted;
    };

    const mountCanvas = (view: HTMLCanvasElement): Mounted => {
        viewport.replaceChildren(view);
        const mounted: Mounted = {
            view: undefined,
            width: view.width,
            height: view.height,
            zoom: 1,
            resize: () => {
                mounted.zoom = fitCanvas(view, view.width, view.height, false);
            },
            render: () => undefined,
            dispose: () => view.remove(),
        };
        mounted.resize();
        return mounted;
    };

    const mountHtml = (kind: HtmlViewKind, view: HTMLElement): Mounted => {
        const host = document.createElement('div');
        host.className = 'vp-html-host';
        host.append(view);
        viewport.replaceChildren(host);
        return {
            // An element is a view once a test has imported @mvtjs/html, which registers elements with the tick API.
            // This package registers only Pixi's views in its own types.
            view: view as unknown as View,
            width: host.clientWidth,
            height: host.clientHeight,
            zoom: 1,
            resize: () => undefined,
            render: () => undefined,
            dispose: () => (kind.dispose === undefined ? view.remove() : kind.dispose(view)),
        };
    };

    return {
        show: async (test) => {
            const shows = ++state.shows;
            state.current?.dispose();
            state.current = undefined;
            models.clear();
            state.elapsedMs = 0;
            const kind = findKind({ test, config });
            const imageOptions = applyDefaults(kind.kind === 'html' ? undefined : (kind as AnyCanvasKind).defaults, test.options);
            if (kind.kind !== 'html') (kind as AnyCanvasKind).beforePose?.(imageOptions);
            state.isNoting = true;
            let view: unknown;
            try {
                view = await test.pose(...test.args);
            }
            finally {
                state.isNoting = false;
            }
            const isView = kind.kind === 'html' ? view instanceof Element : (kind as AnyCanvasKind).isView(view);
            if (!isView) throw new Error(`The pose returned ${describeValue(view)}, which isn't a view of the test's kind, '${kind.kind}'.`);
            // A newer pose started while this one ran, so this view is already out of date
            if (shows !== state.shows) {
                if (kind.kind !== 'html') (kind as AnyCanvasKind).dispose?.(view);
                return;
            }
            kind.prepare?.(view as never);
            if (kind.kind === 'html') state.current = mountHtml(kind as HtmlViewKind, view as HTMLElement);
            else if (kind.kind === 'canvas') state.current = mountCanvas(view as HTMLCanvasElement);
            else if (view instanceof Container) state.current = await mountPixi(kind as AnyCanvasKind, view, imageOptions);
            else state.current = await mountDrawn(kind as AnyCanvasKind, view as View, imageOptions);
        },
        isPlaying: () => state.isPlaying,
        setPlaying: (isPlaying) => {
            state.isPlaying = isPlaying;
        },
        step: () => {
            state.isStepping = true;
        },
        setSpeed: (speed) => {
            state.speed = speed;
        },
        setZoom: (zoom) => {
            state.zoom = zoom;
            state.current?.resize();
        },
        elapsedMs: () => state.elapsedMs,
        modelCount: () => models.size,
        describeSize: () => {
            const current = state.current;
            if (current === undefined) return '';
            return `${current.width} x ${current.height} at ${Math.round(current.zoom * 100)}%`;
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type Model = { readonly update: (deltaMs: number) => void };

type AnyCanvasKind = CanvasViewKind<unknown, Record<string, unknown>>;

interface Mounted {
    /**
     * A view of any renderer the site's views use, which the tick API ticks
     * the same way. It's `undefined` for a canvas that the pose drew, which isn't a view.
     */
    readonly view: View | undefined;
    width: number;
    height: number;
    zoom: number;
    /** Sizes the view's canvas on the page to the zoom. */
    readonly resize: () => void;
    /** Draws the view, after it has refreshed. `hasMoved` is whether time moved this frame. */
    readonly render: (hasMoved: boolean) => void;
    readonly dispose: () => void;
}

/** One frame at 60 frames a second, which Step moves time on by. */
const FRAME_MS = 1000 / 60;
/** The longest frame play moves time on by, so a tab that was hidden doesn't jump ahead. */
const MAX_FRAME_MS = 100;
/** The margin round a view that's framed by its bounds, as v-snap frames it. */
const FRAME_MARGIN = 4;
/** v-snap's own background, behind a view whose test doesn't set one. */
const DEFAULT_BACKGROUND = 0x303034;
const VIEWPORT_MARGIN = 32;
const MAX_SMOOTH_ZOOM = 4;
const MAX_RESOLUTION = 4;
const MAX_PIXELS = 4_000_000;

/** The kind of view a test's pose returns, from its options and the site's config. */
function findKind(options: { readonly test: RecordedTest; readonly config: PreviewStageOptions['config'] }): AnyCanvasKind | HtmlViewKind {
    const { test, config } = options;
    const views = config.views as readonly (AnyCanvasKind | HtmlViewKind)[];
    if (test.kind === 'html') return views.find((view) => !('draw' in view)) ?? { kind: 'html' };
    const name = (test.options.kind as string | undefined) ?? config.defaultKind ?? 'canvas';
    if (name === 'canvas') return CANVAS_KIND;
    const kind = views.find((view): view is AnyCanvasKind => 'draw' in view && view.kind === name);
    if (kind === undefined) throw new Error(`The test names a kind of view, '${name}', which the site's vsnap.config.ts doesn't list.`);
    return kind;
}

/** v-snap's own kind, for a canvas that the pose drew. */
const CANVAS_KIND: AnyCanvasKind = {
    kind: 'canvas',
    isView: (value) => value instanceof HTMLCanvasElement,
    draw: (view) => view as HTMLCanvasElement,
};

/** Returns a test's options with a kind's defaults under them, as v-snap applies them. */
function applyDefaults(defaults: object | undefined, options: Readonly<Record<string, unknown>>): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...defaults };
    for (const [key, value] of Object.entries(options)) {
        if (value !== undefined) merged[key] = value;
    }
    return merged;
}

/** Copies an image that a kind drew onto the canvas on the page. */
function copyImage(options: { readonly image: DrawnImage; readonly canvas: HTMLCanvasElement; readonly context: CanvasRenderingContext2D }): void {
    const { image, canvas, context } = options;
    if (canvas.width !== image.width) canvas.width = image.width;
    if (canvas.height !== image.height) canvas.height = image.height;
    if (image instanceof HTMLCanvasElement || image instanceof OffscreenCanvas) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
        return;
    }
    const pixels = new Uint8ClampedArray(image.pixels);
    context.putImageData(new ImageData(pixels, image.width, image.height), 0, 0);
}

function describeValue(value: unknown): string {
    if (value === undefined) return 'undefined';
    if (value instanceof Object) return `a ${value.constructor.name}`;
    return JSON.stringify(value);
}

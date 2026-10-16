import {
    type Camera, NoToneMapping, type Object3D, PCFShadowMap, PerspectiveCamera, Scene, type ShadowMapType, SRGBColorSpace, type ToneMapping,
    Texture, WebGLRenderer,
} from 'three';
import type { CanvasImage } from '../browser';
import { fitImage, flipRows, useCached } from '../shared';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ThreeImageOptions {
    /**
     * The image's size in CSS pixels. It must be given, because a
     * three.js view has no bounds to take it from.
     */
    readonly width: number;
    readonly height: number;
    /**
     * Makes the camera that the view is rendered with. A perspective
     * camera's aspect ratio is set to the image's.
     */
    readonly camera: () => Camera;
    /**
     * Dresses the scene that the view is added to, and the renderer, as the
     * view's game does. It sets things such as the background, the
     * environment map (an image that lights the scene and is reflected in
     * it), the lights and the tone mapping (how bright colours are fitted to
     * the screen). Without it, the scene holds only the view, and a view lit
     * by its scene's environment comes out dark.
     *
     * Each function is called once per page, not once per actual image,
     * because an environment map takes about a second to make in software
     * WebGL. Its scene is kept, for the four functions that recent tests
     * used. Each test's view is added to that scene and taken out after, with
     * the renderer's settings as the function left them. So the function must
     * dress the scene the same way every time. It must also be one function
     * shared by the tests (ideally the game's own), not a new one for each
     * test, which would dress a new scene for every test.
     */
    readonly scene?: (options: ThreeSceneOptions) => void;
    /**
     * The colour behind the view where the scene sets no background, as a
     * number such as `0x202024` or a CSS colour. By default, it is the same
     * dark grey as Pixi images.
     */
    readonly background?: number | string;
}

/** The scene that the view goes into, and the renderer that draws it, which the `scene` option sets up. */
export interface ThreeSceneOptions {
    readonly scene: Scene;
    readonly renderer: WebGLRenderer;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Draws a refreshed view in a scene dressed as the options say, and reads
 * its pixels back.
 *
 * It draws on the canvas of one renderer, which is kept for every actual
 * image. It reads the pixels straight back, before the page can composite
 * them, so it takes no screenshot. It draws on the canvas rather than a
 * render target, because three.js tone-maps and converts colour only on the
 * way to the canvas. So the actual image is what the game shows.
 *
 * A three.js image is always antialiased. So an image over the size
 * budget is drawn at a lower resolution to fit, as a smooth Pixi one is.
 */
export function drawThreeImage(view: Object3D, options: ThreeImageOptions & { readonly maxPixels: number }): CanvasImage {
    const { width, height } = options;
    const fit = fitImage({ width, height, maxPixels: options.maxPixels, canScale: true });
    if ('problem' in fit) throw new Error(fit.problem);
    const renderer = ensureRenderer();
    const dressed = ensureDressedScene(renderer, options.scene);
    try {
        applySettings(renderer, dressed.settings);
        renderer.setPixelRatio(fit.resolution);
        renderer.setSize(width, height, false);
        renderer.setClearColor(options.background ?? DEFAULT_BACKGROUND, 1);
        const camera = options.camera();
        if (camera instanceof PerspectiveCamera) {
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        }
        dressed.scene.add(view);
        renderer.render(dressed.scene, camera);
        const gl = renderer.getContext();
        const imageWidth = gl.drawingBufferWidth;
        const imageHeight = gl.drawingBufferHeight;
        const pixels = new Uint8Array(imageWidth * imageHeight * 4);
        gl.readPixels(0, 0, imageWidth, imageHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        flipRows(pixels, imageWidth, imageHeight);
        return { width: imageWidth, height: imageHeight, pixels, resolution: fit.resolution };
    }
    finally {
        dressed.scene.remove(view);
        applySettings(renderer, DEFAULT_SETTINGS);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_BACKGROUND = 0x202024;

let shared: WebGLRenderer | undefined;

/** The renderer settings a scene's dressing may change. */
interface RendererSettings {
    readonly toneMapping: ToneMapping;
    readonly toneMappingExposure: number;
    readonly outputColorSpace: WebGLRenderer['outputColorSpace'];
    readonly shadows: boolean;
    readonly shadowType: ShadowMapType;
    readonly localClipping: boolean;
}

interface DressedScene {
    readonly scene: Scene;
    readonly settings: RendererSettings;
}

/**
 * The scene for each `scene` function, with the renderer settings that the
 * function chose. Each scene is made for its first actual image and kept.
 * The `undefined` key holds the undressed scene.
 */
const dressedScenes = new Map<((options: ThreeSceneOptions) => void) | undefined, DressedScene>();

/**
 * Returns the one renderer for every three.js view. It is made on first
 * use and kept, for two reasons. Its shaders compile only once, and a page
 * keeps only so many WebGL contexts. It is antialiased, as the games'
 * renderers are.
 */
function ensureRenderer(): WebGLRenderer {
    shared ??= new WebGLRenderer({ antialias: true });
    return shared;
}

function ensureDressedScene(renderer: WebGLRenderer, dress: ((options: ThreeSceneOptions) => void) | undefined): DressedScene {
    return useCached(dressedScenes, {
        key: dress,
        limit: SCENE_LIMIT,
        create: () => {
            const scene = new Scene();
            applySettings(renderer, DEFAULT_SETTINGS);
            dress?.({ scene, renderer });
            const dressed = { scene, settings: readSettings(renderer) };
            applySettings(renderer, DEFAULT_SETTINGS);
            return dressed;
        },
        release: (dressed) => releaseScene(dressed.scene),
    });
}

/**
 * The most dressed scenes that the page keeps. A test whose `scene` is a new
 * function each time makes a new scene each time, so the page keeps only the
 * most recent.
 */
const SCENE_LIMIT = 4;

/** Frees what a dressed scene holds on the GPU: its environment map, its background, and its objects' geometries and materials. */
function releaseScene(scene: Scene): void {
    scene.environment?.dispose();
    if (scene.background instanceof Texture) scene.background.dispose();
    scene.traverse((object) => {
        const drawn = object as { geometry?: { dispose?: () => void }; material?: { dispose: () => void } | { dispose: () => void }[] };
        drawn.geometry?.dispose?.();
        const materials = drawn.material === undefined ? [] : Array.isArray(drawn.material) ? drawn.material : [drawn.material];
        for (let i = 0; i < materials.length; i++) materials[i].dispose();
    });
}

/** The renderer settings that three.js starts with. */
const DEFAULT_SETTINGS: RendererSettings = {
    toneMapping: NoToneMapping,
    toneMappingExposure: 1,
    outputColorSpace: SRGBColorSpace,
    shadows: false,
    shadowType: PCFShadowMap,
    localClipping: false,
};

function readSettings(renderer: WebGLRenderer): RendererSettings {
    return {
        toneMapping: renderer.toneMapping,
        toneMappingExposure: renderer.toneMappingExposure,
        outputColorSpace: renderer.outputColorSpace,
        shadows: renderer.shadowMap.enabled,
        shadowType: renderer.shadowMap.type,
        localClipping: renderer.localClippingEnabled,
    };
}

function applySettings(renderer: WebGLRenderer, settings: RendererSettings): void {
    renderer.toneMapping = settings.toneMapping;
    renderer.toneMappingExposure = settings.toneMappingExposure;
    renderer.outputColorSpace = settings.outputColorSpace;
    renderer.shadowMap.enabled = settings.shadows;
    renderer.shadowMap.type = settings.shadowType;
    renderer.localClippingEnabled = settings.localClipping;
}

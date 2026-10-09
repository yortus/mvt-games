import {
    type Camera, NoToneMapping, type Object3D, PCFShadowMap, PerspectiveCamera, Scene, type ShadowMapType, SRGBColorSpace, type ToneMapping,
    WebGLRenderer,
} from 'three';
import { fitPicture } from './picture-budget';
import { flipRows, isAllOne } from './picture-pixels';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ThreePictureOptions {
    /**
     * The picture's size in CSS pixels. It must be given, because a
     * three.js view has no bounds to take it from.
     */
    readonly width: number;
    readonly height: number;
    /**
     * Makes the camera that the picture is taken with. A perspective
     * camera's aspect ratio is set to the picture's.
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
     * Each function is called once per page, not once per picture, because an
     * environment map takes about a second to make in software WebGL. Its
     * scene is kept. Each picture's view is added to that scene and taken out
     * after, with the renderer's settings as the function left them. So the
     * function must dress the scene the same way every time. It must also be
     * one function shared by the tests (ideally the game's own), not a new
     * one for each test.
     */
    readonly scene?: (options: ThreeSceneOptions) => void;
    /**
     * The colour behind the view where the scene sets no background. By
     * default, it is the same dark grey as Pixi pictures.
     */
    readonly background?: number;
}

/** The scene that the view goes into, and the renderer that draws it, which the `scene` option sets up. */
export interface ThreeSceneOptions {
    readonly scene: Scene;
    readonly renderer: WebGLRenderer;
}

/** A picture's pixels, read back from the renderer. They are RGBA, with rows from the top. */
export interface ThreePicture {
    readonly width: number;
    readonly height: number;
    readonly pixels: Uint8Array;
    /** Picture pixels per CSS pixel. This is 1, or less for a big picture. */
    readonly resolution: number;
    /** Whether every pixel is the same, which means the view drew nothing, or nothing that was lit. */
    readonly isBlank: boolean;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Draws a refreshed view in a scene dressed as the options say, and reads
 * its pixels back.
 *
 * It draws on the canvas of one renderer, which is kept for every picture.
 * It reads the pixels straight back, before the page can composite them, so
 * it takes no screenshot. It draws on the canvas rather than a render
 * target, because three.js tone-maps and converts colour only on the way to
 * the canvas. So this is the picture that the game shows.
 *
 * A three.js picture is always antialiased. So a picture over the size
 * budget is drawn at a lower resolution to fit, as a smooth Pixi one is.
 */
export function drawThreePicture(view: Object3D, options: ThreePictureOptions & { readonly maxPixels: number }): ThreePicture {
    const { width, height } = options;
    const fit = fitPicture({ width, height, maxPixels: options.maxPixels, canScale: true });
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
        const pictureWidth = gl.drawingBufferWidth;
        const pictureHeight = gl.drawingBufferHeight;
        const pixels = new Uint8Array(pictureWidth * pictureHeight * 4);
        gl.readPixels(0, 0, pictureWidth, pictureHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        flipRows(pixels, pictureWidth, pictureHeight);
        return { width: pictureWidth, height: pictureHeight, pixels, resolution: fit.resolution, isBlank: isAllOne(pixels) };
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
 * function chose. Each scene is made for its first picture and kept. The
 * `undefined` key holds the undressed scene.
 */
const dressedScenes = new Map<((options: ThreeSceneOptions) => void) | undefined, DressedScene>();

/**
 * Returns the one renderer for every three.js picture. It is made on first
 * use and kept, for two reasons. Its shaders compile only once, and a page
 * keeps only so many WebGL contexts. It is antialiased, as the games'
 * renderers are.
 */
function ensureRenderer(): WebGLRenderer {
    shared ??= new WebGLRenderer({ antialias: true });
    return shared;
}

function ensureDressedScene(renderer: WebGLRenderer, dress: ((options: ThreeSceneOptions) => void) | undefined): DressedScene {
    let dressed = dressedScenes.get(dress);
    if (dressed === undefined) {
        const scene = new Scene();
        applySettings(renderer, DEFAULT_SETTINGS);
        dress?.({ scene, renderer });
        dressed = { scene, settings: readSettings(renderer) };
        applySettings(renderer, DEFAULT_SETTINGS);
        dressedScenes.set(dress, dressed);
    }
    return dressed;
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

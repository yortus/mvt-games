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
    /** The picture's size in CSS pixels: a three.js view has no bounds to take it from. */
    readonly width: number;
    readonly height: number;
    /** Makes the camera the picture is taken with. A perspective camera's aspect is set to the picture's. */
    readonly camera: () => Camera;
    /**
     * Dresses the scene the view is added to, and the renderer, as the view's
     * entry does: background, environment map, lights, tone mapping. Without
     * it the scene holds only the view: a view lit by its scene's environment
     * comes out dark.
     *
     * Called once per page for each function, not per picture: its scene is
     * kept, and each picture's view is added to it and taken out after, with
     * the renderer's settings as the function left them. An environment map
     * takes about a second to make in software WebGL. So it must dress the
     * scene the same way every time, and be one function shared by the
     * tests (the entry's own, ideally), not a new one per test.
     */
    readonly scene?: (options: ThreeSceneOptions) => void;
    /** The colour behind the view where the scene sets no background. Default: the same dark grey as Pixi pictures. */
    readonly background?: number;
}

/** What a scene is dressed with: the scene the view goes into, and the renderer that draws it. */
export interface ThreeSceneOptions {
    readonly scene: Scene;
    readonly renderer: WebGLRenderer;
}

/** A picture's pixels, read back from the renderer: RGBA, rows from the top. */
export interface ThreePicture {
    readonly width: number;
    readonly height: number;
    readonly pixels: Uint8Array;
    /** Picture pixels per CSS pixel: 1, or less for a big picture. */
    readonly resolution: number;
    /** Whether every pixel is the same: the view drew nothing, or nothing lit. */
    readonly isBlank: boolean;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Draws a refreshed view in a scene dressed as the options say, on
 * the canvas of one renderer kept for every picture, and reads the pixels
 * straight back, before the page can composite them: no screenshot. On the
 * canvas, not a render target, because three.js tone-maps and converts
 * colour only on the way to the canvas, so this is the picture the game
 * shows. A three.js picture is always antialiased, so one over the size
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

/** Each dressing's scene, made on its first picture and kept, with the settings it chose; and the undressed one. */
const dressedScenes = new Map<((options: ThreeSceneOptions) => void) | undefined, DressedScene>();

/**
 * One renderer for every three.js picture, made on first use and kept:
 * shaders compile once, and a page keeps only so many WebGL contexts.
 * Antialiased, as the games' renderers are.
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

/** three.js's defaults. */
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

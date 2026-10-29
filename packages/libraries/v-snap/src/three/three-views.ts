import { type Camera, type Material, Object3D } from 'three';
import type { CanvasViewKind } from '../browser';
import { drawThreeImage, type ThreeImageOptions } from './three-image';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * What a project does to its three.js views around each image, and the
 * options of each test whose own options don't set them.
 */
export interface ThreeViewsOptions {
    /** Prepares a view after its pose returns it, and before its image is taken. */
    readonly prepare?: (view: Object3D) => void;
    /**
     * Disposes of a view after its image is taken. By default, it removes
     * the view from its parent, and disposes of every geometry and material
     * under it.
     */
    readonly dispose?: (view: Object3D) => void;
    /** The colour behind each view whose test's options don't set one, where the scene sets no background, as a number such as `0x202024` or a CSS colour. */
    readonly background?: number | string;
    /**
     * The image's size, for each test whose options don't give it, such as
     * the game's screen. A test may then leave it out.
     */
    readonly width?: number;
    readonly height?: number;
    /** Makes the camera, for each test whose options don't give one, such as the game's own. A test may then leave it out. */
    readonly camera?: () => Camera;
    /** Dresses the scene, for each test whose options don't, as `ThreeImageOptions.scene` says. */
    readonly scene?: ThreeImageOptions['scene'];
}

/**
 * The options of a three.js test, from the options that `threeViews` was
 * given: `width`, `height` and `camera` are needed, unless `threeViews`
 * gave them.
 */
export type ThreeTestOptions<O extends ThreeViewsOptions = Record<never, never>> =
    & Omit<ThreeImageOptions, DefaultedKey<O>>
    & Partial<Pick<ThreeImageOptions, DefaultedKey<O>>>;

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Returns the kind of view for three.js objects, which a project lists in
 * its `vsnap.config.ts`. Its tests give `kind: 'three'`, unless it is the
 * project's default kind, and their poses return three.js objects. A
 * three.js view has no bounds to frame it by, so each test gives the
 * image's size and the camera, unless these options give them for every
 * test.
 */
export function threeViews<D extends ThreeDefaults = Record<never, never>>(options: ThreeViewsOptions & D = {} as D): CanvasViewKind<Object3D, ThreeTestOptions<D>, 'three'> {
    const { background, width, height, camera, scene } = options;
    return {
        kind: 'three',
        isView: (value) => value instanceof Object3D,
        defaults: { background, width, height, camera, scene } as Partial<ThreeTestOptions<D>>,
        prepare: options.prepare,
        draw: (view, imageOptions) => drawThreeImage(view, { ...requireImageOptions(imageOptions as Partial<ThreeImageOptions>), maxPixels: imageOptions.maxPixels }),
        dispose: options.dispose ?? disposeObject,
        blankHint: 'Is the camera looking at it, and is it lit?',
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The options given to `threeViews` that a test may then leave out. */
type ThreeDefaults = Pick<ThreeViewsOptions, RequiredKey>;

/** The options that a three.js test needs, which `threeViews` can give instead. */
type RequiredKey = 'width' | 'height' | 'camera';

/** The needed options that the options given to `threeViews` give. */
type DefaultedKey<O> = { [K in RequiredKey]: K extends keyof O ? (undefined extends O[K] ? never : K) : never }[RequiredKey];

/**
 * Returns a test's options, with its kind's defaults under them, and throws
 * if they still lack the image's size or its camera. The types catch that,
 * but a test without them would otherwise fail deep inside three.js.
 */
function requireImageOptions(options: Partial<ThreeImageOptions>): ThreeImageOptions {
    const missing = (['width', 'height', 'camera'] as const).filter((key) => options[key] === undefined);
    if (missing.length > 0) {
        throw new Error(`A three.js test needs its image's width, height and camera, which its options give, or threeViews() gives for every test. This one has no ${missing.join(' or ')}.`);
    }
    return options as ThreeImageOptions;
}

/**
 * Removes a three.js object from its parent, and disposes of every geometry
 * and material under it: of meshes, lines, points and sprites. It leaves
 * textures alone, since tests often share them.
 */
function disposeObject(root: Object3D): void {
    root.removeFromParent();
    root.traverse((object) => {
        const drawn = object as { geometry?: { dispose?: () => void }; material?: Material | Material[] };
        drawn.geometry?.dispose?.();
        const materials = drawn.material === undefined ? [] : Array.isArray(drawn.material) ? drawn.material : [drawn.material];
        for (let i = 0; i < materials.length; i++) materials[i].dispose();
    });
}

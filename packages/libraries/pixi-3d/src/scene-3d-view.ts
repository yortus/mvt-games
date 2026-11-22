import { Camera3D, type Container3D, View3D, type View3DOptions } from '@pixi/3d';
import type { IHitArea, PointData } from 'pixi.js';
import { refreshView, setRefresh } from '@mvtjs/utils';
import type { ValueOrGetter } from '@mvtjs/utils/jsx';
import { connectScene } from './connect-scene';
import { placeScreenAnchors } from './screen-anchor-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface Scene3DViewBindings {
    /** The 3D scene to draw, such as a view written with the PixiJS 3D JSX runtime. */
    readonly scene: Container3D;
    /** The view's size, in the Pixi stage's pixels. A getter is read each refresh, so the view can follow a stage whose size changes. */
    readonly width: ValueOrGetter<number>;
    readonly height: ValueOrGetter<number>;
    /**
     * The background drawn behind the scene, such as a colour, a sky
     * gradient or a cube map. Without one, the background is transparent. A
     * getter's value is written only when it changes, which is cheap.
     */
    readonly background?: ValueOrGetter<View3DOptions['background']>;
    /** The light from the surroundings, such as a sky gradient. Without it, only the scene's own lights light the scene. Read once. */
    readonly environment?: View3DOptions['environment'];
    /**
     * Fog, which fades distant things into a colour. A getter's value is
     * written only when it changes. That's cheap while the fog's `type`
     * stays the same. A change of `type` rebuilds the scene's shaders.
     */
    readonly fog?: ValueOrGetter<View3DOptions['fog']>;
    /** How bright colours are brought into the screen's range. Read once. */
    readonly toneMapping?: View3DOptions['toneMapping'];
    /** How bright the picture is, before tone mapping. 1 by default. A getter is read every frame, which is cheap. */
    readonly exposure?: ValueOrGetter<number>;
    /** Post-processing passes drawn over the scene, such as bloom, in order. Read once. */
    readonly passes?: View3DOptions['passes'];
    /** How sharp shadows are, as a shadow map's size. Read once. */
    readonly shadowQuality?: View3DOptions['shadowQuality'];
    /** How shadows' edges are softened. Read once. */
    readonly shadowFilter?: View3DOptions['shadowFilter'];
    /** Which point of the view sits at its position, from (0, 0), the top left, to (1, 1). Read once. */
    readonly anchor?: PointData | number;
    /**
     * The part of the view where a pointer reaches the scene. Without it, a
     * pointer anywhere on the view reaches the scene, so 2D views behind the
     * view never receive it. Read once.
     */
    readonly hitArea?: IHitArea;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Draws a 3D scene in a 2D Pixi tree. It returns a `View3D`, which Pixi
 * draws like any other container, so 2D views added after it draw on top.
 * Use it as a tag in a Pixi JSX file, and build its scene with the PixiJS 3D
 * JSX runtime, in a file of its own.
 *
 * It draws from the first `<camera>` in the scene, so a view in the scene
 * can move the camera like any other node. It finds the camera once, as
 * it's made. So keep one camera as a fixed part of the scene, outside any
 * `<Switch>` or `<List>`, and move it rather than swap it for another. A
 * scene without a camera uses PixiJS 3D's default camera. `connectScene` runs the scene's update and
 * refresh methods along with the stage's. After refreshing its scene, the
 * view places the scene's `ScreenAnchorView`s, because the camera reaches
 * its position for this frame only once the scene is refreshed.
 *
 * Its size, background, fog and exposure may change as often as you like,
 * and the camera's shape follows the size. The other bindings are read
 * once. A `View3D` keeps the scene that it was made with, and changing its
 * other settings later would rebuild its shaders or its render passes.
 */
export function Scene3DView(bindings: Scene3DViewBindings): View3D {
    const { scene, width, height, background, fog, exposure } = bindings;
    let drawnWidth = readValue(width);
    let drawnHeight = readValue(height);
    let drawnBackground = typeof background === 'function' ? undefined : background;
    let drawnFog = typeof fog === 'function' ? undefined : fog;
    const view = connectScene(new View3D({
        root: scene,
        camera: findCamera(scene),
        width: drawnWidth,
        height: drawnHeight,
        background: drawnBackground,
        environment: bindings.environment,
        fog: drawnFog,
        toneMapping: bindings.toneMapping,
        exposure: typeof exposure === 'function' ? undefined : exposure,
        passes: bindings.passes,
        shadowQuality: bindings.shadowQuality,
        shadowFilter: bindings.shadowFilter,
        anchor: bindings.anchor,
    }));
    if (bindings.hitArea !== undefined) view.hitArea = bindings.hitArea;

    // Replaces the refresh method that connectScene set, and refreshes the scene as that method does
    setRefresh(view, () => {
        const nextWidth = readValue(width);
        const nextHeight = readValue(height);
        if (nextWidth !== drawnWidth || nextHeight !== drawnHeight) {
            drawnWidth = nextWidth;
            drawnHeight = nextHeight;
            view.setSize(nextWidth, nextHeight);
        }
        if (typeof background === 'function') {
            const next = background();
            if (next !== drawnBackground) {
                drawnBackground = next;
                // eslint-disable-next-line @mvtjs/no-null -- PixiJS 3D clears the background with `null`
                view.background = next ?? null;
            }
        }
        if (typeof fog === 'function') {
            const next = fog();
            if (next !== drawnFog) {
                drawnFog = next;
                // eslint-disable-next-line @mvtjs/no-null -- PixiJS 3D clears the fog with `null`
                view.fog = next ?? null;
            }
        }
        if (typeof exposure === 'function') view.exposure = exposure();
        refreshView(scene);
        placeScreenAnchors(view);
    });
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function readValue<T>(value: ValueOrGetter<T>): T {
    return typeof value === 'function' ? (value as () => T)() : value;
}

/** Returns the first camera in the subtree, depth first, if there is one. */
function findCamera(node: Container3D): Camera3D | undefined {
    if (node instanceof Camera3D) return node;
    for (let i = 0; i < node.children.length; i++) {
        const found = findCamera(node.children[i]);
        if (found !== undefined) return found;
    }
    return undefined;
}

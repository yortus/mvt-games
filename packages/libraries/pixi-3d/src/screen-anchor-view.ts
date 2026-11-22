import type { View3D } from '@pixi/3d';
import { Container, Point } from 'pixi.js';
import type { Vector3Like } from './jsx';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ScreenAnchorViewBindings {
    /** The 3D scene that the point is in, which is the `View3D` that a `Scene3DView` returns. */
    readonly scene: View3D;
    /** The point to follow, in the scene's coordinates, such as a boss's position in the model. Read every frame. */
    readonly point: () => Vector3Like;
    /** The 2D view placed over the point, such as a name tag, with its own origin on the point. */
    readonly content: Container;
    /** Whether the content shows while its point is in front of the camera. If this is absent, the content always shows. */
    readonly isVisible?: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Places a 2D view over a point in a 3D scene, such as a name tag over a
 * car, or a marker over a goal. It's a Pixi container, so it stays crisp at
 * any distance. It draws over the scene, so walls never hide it. Put it in
 * the 2D tree after the scene, so it draws on top.
 *
 * Its position depends on where the camera is in this frame. `refreshView`
 * doesn't guarantee an order among siblings, so the anchor can't place
 * itself. It might read the camera before the scene's views have moved it.
 * Instead, it registers with its scene, and the `Scene3DView` places it
 * right after refreshing the scene. It's hidden while its point is behind
 * the camera.
 */
export function ScreenAnchorView(bindings: ScreenAnchorViewBindings): Container {
    const { scene, point, content, isVisible } = bindings;
    const anchor = new Container();
    anchor.addChild(content);
    const placed: PlacedAnchor = { anchor, point, isVisible };
    let anchors = anchorsByScene.get(scene);
    if (anchors === undefined) {
        anchors = [];
        anchorsByScene.set(scene, anchors);
    }
    anchors.push(placed);
    anchor.on('destroyed', () => {
        const list = anchorsByScene.get(scene);
        const index = list?.indexOf(placed) ?? -1;
        if (index >= 0) list?.splice(index, 1);
    });
    return anchor;
}

/**
 * Places each anchor registered with a scene over its point, as the scene's
 * camera now sees it. A `Scene3DView` calls it from its refresh step, after
 * refreshing its scene.
 */
export function placeScreenAnchors(scene: View3D): void {
    const anchors = anchorsByScene.get(scene);
    if (anchors === undefined) return;
    for (let i = 0; i < anchors.length; i++) {
        const { anchor, point, isVisible } = anchors[i];
        const isWanted = isVisible === undefined || isVisible();
        // PixiJS 3D returns `null` for a point behind the camera
        const onScreen = isWanted ? scene.worldToScreen(point(), projected) ?? undefined : undefined;
        const parent = anchor.parent ?? undefined;
        anchor.visible = onScreen !== undefined;
        if (onScreen === undefined || parent === undefined) continue;
        parent.toLocal(onScreen, undefined, local);
        anchor.position.copyFrom(local);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface PlacedAnchor {
    readonly anchor: Container;
    readonly point: () => Vector3Like;
    readonly isVisible: (() => boolean) | undefined;
}

/** Each scene's anchors, in the order they were made. */
const anchorsByScene = new WeakMap<View3D, PlacedAnchor[]>();

/** Reused for every anchor, so placing them doesn't allocate. */
const projected = new Point();
const local = new Point();

import { type Camera3D, Container3D, Matrix4, Vector3 } from '@pixi/3d';
import { refreshView, updateView } from '@mvtjs/html';
import { setRefresh, setUpdate, type ValueOrGetter } from '@mvtjs/pixi-3d';
import { computeQuadTransform } from './compute-quad-transform';
import type { LiveEntry } from './live-entries-host';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface LiveElementViewBindings {
    /** The entry running on the screen, if one is. Only one that draws with the DOM has an element to lay over it. */
    readonly live: () => LiveEntry | undefined;
    /** The camera the showcase is seen through. It must refresh before this view, as it does when it comes first in the scene. */
    readonly camera: Camera3D;
    /** The screen's size, in metres. */
    readonly width: number;
    readonly height: number;
    /** The showcase's view, in pixels, which its overlay matches. */
    readonly viewWidth: ValueOrGetter<number>;
    readonly viewHeight: number;
    /** Whether to show the entry over its screen now, such as while the visitor walks round, not while they play another. */
    readonly isShown: () => boolean;
    /** Whether the entry receives pointer events now, such as while the visitor stands at its screen, so they can use it in place. */
    readonly isInteractive: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Lays an entry that draws with the DOM over its screen in a showcase. The
 * entry runs in a box of HTML on the showcase's overlay, which sits over
 * the canvas. Each refresh, this view projects the screen's corners through
 * the camera, and transforms the box to land on them, so it looks hung in
 * the scene. Then the browser delivers the visitor's clicks and drags to
 * the entry's own elements, as anywhere else on the page. It also ticks and
 * renders the entry's views, as `ScreenView` does a Pixi entry's stage.
 *
 * It's placed where the screen is, with the screen facing +z. The box is
 * HTML over the canvas, so it's always in front of the scene. Something
 * that passes between the visitor and the screen doesn't hide it. PixiJS 3D
 * rebuilds a camera's matrices only as it draws, a frame late for this, so
 * the view works them out afresh from the camera's position.
 */
export function LiveElementView(bindings: LiveElementViewBindings): Container3D {
    const { live, camera, width, height, viewWidth, viewHeight, isShown, isInteractive } = bindings;
    const view = new Container3D();
    // The screen's corners, in its own space: its top left, top right, bottom right and bottom left
    const local = [-width / 2, height / 2, width / 2, height / 2, width / 2, -height / 2, -width / 2, -height / 2];
    const corners = new Float64Array(8);
    // The corners and box size the transform was last worked out for, so it's worked out again only as they change
    const transformedCorners = new Float64Array(8);
    let transformedWidth = 0;
    let transformedHeight = 0;
    let transform: string | undefined;
    const world = new Matrix4();
    const cameraWorld = new Matrix4();
    const cameraView = new Matrix4();
    const modelView = new Matrix4();
    const projection = new Matrix4();
    const point = new Vector3();
    // What was last written to the element, so a style is only written as it changes
    let placed: HTMLElement | undefined;
    let placedTransform = '';
    let placedVisibility = '';
    let placedPointer = '';

    setUpdate(view, (deltaMs) => {
        const views = live()?.elementSession?.views;
        if (views === undefined) return;
        for (let i = 0; i < views.length; i++) updateView(views[i], deltaMs);
    });

    setRefresh(view, () => {
        const entry = live();
        const session = entry?.elementSession;
        if (session !== undefined) {
            for (let i = 0; i < session.views.length; i++) refreshView(session.views[i]);
            session.render();
        }
        const element = entry?.element;
        if (element !== placed) {
            placed = element;
            placedTransform = '';
            placedVisibility = '';
            placedPointer = '';
        }
        if (entry === undefined || element === undefined) return;
        const shownTransform = isShown() && project() ? transformFor(entry) : undefined;
        writeStyle(element, shownTransform, shownTransform !== undefined && isInteractive());
    });
    return view;

    /** Projects the screen's corners onto the view, into `corners`. Returns false if the screen faces away, or any corner is behind the camera. */
    function project(): boolean {
        view.getGlobalTransform(world);
        cameraView.getInverse(camera.getGlobalTransform(cameraWorld));
        modelView.multiplyMatrices(cameraView, world);
        const across = typeof viewWidth === 'function' ? viewWidth() : viewWidth;
        camera.computeProjection(across / viewHeight, projection);
        for (let i = 0; i < 4; i++) {
            point.set(local[i * 2], local[i * 2 + 1], 0).applyAffineMatrix4(modelView);
            // The camera looks down -z. A corner level with it, or behind it, can't be projected
            if (point.z > -NEAR) return false;
            point.applyMatrix4(projection);
            corners[i * 2] = ((point.x + 1) / 2) * across;
            corners[i * 2 + 1] = ((1 - point.y) / 2) * viewHeight;
        }
        // Seen from behind, the corners go round the other way, and the box would show mirrored. Facing the
        // camera, they go clockwise on the view, whose y runs down, so their signed area is more than 0
        let area = 0;
        for (let i = 0; i < 4; i++) {
            const next = (i + 1) % 4;
            area += corners[i * 2] * corners[next * 2 + 1] - corners[next * 2] * corners[i * 2 + 1];
        }
        return area > 0;
    }

    /** The transform that lands the entry's box on the projected corners. The box is the entry's play area, in its own pixels. */
    function transformFor(entry: LiveEntry): string | undefined {
        let isChanged = entry.width !== transformedWidth || entry.height !== transformedHeight;
        for (let i = 0; i < 8 && !isChanged; i++) isChanged = corners[i] !== transformedCorners[i];
        if (!isChanged) return transform;
        transformedCorners.set(corners);
        transformedWidth = entry.width;
        transformedHeight = entry.height;
        transform = computeQuadTransform({ width: entry.width, height: entry.height, corners });
        return transform;
    }

    function writeStyle(element: HTMLElement, shownTransform: string | undefined, isReceivingPointer: boolean): void {
        if (shownTransform !== undefined && shownTransform !== placedTransform) {
            placedTransform = shownTransform;
            element.style.transform = shownTransform;
        }
        const visibility = shownTransform === undefined ? 'hidden' : 'visible';
        if (visibility !== placedVisibility) {
            placedVisibility = visibility;
            element.style.visibility = visibility;
        }
        const pointer = isReceivingPointer ? 'auto' : 'none';
        if (pointer !== placedPointer) {
            placedPointer = pointer;
            element.style.pointerEvents = pointer;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far in front of the camera a corner must be to be projected, in metres. */
const NEAR = 0.05;

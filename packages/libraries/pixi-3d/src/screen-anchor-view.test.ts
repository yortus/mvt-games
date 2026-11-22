import { Camera3D, Container3D } from '@pixi/3d';
import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { refreshView, setRefresh } from '@mvtjs/utils';
import { ScreenAnchorView } from './screen-anchor-view';
import { Scene3DView } from './scene-3d-view';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScreenAnchorView', () => {
    it('sits over its point as this frame\'s camera sees it, and hides while the point is behind the camera', () => {
        const point = { x: 0, y: 0, z: 0 };
        const { stage, camera, anchor } = createScene(() => point);

        refreshView(stage);
        // The middle of a 200 by 100 view placed at (50, 20)
        expect(anchor.x).toBeCloseTo(150);
        expect(anchor.y).toBeCloseTo(70);
        expect(anchor.visible).toBe(true);

        // The anchor is placed after the scene refreshes, so it follows a camera that moved in the same refresh
        let cameraX = 0;
        moveCameraInRefresh(camera, () => cameraX);
        cameraX = 4;
        refreshView(stage);
        expect(anchor.x).toBeLessThan(150);

        point.z = 20;
        refreshView(stage);
        expect(anchor.visible).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function createScene(point: () => { x: number; y: number; z: number }) {
    const camera = new Camera3D({ z: 10 });
    const scene = new Container3D({ children: [camera] });
    const view = Scene3DView({ scene, width: 200, height: 100 });
    view.position.set(50, 20);
    const anchor = ScreenAnchorView({ scene: view, point, content: new Container() });
    const stage = new Container({ children: [view, anchor] });
    return { stage, camera, anchor };
}

/** Moves the camera along x from a node in the scene, in the scene's refresh, as a camera view does. */
function moveCameraInRefresh(camera: Camera3D, x: () => number): void {
    const mover = new Container3D();
    camera.parent?.addChild(mover);
    setRefresh(mover, () => {
        camera.x = x();
    });
}

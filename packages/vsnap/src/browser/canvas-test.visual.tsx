// These are the visual test harness's own tests. Each one checks one case
// of rendering a Pixi or three.js view to an image.
import { Container, Graphics, Text } from 'pixi.js';
import { AmbientLight, DirectionalLight, Group, Mesh, MeshStandardMaterial, Object3D, PerspectiveCamera, TorusKnotGeometry } from 'three';
import { afterAll, beforeAll, describe } from 'vitest';
import { canvasTest } from './visual-test';
import { setViewHooks } from './view-hooks';

const SMOOTH = { artStyle: 'smooth' } as const;

describe('canvasTest', () => {
    canvasTest('framed by its bounds', SMOOTH, () => new Graphics().circle(0, 0, 30).fill(0x5bd1ff));

    canvasTest('placed by its own position', SMOOTH, () => {
        const view = new Graphics().rect(0, 0, 60, 20).fill(0xffe45c);
        view.position.set(400, 300);
        return view;
    });

    canvasTest('at a fixed size', { width: 100, height: 60, artStyle: 'smooth' }, () => new Graphics().rect(10, 10, 40, 40).fill(0xff4f8b));

    // By default, a view is drawn as pixel art is, with hard edges and whole pixels.
    canvasTest('pixel art', () => new Graphics().circle(20, 20, 16).fill(0x2fd27a));

    // A smooth view over the size budget (500,000 pixels) is drawn at half
    // resolution to fit it.
    canvasTest('smooth, over the budget', SMOOTH, () => new Graphics().roundRect(0, 0, 1200, 600, 48).fill(0x5bd1ff).circle(600, 300, 200).fill(0xff4f8b));

    canvasTest('canvas text', SMOOTH, () => new Text({ text: 'SPIN 1,250', style: { fontFamily: '"Segoe UI", sans-serif', fontSize: 24, fontWeight: '900', fill: 0xffffff } }));

    // A project's prepare hook runs after the pose, as a refresh step would.
    // Without it, the bar would have no width, and the knot would face the
    // camera square on.
    describe('with a prepare hook', () => {
        beforeAll(() => setViewHooks({
            prepare: (view) => {
                if (view instanceof Object3D) view.rotation.y = 0.8;
                else if (view instanceof Container && view.label === 'bar') view.addChild(new Graphics().rect(0, 0, 42, 12).fill(0xffffff));
            },
        }));
        afterAll(() => setViewHooks({}));

        canvasTest('a Pixi view', SMOOTH, () => new Container({ label: 'bar' }));
        canvasTest('a three.js view', { width: 200, height: 150, camera: createKnotCamera }, () => createKnot());
    });

    describe('three.js', () => {
        canvasTest('lit by its own lights, with the camera given', { width: 200, height: 150, camera: createKnotCamera }, () => createKnot());

        // A three.js image is always antialiased. So over the size budget, it
        // is drawn at half resolution, as a smooth Pixi view is.
        canvasTest('over the budget', { width: 1200, height: 600, camera: createKnotCamera, background: 0x15102b }, () => createKnot());
    });
});

function createKnot(): Group {
    const group = new Group();
    const light = new DirectionalLight(0xffffff, 2);
    light.position.set(2, 3, 4);
    group.add(new Mesh(new TorusKnotGeometry(1, 0.32, 96, 16), new MeshStandardMaterial({ color: 0x2fd27a, roughness: 0.4 })));
    group.add(new AmbientLight(0xffffff, 0.4), light);
    return group;
}

function createKnotCamera(): PerspectiveCamera {
    const camera = new PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 6);
    return camera;
}

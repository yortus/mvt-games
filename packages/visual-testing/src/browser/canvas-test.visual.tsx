// These are the visual test harness's own tests. Each one checks one case
// that a Pixi or three.js picture covers.
import { Container, Graphics, Text } from 'pixi.js';
import { AmbientLight, DirectionalLight, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, TorusKnotGeometry } from 'three';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { describe } from 'vitest';
import { advanceTime } from './advance-time';
import { canvasTest } from './visual-test';

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

    canvasTest('after time passes', SMOOTH, async () => {
        // The bar grows in its update step, so its width is presentation state.
        const bar = new Graphics();
        let width = 10;
        const view = new Container();
        view.addChild(bar);
        setUpdate(view, (deltaMs) => {
            width += deltaMs / 10;
            bar.clear().rect(0, 0, width, 12).fill(0xffffff);
        });
        await advanceTime({ views: [view], totalMs: 320 });
        return view;
    });

    describe('three.js', () => {
        canvasTest('lit by its own lights, with the camera given', { width: 200, height: 150, camera: createKnotCamera }, () => createKnot());

        // A three.js view is refreshed before it is drawn, and advanced like any view.
        canvasTest('after time passes', { width: 200, height: 150, camera: createKnotCamera }, async () => {
            const view = createKnot();
            let turned = 0;
            setUpdate(view, (deltaMs) => {
                turned += deltaMs / 1000;
            });
            setRefresh(view, () => {
                view.rotation.y = turned;
            });
            await advanceTime({ views: [view], totalMs: 800 });
            return view;
        });

        // A three.js picture is always antialiased. So over the size budget, it
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

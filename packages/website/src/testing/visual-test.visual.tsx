// The harness's own visual tests: what a Pixi or three.js picture covers, one case each.
import { Container, Graphics, Text } from 'pixi.js';
import { AmbientLight, DirectionalLight, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, TorusKnotGeometry } from 'three';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { describe } from 'vitest';
import { advanceTime, visualTest } from '#testing';

const SMOOTH = { artStyle: 'smooth' } as const;

describe('visualTest', () => {
    visualTest('framed by its bounds', () => new Graphics().circle(0, 0, 30).fill(0x5bd1ff), SMOOTH);

    visualTest('placed by its own position', () => {
        const view = new Graphics().rect(0, 0, 60, 20).fill(0xffe45c);
        view.position.set(400, 300);
        return view;
    }, SMOOTH);

    visualTest('at a fixed size', () => new Graphics().rect(10, 10, 40, 40).fill(0xff4f8b), { width: 100, height: 60, artStyle: 'smooth' });

    // Drawn as pixel art is, by default: hard edges, whole pixels
    visualTest('pixel art', () => new Graphics().circle(20, 20, 16).fill(0x2fd27a));

    // A smooth view over the size budget (500,000 pixels) is drawn at half resolution to fit it
    visualTest('smooth, over the budget', () => new Graphics().roundRect(0, 0, 1200, 600, 48).fill(0x5bd1ff).circle(600, 300, 200).fill(0xff4f8b), SMOOTH);

    visualTest('canvas text', () => new Text({ text: 'SPIN 1,250', style: { fontFamily: '"Segoe UI", sans-serif', fontSize: 24, fontWeight: '900', fill: 0xffffff } }), SMOOTH);

    visualTest('after time passes', async () => {
        // A bar that grows in its update step: presentation state
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
    }, SMOOTH);

    describe('three.js', () => {
        visualTest('lit by its own lights, with the camera given', () => createKnot(), { width: 200, height: 150, camera: createKnotCamera });

        // Refreshed before it is drawn, and advanced like any view
        visualTest('after time passes', async () => {
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
        }, { width: 200, height: 150, camera: createKnotCamera });

        // Always antialiased, so over the size budget it is drawn at half resolution, as a smooth Pixi view is
        visualTest('over the budget', () => createKnot(), { width: 1200, height: 600, camera: createKnotCamera, background: 0x15102b });
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

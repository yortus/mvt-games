import { Color, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { createPointerPicker, destroyObject } from '@mvtjs/three';
import { destroyElement } from '@mvtjs/html';
import { defineElementLoader, type ElementEntrySession } from '@mvtjs/site-kit/entry-types';
import { createDemoModel } from '../models';
import { DemoView } from '../views';
import '../boids-3d.css';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns how to start the flock in 3D, which has no assets to load: the boids
 * demo's model, drawn with three.js through the three.js JSX runtime, with an
 * HTML panel of settings beside it through the HTML one. Two views of one
 * model, on two renderers.
 */
export const load = defineElementLoader(async () => {
    return {
        kind: 'element',
        thumbnailAdvanceMs: 2000,
        start({ element }): ElementEntrySession {
            element.classList.add('boids-3d');
            const canvas = document.createElement('canvas');
            element.append(canvas);

            const renderer = new WebGLRenderer({ canvas, antialias: true });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            const scene = new Scene();
            scene.background = new Color(0x0d1117);
            const camera = new PerspectiveCamera(50, 1, 0.1, 1000);

            const model = createDemoModel({
                flock: {
                    arenaWidth: 100,
                    arenaHeight: 82,
                    boidCount: 200,
                    separation: 3.0,
                    alignment: 0.5,
                    cohesion: 3.0,
                    wander: 9.0,
                    visionAngle: 4.0,
                    maxSpeed: 20,
                    minSpeed: 5,
                    perceptionRadius: 16,
                },
            });
            const view = DemoView({ model, scene, camera });
            element.append(view);
            const picker = createPointerPicker({ domElement: canvas, camera: () => camera, scene });

            const resizeObserver = new ResizeObserver(fit);
            resizeObserver.observe(element);
            fit();

            return {
                views: [scene, view],
                update(deltaMs: number): void {
                    model.update(deltaMs);
                },
                render(): void {
                    renderer.render(scene, camera);
                },
                destroy(): void {
                    resizeObserver.disconnect();
                    picker.dispose();
                    destroyObject(scene);
                    destroyElement(view);
                    renderer.dispose();
                    // `dispose` keeps the WebGL context until it is collected; a browser allows only so many
                    renderer.forceContextLoss();
                    canvas.remove();
                    element.classList.remove('boids-3d');
                },
            };

            /** The scene fills the element, the camera's view widening or narrowing to match. */
            function fit(): void {
                const width = element.clientWidth;
                const height = element.clientHeight;
                if (width === 0 || height === 0) return;
                renderer.setSize(width, height, false);
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
            }
        },
    };
});

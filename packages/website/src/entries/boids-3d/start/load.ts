import { Color, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { createPointerPicker, destroyObject, setRefresh, setUpdate } from '@mvtjs/three';
import { destroyElement } from '@mvtjs/html';
import type { ElementEntrySession, ElementEntryStarter } from '../../../entry-types';
import { createFlockModel } from '../../boids';
import { FlockPanelView, FlockView } from '../views';
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
export async function load(): Promise<ElementEntryStarter> {
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
            scene.add(OrbitingCameraView({ camera }));

            const model = createFlockModel({
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
            });
            scene.add(FlockView({ model }));
            const picker = createPointerPicker({ domElement: canvas, camera: () => camera, scene });

            const panel = FlockPanelView({ model });
            element.append(panel);

            const resizeObserver = new ResizeObserver(fit);
            resizeObserver.observe(element);
            fit();

            return {
                views: [scene, panel],
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
                    destroyElement(panel);
                    renderer.dispose();
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
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface OrbitingCameraViewBindings {
    camera: PerspectiveCamera;
}

/**
 * The camera, circling the arena slowly: presentation of the page's own, not
 * the model's, so it pauses with the rest of the views.
 */
function OrbitingCameraView(bindings: OrbitingCameraViewBindings): PerspectiveCamera {
    const { camera } = bindings;
    let orbitAngle = 0;
    setUpdate(camera, (deltaMs) => {
        orbitAngle += deltaMs * ORBIT_RADIANS_PER_MS;
    });
    setRefresh(camera, () => {
        camera.position.set(Math.sin(orbitAngle) * ORBIT_RADIUS, ORBIT_HEIGHT, Math.cos(orbitAngle) * ORBIT_RADIUS);
        camera.lookAt(0, 0, 0);
    });
    return camera;
}

const ORBIT_RADIUS = 95;
const ORBIT_HEIGHT = 70;
const ORBIT_RADIANS_PER_MS = 0.00006;

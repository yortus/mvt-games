import { type Mesh, PerspectiveCamera, Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { createPointerPicker, type PointerLike, tickScene } from '../../three-mvt';
import { createFlockModel } from '../boids';
import { FlockView } from './flock-view';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup() {
    const model = createFlockModel({
        arenaWidth: 100,
        arenaHeight: 82,
        boidCount: 40,
        separation: 3,
        alignment: 0.5,
        cohesion: 3,
        wander: 9,
        visionAngle: 4,
        maxSpeed: 20,
        minSpeed: 5,
        perceptionRadius: 16,
        seed: 1,
    });
    const scene = new Scene();
    scene.add(FlockView({ model }));
    const frame = (): void => {
        model.update(16);
        tickScene({ root: scene, deltaMs: 16 });
    };
    frame();
    // The view's root group, then its list of boids, the last of its children
    const boids = (): Mesh[] => scene.children[0].children[3].children.filter((c) => c.visible) as Mesh[];
    return { model, scene, frame, boids };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Runs in Node: the view needs no WebGL, only the renderer that draws it does.
describe('FlockView', () => {
    it('puts a mesh where each boid is, facing its heading, on the flat arena', () => {
        const t = setup();

        const boid = t.model.boids[0];
        const mesh = t.boids()[0];
        expect(t.boids()).toHaveLength(40);
        expect(mesh.position.x).toBeCloseTo(boid.position.x - 50);
        expect(mesh.position.z).toBeCloseTo(boid.position.y - 41);
        expect(mesh.rotation.y).toBeCloseTo(-Math.atan2(boid.vy, boid.vx));
    });

    it('follows the flock as boids are added and removed', () => {
        const t = setup();

        t.model.boidCount = 60;
        t.frame();
        expect(t.boids()).toHaveLength(60);

        t.model.boidCount = 25;
        t.frame();
        expect(t.boids()).toHaveLength(25);
    });

    it('adds boids when the ground is clicked, through the pointer picker', () => {
        const t = setup();
        const camera = new PerspectiveCamera(50, 1, 0.1, 1000);
        // Straight down: with the default up vector along the view, `lookAt` has no answer
        camera.position.set(0, 100, 0);
        camera.up.set(0, 0, -1);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        t.scene.updateMatrixWorld();
        const listeners: Record<string, (event: PointerLike) => void> = {};
        createPointerPicker({
            domElement: {
                addEventListener: (type, listener) => {
                    listeners[type] = listener;
                },
                removeEventListener: () => {},
                getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
            },
            camera: () => camera,
            scene: t.scene,
        });

        // Near a corner of the arena, clear of the flock in its middle
        const count = t.model.boidCount;
        listeners.click({ clientX: 12, clientY: 12 });

        expect(t.model.boidCount).toBeGreaterThan(count);
    });
});

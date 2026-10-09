import { PerspectiveCamera } from 'three';
import { describe } from 'vitest';
import { advanceTime, type ThreePictureOptions, canvasTest } from '@mvtjs/visual-testing';
import { createFlockModel, type FlockModel } from '../../boids';
import { FlockView } from './flock-view';

// The camera looks from above and to one side, where the page's orbiting
// camera starts. The view brings its own lights.
const PICTURE: ThreePictureOptions = { width: 480, height: 300, camera: createOrbitStartCamera, background: 0x0d1117 };

describe('FlockView', () => {
    canvasTest('as the flock starts', PICTURE, () => FlockView({ model: createFlock() }));

    // By now the boids have formed groups that head the same way.
    canvasTest('two seconds in', PICTURE, async () => {
        const model = createFlock();
        const view = FlockView({ model });
        await advanceTime({ models: [model], views: [view], totalMs: 2000 });
        return view;
    });
});

function createFlock(): FlockModel {
    return createFlockModel({
        arenaWidth: 100,
        arenaHeight: 82,
        boidCount: 120,
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
}

function createOrbitStartCamera(): PerspectiveCamera {
    const camera = new PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 70, 95);
    camera.lookAt(0, 0, 0);
    return camera;
}

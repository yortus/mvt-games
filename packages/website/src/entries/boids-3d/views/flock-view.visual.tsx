import { PerspectiveCamera } from 'three';
import { describe } from 'vitest';
import { advanceTime, type ThreePictureOptions, visualTest } from '#testing';
import { createFlockModel, type FlockModel } from '../../boids';
import { FlockView } from './flock-view';

// From above and to one side, where the page's orbiting camera starts; the view brings its own lights
const PICTURE: ThreePictureOptions = { width: 480, height: 300, camera: orbitStartCamera, background: 0x0d1117 };

describe('FlockView', () => {
    visualTest('as the flock starts', () => FlockView({ model: flock() }), PICTURE);

    // Flocked: the boids turned into groups, heading together
    visualTest('two seconds in', async () => {
        const model = flock();
        const view = FlockView({ model });
        await advanceTime({ models: [model], views: [view], totalMs: 2000 });
        return view;
    }, PICTURE);
});

function flock(): FlockModel {
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

function orbitStartCamera(): PerspectiveCamera {
    const camera = new PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 70, 95);
    camera.lookAt(0, 0, 0);
    return camera;
}

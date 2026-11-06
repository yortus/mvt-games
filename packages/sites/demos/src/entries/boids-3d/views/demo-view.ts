import type { PerspectiveCamera, Scene } from 'three';
import type { DemoModel } from '../models';
import { FlockPanelView } from './flock-panel-view';
import { FlockView } from './flock-view';
import { OrbitingCameraView } from './orbiting-camera-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DemoViewBindings {
    readonly model: DemoModel;
    /** The three.js scene, which the entry draws. The flock and the camera are added to it. */
    readonly scene: Scene;
    /** The camera the entry draws the scene with. */
    readonly camera: PerspectiveCamera;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The whole demo, on two renderers. A view of one renderer can't hold a view
 * of another, so this adds the three.js views to the entry's scene, and
 * returns the HTML panel of settings. The entry ticks both.
 */
export function DemoView(bindings: DemoViewBindings): Element {
    const { model, scene, camera } = bindings;
    const { flock } = model;
    scene.add(OrbitingCameraView({ camera }));
    scene.add(FlockView({ model: flock }));

    return FlockPanelView({
        boidCount: () => flock.boidCount,
        separation: () => flock.separation,
        alignment: () => flock.alignment,
        cohesion: () => flock.cohesion,
        wander: () => flock.wander,
        onBoidCountSlid: (count) => { flock.boidCount = count; },
        onSeparationSlid: (weight) => { flock.separation = weight; },
        onAlignmentSlid: (weight) => { flock.alignment = weight; },
        onCohesionSlid: (weight) => { flock.cohesion = weight; },
        onWanderSlid: (weight) => { flock.wander = weight; },
    });
}

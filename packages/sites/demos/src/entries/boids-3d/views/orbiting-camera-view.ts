import type { PerspectiveCamera } from 'three';
import { setRefresh, setUpdate } from '@mvtjs/three';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface OrbitingCameraViewBindings {
    camera: PerspectiveCamera;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The camera, circling the arena slowly: presentation of the page's own, not
 * the model's, so it pauses with the rest of the views.
 */
export function OrbitingCameraView(bindings: OrbitingCameraViewBindings): PerspectiveCamera {
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

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const ORBIT_RADIUS = 95;
const ORBIT_HEIGHT = 70;
const ORBIT_RADIANS_PER_MS = 0.00006;

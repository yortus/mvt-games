import { Color, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { createPointerPicker, refreshView, updateView } from '@mvtjs/three';
import { createFlockModel } from '../boids';
import { FlockPanelView } from './flock-panel-view';
import { FlockView } from './flock-view';

// The flock-in-3D demo page: the boids demo's model, drawn with three.js
// through the three.js JSX runtime, with an HTML panel of settings beside it
// through the HTML one: two views of one model, on two renderers. Each frame
// runs the MVT way: the model updates, then `updateView` and `refreshView`
// call both views' methods, then three renders.

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new Scene();
scene.background = new Color(0x0d1117);
const camera = new PerspectiveCamera(50, 1, 0.1, 1000);

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
createPointerPicker({ domElement: canvas, camera: () => camera, scene });

const panel = FlockPanelView({ model });
document.body.append(panel);

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

// The camera circles the arena slowly: the page's own presentation, not the
// model's, advanced by the same time step.
let orbitAngle = 0;
let lastTime: number | undefined;

resize();
window.addEventListener('resize', resize);
renderer.setAnimationLoop((time: number) => {
    // A long gap (a hidden tab) is clamped rather than simulated
    const deltaMs = lastTime === undefined ? 0 : Math.min(time - lastTime, MAX_STEP_MS);
    lastTime = time;

    // The model, then the views of both renderers: the three.js scene, and
    // the settings panel's elements. `updateView` and `refreshView` serve both.
    model.update(deltaMs);
    updateView(scene, deltaMs);
    updateView(panel, deltaMs);
    refreshView(scene);
    refreshView(panel);

    orbitAngle += deltaMs * ORBIT_RADIANS_PER_MS;
    camera.position.set(Math.sin(orbitAngle) * ORBIT_RADIUS, ORBIT_HEIGHT, Math.cos(orbitAngle) * ORBIT_RADIUS);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
});

function resize(): void {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const MAX_STEP_MS = 50;
const ORBIT_RADIUS = 95;
const ORBIT_HEIGHT = 70;
const ORBIT_RADIANS_PER_MS = 0.00006;

import { Color, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { refreshView, updateView } from '@mvtjs/three';
import type { ThreeProject, ThreeStartOptions } from '../project-api';
import { DEFAULT_BACKGROUND, fitToWindow } from './fit-to-window';
import type { RendererHost } from './run-sandbox';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Makes a WebGL renderer of the project's size, scaled to fit the sandbox,
 * a scene for the project's views, and a camera 5 units back from the
 * origin, looking at it.
 */
export function createThreeHost(project: ThreeProject): RendererHost<Omit<ThreeStartOptions, 'sound'>> {
    const { width, height } = project;
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height, false);
    document.body.append(renderer.domElement);
    fitToWindow(renderer.domElement, width, height);

    const scene = new Scene();
    scene.background = new Color(project.background ?? DEFAULT_BACKGROUND);
    const camera = new PerspectiveCamera(CAMERA_FOV, width / height, 0.1, 1000);
    camera.position.z = 5;
    return {
        startOptions: { scene, camera, width, height },
        update: (deltaMs) => updateView(scene, deltaMs),
        refresh: () => refreshView(scene),
        render: () => renderer.render(scene, camera),
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The camera's vertical field of view, in degrees. */
const CAMERA_FOV = 50;

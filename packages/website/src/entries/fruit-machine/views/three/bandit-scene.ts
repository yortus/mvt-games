import { Color, NeutralToneMapping, type PerspectiveCamera, PMREMGenerator, type Scene, type WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DressBanditSceneOptions {
    readonly scene: Scene;
    readonly renderer: WebGLRenderer;
}

export interface FrameBanditCameraOptions {
    /** A perspective camera whose aspect ratio already matches the picture. */
    readonly camera: PerspectiveCamera;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Sets up the scene that the bandit is drawn in, and its renderer. The
 * bandit's paint and chrome shine by reflecting a room. The bandit's own
 * lights add only a key light and shadowed sides. The renderer's tone
 * mapping keeps the paint's hue as its highlights brighten. The page does
 * this once. The visual tests do it once per page too, and reuse the scene
 * for each picture.
 */
export function dressBanditScene(options: DressBanditSceneOptions): void {
    const { scene, renderer } = options;
    renderer.toneMapping = NeutralToneMapping;
    scene.background = new Color(0x15102b);
    // The paint and chrome reflect a room. Without one, nothing shines.
    const environment = new PMREMGenerator(renderer);
    scene.environment = environment.fromScene(new RoomEnvironment(), ENVIRONMENT_BLUR).texture;
    // The room's light is dimmed, because at full strength it washes the paint out.
    scene.environmentIntensity = ENVIRONMENT_INTENSITY;
    environment.dispose();
}

/**
 * Points the camera at the bandit, framing its lever too, for the camera's
 * aspect ratio. A narrow view would crop the cabinet's sides, so for one the
 * camera steps back.
 */
export function frameBanditCamera(options: FrameBanditCameraOptions): void {
    const { camera } = options;
    camera.fov = FIELD_OF_VIEW;
    camera.position.set(CAMERA_X, CAMERA_HEIGHT, CAMERA_DISTANCE * Math.max(1, 0.9 / camera.aspect));
    camera.lookAt(CAMERA_X, LOOK_AT_HEIGHT, 0);
    camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The room's reflections are blurred a little, so the shine looks like gloss rather than a mirror. */
const ENVIRONMENT_BLUR = 0.04;
const ENVIRONMENT_INTENSITY = 0.45;
const FIELD_OF_VIEW = 30;
/** The camera sits a little right of the cabinet's middle, to frame its lever too. */
const CAMERA_X = 0.4;
const CAMERA_HEIGHT = 4.6;
const CAMERA_DISTANCE = 19;
const LOOK_AT_HEIGHT = 3.75;

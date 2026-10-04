import { Application } from 'pixi.js';
import { Color, NeutralToneMapping, PerspectiveCamera, PMREMGenerator, Scene, WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { createPointerPicker } from '@mvtjs/three';
import { assert } from '@mvtjs/utils';
import { createFruitMachineModel } from './models';
import { BanditView, ControlPanelView, loadSymbolArt, PixiMachineView, TerminalView } from './views';
import { DRAG_THRESHOLD_PX, SCREEN_HEIGHT, SCREEN_WIDTH } from './views';

// The fruit machine page: one model, four views of it, in four quadrants.
// A Pixi machine, a three.js one-armed bandit, an HTML control panel and a
// text terminal, on three renderers, all following and playing the same
// machine. None of them knows the others exist. Each frame runs the MVT way,
// once for all four: the model updates, then `updateView` and `refreshView`
// visit every view (they are the same functions for every renderer), then
// Pixi and three.js draw.

void main();

async function main(): Promise<void> {
    const art = await loadSymbolArt();
    // The page picks the seed; the model's random numbers stay its own
    const model = createFruitMachineModel({ seed: Math.floor(Math.random() * 0x7fffffff) });

    // --- Pixi.js: the modern machine -------------------------------------------
    const pixiHost = quadrant('pixi');
    const pixi = new Application();
    // Not started: this page's loop drives it, with everything else
    await pixi.init({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, background: 0x2a1766, antialias: true, autoStart: false });
    pixi.canvas.classList.add('quadrant-canvas');
    pixiHost.append(pixi.canvas);
    pixi.stage.addChild(PixiMachineView({ model, art }));

    // --- three.js: the one-armed bandit -------------------------------------
    const threeHost = quadrant('three');
    const threeCanvas = document.createElement('canvas');
    threeCanvas.classList.add('quadrant-canvas', 'quadrant-fill');
    threeHost.append(threeCanvas);
    const renderer = new WebGLRenderer({ canvas: threeCanvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Tone mapping that keeps the paint's hue as its highlights brighten
    renderer.toneMapping = NeutralToneMapping;
    const scene = new Scene();
    scene.background = new Color(0x15102b);
    // A room for the paint and chrome to reflect: without one, nothing shines
    const environment = new PMREMGenerator(renderer);
    scene.environment = environment.fromScene(new RoomEnvironment(), ENVIRONMENT_BLUR).texture;
    // Dimmed: at full strength the room's light washes the paint out
    scene.environmentIntensity = ENVIRONMENT_INTENSITY;
    environment.dispose();
    const camera = new PerspectiveCamera(30, 1, 0.1, 100);
    scene.add(BanditView({ model, art, dragSurface: threeCanvas }));
    // A drag turns the cabinet; the picker drops the click that ends one, so letting go over the lever doesn't pull it
    createPointerPicker({ domElement: threeCanvas, camera: () => camera, scene, dragThreshold: DRAG_THRESHOLD_PX });

    // --- HTML: the control panel and the terminal ---------------------------
    const panel = ControlPanelView({ model, art });
    quadrant('panel').append(panel);
    const terminal = TerminalView({ model });
    quadrant('terminal').append(terminal);

    // --- Sizing -------------------------------------------------------------
    new ResizeObserver(() => fitPixi(pixi, pixiHost)).observe(pixiHost);
    new ResizeObserver(() => fitThree(renderer, camera, threeHost)).observe(threeHost);

    // --- The loop -----------------------------------------------------------
    let lastTime: number | undefined;
    requestAnimationFrame(frame);

    function frame(time: number): void {
        // A long gap (a hidden tab) is clamped rather than simulated
        const deltaMs = lastTime === undefined ? 0 : Math.min(time - lastTime, MAX_STEP_MS);
        lastTime = time;

        model.update(deltaMs);
        updateView(pixi.stage, deltaMs);
        updateView(scene, deltaMs);
        updateView(panel, deltaMs);
        updateView(terminal, deltaMs);
        refreshView(pixi.stage);
        refreshView(scene);
        refreshView(panel);
        refreshView(terminal);
        pixi.render();
        renderer.render(scene, camera);

        requestAnimationFrame(frame);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const MAX_STEP_MS = 50;
/** How soft the room's reflections are: a little, so the shine reads as gloss, not a mirror. */
const ENVIRONMENT_BLUR = 0.04;
const ENVIRONMENT_INTENSITY = 0.45;
/** A little right of the cabinet's middle, to frame its lever too. */
const CAMERA_X = 0.4;
const CAMERA_HEIGHT = 4.6;
const CAMERA_DISTANCE = 19;
const LOOK_AT_HEIGHT = 3.75;

function quadrant(name: string): HTMLElement {
    const host = document.querySelector(`[data-quadrant="${name}"] .quadrant-body`) as HTMLElement | null;
    assert(host !== null, () => `The page has no ${name} quadrant`);
    return host;
}

/** The Pixi machine keeps its design size, scaled to fit its quadrant, drawn at the screen's pixel density. */
function fitPixi(pixi: Application, host: HTMLElement): void {
    const scale = Math.min(host.clientWidth / SCREEN_WIDTH, host.clientHeight / SCREEN_HEIGHT);
    if (!(scale > 0)) return;
    pixi.renderer.resize(SCREEN_WIDTH, SCREEN_HEIGHT, scale * (window.devicePixelRatio || 1));
    pixi.canvas.style.width = `${Math.floor(SCREEN_WIDTH * scale)}px`;
    pixi.canvas.style.height = `${Math.floor(SCREEN_HEIGHT * scale)}px`;
}

/** The three.js scene fills its quadrant, the camera's view widening or narrowing to match. */
function fitThree(renderer: WebGLRenderer, camera: PerspectiveCamera, host: HTMLElement): void {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // A narrow quadrant would crop the cabinet's sides: step back instead
    camera.position.set(CAMERA_X, CAMERA_HEIGHT, CAMERA_DISTANCE * Math.max(1, 0.9 / camera.aspect));
    camera.lookAt(CAMERA_X, LOOK_AT_HEIGHT, 0);
    camera.updateProjectionMatrix();
}

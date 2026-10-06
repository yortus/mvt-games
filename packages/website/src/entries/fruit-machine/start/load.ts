import { Application } from 'pixi.js';
import { Color, NeutralToneMapping, PerspectiveCamera, PMREMGenerator, Scene, WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createPointerPicker, destroyObject } from '@mvtjs/three';
import { destroyElement } from '@mvtjs/html';
import type { ElementEntrySession, ElementEntryStarter } from '../../../entry-types';
import { createFruitMachineModel } from '../models';
import { BanditView, ControlPanelView, loadSymbolArt, PixiMachineView, TerminalView } from '../views';
import { DRAG_THRESHOLD_PX, SCREEN_HEIGHT, SCREEN_WIDTH } from '../views';
import '../fruit-machine.css';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Loads the symbol art, and returns how to start the fruit machine: one model,
 * four views of it, in four quadrants. A Pixi machine, a three.js one-armed
 * bandit, an HTML control panel and a text terminal, on three renderers, all
 * following and playing the same machine. None of them knows the others
 * exist. The host runs each frame the MVT way, once for all four: the model
 * updates, then `updateView` and `refreshView` visit every view (they are the
 * same functions for every renderer), then Pixi and three.js draw.
 */
export async function load(): Promise<ElementEntryStarter> {
    const art = await loadSymbolArt();

    return {
        kind: 'element',
        thumbnailAdvanceMs: 500,
        start({ element }): ElementEntrySession {
            element.classList.add('fruit-machine');
            element.innerHTML = QUADRANTS_HTML;

            // The page picks the seed; the model's random numbers stay its own
            const model = createFruitMachineModel({ seed: Math.floor(Math.random() * 0x7fffffff) });

            // --- Pixi.js: the modern machine ---------------------------------
            // Not started: the host's loop drives it, with everything else. Its
            // stage exists at once; it draws once its renderer is ready.
            const pixiHost = quadrant(element, 'pixi');
            const pixi = new Application();
            pixi.stage.addChild(PixiMachineView({ model, art }));
            let isPixiReady = false;
            let isDestroyed = false;
            void pixi.init({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, background: 0x2a1766, antialias: true, autoStart: false })
                .then(() => {
                    if (isDestroyed) {
                        pixi.destroy(true, { children: true });
                        return;
                    }
                    pixi.canvas.classList.add('quadrant-canvas');
                    // Pixi sets none, but the machine is only tapped: an up or down swipe is left to scroll the stacked quadrants
                    pixi.canvas.style.touchAction = 'pan-y';
                    pixiHost.append(pixi.canvas);
                    isPixiReady = true;
                    fitPixi();
                });

            // --- three.js: the one-armed bandit ------------------------------
            const threeHost = quadrant(element, 'three');
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
            const picker = createPointerPicker({ domElement: threeCanvas, camera: () => camera, scene, dragThreshold: DRAG_THRESHOLD_PX });

            // --- HTML: the control panel and the terminal --------------------
            const panel = ControlPanelView({ model, art });
            quadrant(element, 'panel').append(panel);
            const terminal = TerminalView({ model });
            quadrant(element, 'terminal').append(terminal);

            // --- Sizing ------------------------------------------------------
            const pixiObserver = new ResizeObserver(fitPixi);
            pixiObserver.observe(pixiHost);
            const threeObserver = new ResizeObserver(fitThree);
            threeObserver.observe(threeHost);
            fitThree();

            return {
                views: [pixi.stage, scene, panel, terminal],
                update(deltaMs: number): void {
                    model.update(deltaMs);
                },
                render(): void {
                    if (isPixiReady) pixi.render();
                    renderer.render(scene, camera);
                },
                destroy(): void {
                    isDestroyed = true;
                    pixiObserver.disconnect();
                    threeObserver.disconnect();
                    picker.dispose();
                    // Not ready yet: destroyed once it is
                    if (isPixiReady) pixi.destroy(true, { children: true });
                    destroyObject(scene);
                    renderer.dispose();
                    // `dispose` keeps the WebGL context until it is collected; a browser allows only so many
                    renderer.forceContextLoss();
                    destroyElement(panel);
                    destroyElement(terminal);
                    element.replaceChildren();
                    element.classList.remove('fruit-machine');
                },
            };

            /** The Pixi machine keeps its design size, scaled to fit its quadrant, drawn at the screen's pixel density. */
            function fitPixi(): void {
                if (!isPixiReady) return;
                const scale = Math.min(pixiHost.clientWidth / SCREEN_WIDTH, pixiHost.clientHeight / SCREEN_HEIGHT);
                if (!(scale > 0)) return;
                pixi.renderer.resize(SCREEN_WIDTH, SCREEN_HEIGHT, scale * (window.devicePixelRatio || 1));
                pixi.canvas.style.width = `${Math.floor(SCREEN_WIDTH * scale)}px`;
                pixi.canvas.style.height = `${Math.floor(SCREEN_HEIGHT * scale)}px`;
            }

            /** The three.js scene fills its quadrant, the camera's view widening or narrowing to match. */
            function fitThree(): void {
                const width = threeHost.clientWidth;
                const height = threeHost.clientHeight;
                if (width === 0 || height === 0) return;
                renderer.setSize(width, height, false);
                camera.aspect = width / height;
                // A narrow quadrant would crop the cabinet's sides: step back instead
                camera.position.set(CAMERA_X, CAMERA_HEIGHT, CAMERA_DISTANCE * Math.max(1, 0.9 / camera.aspect));
                camera.lookAt(CAMERA_X, LOOK_AT_HEIGHT, 0);
                camera.updateProjectionMatrix();
            }
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How soft the room's reflections are: a little, so the shine reads as gloss, not a mirror. */
const ENVIRONMENT_BLUR = 0.04;
const ENVIRONMENT_INTENSITY = 0.45;
/** A little right of the cabinet's middle, to frame its lever too. */
const CAMERA_X = 0.4;
const CAMERA_HEIGHT = 4.6;
const CAMERA_DISTANCE = 19;
const LOOK_AT_HEIGHT = 3.75;

/** The four quadrants, each labelled with its renderer, in the order the grid reads them. */
const QUADRANTS_HTML = `
<section class="quadrant" data-quadrant="pixi">
    <span class="quadrant-label"><b>Pixi.js</b> · the modern machine</span>
    <div class="quadrant-body"></div>
</section>
<section class="quadrant" data-quadrant="terminal">
    <span class="quadrant-label"><b>HTML</b> · the terminal</span>
    <div class="quadrant-body"></div>
</section>
<section class="quadrant" data-quadrant="panel">
    <span class="quadrant-label"><b>HTML</b> · the control panel</span>
    <div class="quadrant-body"></div>
</section>
<section class="quadrant" data-quadrant="three">
    <span class="quadrant-label"><b>Three.js</b> · drag to turn, tap the lever</span>
    <div class="quadrant-body"></div>
</section>`;

function quadrant(element: HTMLElement, name: string): HTMLElement {
    const body = element.querySelector<HTMLElement>(`[data-quadrant="${name}"] .quadrant-body`);
    if (body === null) throw new Error(`The fruit machine has no ${name} quadrant`);
    return body;
}

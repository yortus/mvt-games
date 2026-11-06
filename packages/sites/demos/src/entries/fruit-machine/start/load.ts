import { Application } from 'pixi.js';
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { createPointerPicker, destroyObject } from '@mvtjs/three';
import { destroyElement } from '@mvtjs/html';
import { defineElementLoader, type ElementEntrySession } from '@mvtjs/site-kit/entry-types';
import { createDemoModel } from '../models';
import {
    DemoView, DRAG_THRESHOLD_PX, dressBanditScene, findQuadrantBody, frameBanditCamera, loadSymbolArt, SCREEN_HEIGHT, SCREEN_WIDTH,
} from '../views';
import '../fruit-machine.css';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Loads the symbol art, and returns how to start the fruit machine: one model,
 * four views of it, in four quadrants. A Pixi machine, a three.js one-armed
 * bandit, an HTML control panel and a text terminal, on three renderers, all
 * following and playing the same machine; and a fifth view, which draws
 * nothing, for its sound. The demo's view puts them together, and this makes
 * the renderers they draw on. The host runs each frame the MVT way, once for
 * all five: the model updates, then `updateView` and `refreshView` visit
 * every view (they are the same functions for every renderer), then Pixi and
 * three.js draw.
 */
export const load = defineElementLoader(async () => {
    const art = await loadSymbolArt();

    return {
        kind: 'element',
        soundChip: 'audio80',
        thumbnailAdvanceMs: 500,
        start({ element, music, sfx }): ElementEntrySession {
            // The page picks the seed; the model's random numbers stay its own
            const model = createDemoModel({ seed: Math.floor(Math.random() * 0x7fffffff) });

            // The renderers. Pixi isn't started: the host's loop drives it, with
            // everything else. Its stage exists at once, for the views to go on.
            const pixi = new Application();
            const threeCanvas = document.createElement('canvas');
            threeCanvas.classList.add('quadrant-canvas', 'quadrant-fill');
            const renderer = new WebGLRenderer({ canvas: threeCanvas, antialias: true });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            const scene = new Scene();
            dressBanditScene({ scene, renderer });
            const camera = new PerspectiveCamera(30, 1, 0.1, 100);

            const view = DemoView({ model, art, stage: pixi.stage, scene, dragSurface: threeCanvas, music, sfx });
            element.append(view);

            // --- Pixi.js: the modern machine ---------------------------------
            // It draws once its renderer is ready
            const pixiHost = findQuadrantBody(view, 'pixi');
            let isPixiReady = false;
            let isDestroyed = false;
            const pixiReady = pixi.init({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, background: 0x2a1766, antialias: true, autoStart: false })
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
            const threeHost = findQuadrantBody(view, 'three');
            threeHost.append(threeCanvas);
            // A drag turns the cabinet; the picker drops the click that ends one, so letting go over the lever doesn't pull it
            const picker = createPointerPicker({ domElement: threeCanvas, camera: () => camera, scene, dragThreshold: DRAG_THRESHOLD_PX });

            // --- Sizing ------------------------------------------------------
            const pixiObserver = new ResizeObserver(fitPixi);
            pixiObserver.observe(pixiHost);
            const threeObserver = new ResizeObserver(fitThree);
            threeObserver.observe(threeHost);
            fitThree();

            return {
                views: [pixi.stage, scene, view],
                ready: pixiReady,
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
                    destroyElement(view);
                    element.replaceChildren();
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
                frameBanditCamera({ camera });
            }
        },
    };
});

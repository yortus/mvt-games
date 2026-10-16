// The page side of the benchmark's screenshot tests. They draw each panel on
// a Pixi canvas in the page, and Vitest's `toMatchScreenshot` takes a
// screenshot of it, as a project would without v-snap.

import { Application } from 'pixi.js';
import { measurePanel, PanelView } from './views';

/** The page's Pixi application, made by the first test that draws. */
let app: Application | undefined;

/**
 * Returns the page's canvas, with panel `index` drawn on it. The page keeps
 * one Pixi application for the tests of its file, and draws each panel in
 * place of the last.
 */
export async function drawPanel(index: number): Promise<HTMLCanvasElement> {
    app ??= await createApplication();
    const old = app.stage.removeChildren();
    for (let i = 0; i < old.length; i++) old[i].destroy({ children: true });
    const { width, height } = measurePanel(index);
    app.renderer.resize(width, height);
    app.stage.addChild(PanelView({ index }));
    app.render();
    return app.canvas;
}

/** Returns a new Pixi application, with its canvas in the page. */
async function createApplication(): Promise<Application> {
    const created = new Application();
    await created.init({
        width: 160,
        height: 100,
        background: 0x202024,
        antialias: true,
        preference: 'webgl',
        autoStart: false,
        preserveDrawingBuffer: true,
    });
    document.body.append(created.canvas);
    return created;
}

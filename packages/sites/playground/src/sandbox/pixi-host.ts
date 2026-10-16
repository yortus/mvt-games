import { Application, Container, TextureSource } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import type { PixiProject, PixiStartOptions } from '../project-api';
import { DEFAULT_BACKGROUND, fitToWindow } from './fit-to-window';
import type { RendererHost } from './run-sandbox';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Makes a Pixi application of the project's size, scaled to fit the
 * sandbox, with a container on its stage for the project's views. The
 * runner draws each frame itself, so the application's own ticker is
 * stopped.
 */
export async function createPixiHost(project: PixiProject): Promise<RendererHost<Omit<PixiStartOptions, 'sound'>>> {
    const { width, height } = project;
    const isPixelArt = project.pixelArt === true;
    if (isPixelArt) TextureSource.defaultOptions.scaleMode = 'nearest';
    const app = new Application();
    await app.init({
        width,
        height,
        background: project.background ?? DEFAULT_BACKGROUND,
        antialias: !isPixelArt,
        roundPixels: isPixelArt,
        resolution: window.devicePixelRatio,
        autoDensity: true,
        autoStart: false,
    });
    app.ticker.stop();
    document.body.append(app.canvas);
    fitToWindow(app.canvas, width, height);

    const stage = new Container();
    app.stage.addChild(stage);
    return {
        startOptions: { stage, width, height },
        update: (deltaMs) => updateView(stage, deltaMs),
        refresh: () => refreshView(stage),
        render: () => app.render(),
    };
}

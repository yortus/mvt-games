// Spike baseline: the obvious way. Draw to a canvas on the page and use Vitest's toMatchScreenshot.
import { Application, Container, Graphics, TextureSource } from 'pixi.js';
import { refreshView } from '@mvtjs/pixi';
import { page } from 'vitest/browser';
import { expect, test } from 'vitest';
import type { PixiPictureOptions } from '../harness';

let app: Promise<Application> | undefined;

export function visualTest(name: string, pose: () => Container | Promise<Container>, options: PixiPictureOptions = {}): void {
    test(name, async () => {
        const pixelArt = options.pixelArt ?? false;
        TextureSource.defaultOptions.scaleMode = pixelArt ? 'nearest' : 'linear';
        app ??= (async () => {
            const a = new Application();
            await a.init({ width: 8, height: 8, antialias: true, autoStart: false, preference: 'webgl', sharedTicker: false, preserveDrawingBuffer: true });
            a.canvas.style.cssText = 'position:absolute;left:0;top:0;';
            document.body.append(a.canvas);
            return a;
        })();
        const a = await app;
        const view = await pose();
        try {
            refreshView(view);
            let x0 = 0;
            let y0 = 0;
            let width = options.width;
            let height = options.height;
            if (width === undefined || height === undefined) {
                const b = view.getLocalBounds();
                x0 = Math.floor(b.minX) - 4;
                y0 = Math.floor(b.minY) - 4;
                width ??= Math.ceil(b.maxX) + 4 - x0;
                height ??= Math.ceil(b.maxY) + 4 - y0;
            }
            const stage = new Container();
            const holder = new Container({ x: -x0, y: -y0 });
            stage.addChild(new Graphics().rect(0, 0, width, height).fill(0x202024), holder);
            holder.addChild(view);
            a.renderer.resize(width, height);
            a.renderer.render({ container: stage });
            await expect.element(page.elementLocator(a.canvas)).toMatchScreenshot(name.replace(/[^\w.-]+/g, '_'));
            holder.removeChildren();
            stage.destroy({ children: true });
        }
        finally {
            view.destroy({ children: true });
        }
    });
}

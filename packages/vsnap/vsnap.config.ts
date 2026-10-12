// The kinds of view that vsnap's own tests pose. It runs in the test page.
// The preparing and disposing apply only to the views that test them, which
// are named for it, and leave the other views alone.
import { Graphics } from 'pixi.js';
import { type CanvasViewKind, defineVsnapConfig } from './src/browser';
import { pixiViews } from './src/pixi';
import { threeViews } from './src/three';

/**
 * A view of a kind that this file registers itself, as a project does for a
 * renderer that vsnap has no support for. It draws on a 2D canvas.
 */
export interface Sketch {
    readonly paint: (ctx: CanvasRenderingContext2D) => void;
}

/** Options of a sketch's image. */
export interface SketchOptions {
    readonly width?: number;
    readonly height?: number;
}

/** Returns whether a value is a sketch: an object that has a `paint` function. */
function isSketch(value: unknown): boolean {
    return value instanceof Object && typeof (value as Partial<Sketch>).paint === 'function';
}

/** The kind for sketches. Its `draw` returns the canvas that it drew on, which vsnap reads. */
const sketchViews: CanvasViewKind<Sketch, SketchOptions, 'sketch'> = {
    name: 'sketch',
    kind: 'canvas',
    isView: isSketch,
    draw: (view, options) => {
        const canvas = document.createElement('canvas');
        canvas.width = options.width ?? 80;
        canvas.height = options.height ?? 60;
        const ctx = canvas.getContext('2d');
        if (ctx === null) throw new Error('The browser gave no 2D canvas context.');
        ctx.fillStyle = '#202024';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        view.paint(ctx);
        return canvas;
    },
    dispose: () => {},
};

const config = defineVsnapConfig({
    views: [
        pixiViews({
            prepare: (view) => {
                if (view.label === 'bar') view.addChild(new Graphics().rect(0, 0, 42, 12).fill(0xffffff));
            },
            // Marks the bar, so that its test can tell this dispose ran.
            dispose: (view) => {
                if (view.label === 'bar') view.label = 'bar, disposed by vsnap.config.ts';
                view.destroy({ children: true });
            },
        }),
        sketchViews,
        threeViews({
            prepare: (view) => {
                if (view.name === 'turned') view.rotation.y = 0.8;
            },
        }),
    ],
    // Most of the tests pose Pixi views, as most of a project's tests would.
    defaultView: 'pixi',
});

// Gives canvasTest's types the kinds of view above, and the default view.
// The fixture's tests are in this package's TypeScript program too, so they
// are checked against this config.
declare module './src/browser' {
    interface Register {
        config: typeof config;
    }
}

export default config;

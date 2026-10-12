// These are the visual test harness's own tests. Each one checks one case
// of drawing a view on a canvas: a canvas that the pose draws, or a Pixi or
// three.js view, which this package's vsnap.config.ts registers.
import { Container, Graphics, Text } from 'pixi.js';
import { AmbientLight, DirectionalLight, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, TorusKnotGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import config, { type Sketch } from '../../vsnap.config';
import { pixiViews } from '../pixi';
import { defineVsnapConfig, loadViewKinds } from './view-kinds';
import { bindCanvasTest, canvasTest } from './visual-test';

const SMOOTH = { artStyle: 'smooth' } as const;
const KNOT = { kind: 'three', width: 200, height: 150, camera: createKnotCamera } as const;

describe('canvasTest', () => {
    canvasTest('framed by its bounds', SMOOTH, () => new Graphics().circle(0, 0, 30).fill(0x5bd1ff));

    canvasTest('placed by its own position', SMOOTH, () => {
        const view = new Graphics().rect(0, 0, 60, 20).fill(0xffe45c);
        view.position.set(400, 300);
        return view;
    });

    canvasTest('at a fixed size', { width: 100, height: 60, artStyle: 'smooth' }, () => new Graphics().rect(10, 10, 40, 40).fill(0xff4f8b));

    // By default, a view is drawn as pixel art is, with hard edges and whole pixels.
    canvasTest('pixel art', () => new Graphics().circle(20, 20, 16).fill(0x2fd27a));

    // A smooth view over the size budget (500,000 pixels) is drawn at half
    // resolution to fit it.
    canvasTest('smooth, over the budget', SMOOTH, () => new Graphics().roundRect(0, 0, 1200, 600, 48).fill(0x5bd1ff).circle(600, 300, 200).fill(0xff4f8b));

    canvasTest('canvas text', SMOOTH, () => new Text({ text: 'SPIN 1,250', style: { fontFamily: '"Segoe UI", sans-serif', fontSize: 24, fontWeight: '900', fill: 0xffffff } }));

    // A kind's prepare runs after the pose, as a refresh step would. This
    // package's vsnap.config.ts prepares the views named for it. Without it,
    // the bar would have no width, and the knot would face the camera square
    // on.
    describe('with a prepare hook', () => {
        let bar: Container | undefined;
        canvasTest('a Pixi view', SMOOTH, () => (bar = new Container({ label: 'bar' })));
        canvasTest('a three.js view', KNOT, () => {
            const knot = createKnot();
            knot.name = 'turned';
            return knot;
        });

        it('disposes of a view with its kind\'s dispose', () => {
            expect(bar?.label).toBe('bar, disposed by vsnap.config.ts');
        });
    });

    // A test that imports the project's vsnap.config.ts gets the module that
    // the page loaded, not a second copy with state of its own.
    it('shares vsnap.config.ts with the page', async () => {
        expect((await loadViewKinds()).canvas).toEqual(config.views);
        expect((await loadViewKinds()).canvas[0]).toBe(config.views[0]);
    });

    describe('three.js', () => {
        canvasTest('lit by its own lights, with the camera given', KNOT, () => createKnot());

        // A three.js image is always antialiased. So over the size budget, it
        // is drawn at half resolution, as a smooth Pixi view is.
        canvasTest('over the budget', { kind: 'three', width: 1200, height: 600, camera: createKnotCamera, background: 0x15102b }, () => createKnot());
    });

    // A pose may draw a canvas itself, with any renderer, and return it.
    // A kind that the project registers itself, whose draw returns a canvas.
    canvasTest('a kind of the project\'s own', { kind: 'sketch', width: 90 }, (): Sketch => ({
        paint: (ctx) => {
            ctx.fillStyle = '#5bd1ff';
            ctx.fillRect(10, 10, 30, 40);
            ctx.fillStyle = '#ff4f8b';
            ctx.beginPath();
            ctx.arc(62, 30, 18, 0, Math.PI * 2);
            ctx.fill();
        },
    }));

    describe('a canvas the pose drew', () => {
        canvasTest('in 2D', { kind: 'canvas' }, () => {
            const canvas = document.createElement('canvas');
            canvas.width = 120;
            canvas.height = 60;
            const ctx = canvas.getContext('2d');
            if (ctx === null) throw new Error('The browser gave no 2D canvas context.');
            ctx.fillStyle = '#202024';
            ctx.fillRect(0, 0, 120, 60);
            ctx.fillStyle = '#ffe45c';
            ctx.beginPath();
            ctx.arc(30, 30, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = '700 16px sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('2D', 62, 36);
            return canvas;
        });

        canvasTest('with WebGL', { kind: 'canvas' }, () => {
            const canvas = new OffscreenCanvas(80, 60);
            const gl = canvas.getContext('webgl2');
            if (gl === null) throw new Error('The browser gave no WebGL 2 context.');
            gl.enable(gl.SCISSOR_TEST);
            gl.clearColor(0.125, 0.125, 0.14, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.scissor(10, 10, 30, 40);
            gl.clearColor(1, 0.31, 0.545, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.scissor(46, 24, 24, 24);
            gl.clearColor(0.357, 0.82, 1, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            return canvas;
        });
    });

    // A canvasTest that bindCanvasTest bound to a config other than this
    // project's, as another package's would be, fails before its pose, rather
    // than drawing with this project's kinds. Had it drawn, its image would
    // have passed as new.
    const otherCanvasTest = bindCanvasTest(defineVsnapConfig({ views: [pixiViews()], defaultView: 'pixi' }));
    otherCanvasTest('bound to the config of another project', { fails: true }, () => new Graphics().rect(0, 0, 10, 10).fill(0xffffff));
});

function createKnot(): Group {
    const group = new Group();
    const light = new DirectionalLight(0xffffff, 2);
    light.position.set(2, 3, 4);
    group.add(new Mesh(new TorusKnotGeometry(1, 0.32, 96, 16), new MeshStandardMaterial({ color: 0x2fd27a, roughness: 0.4 })));
    group.add(new AmbientLight(0xffffff, 0.4), light);
    return group;
}

function createKnotCamera(): PerspectiveCamera {
    const camera = new PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 6);
    return camera;
}

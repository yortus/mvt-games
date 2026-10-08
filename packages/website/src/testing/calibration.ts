import { inject } from 'vitest';
import { BlurFilter, Container, FillGradient, Graphics, Sprite, Text, type TextStyleOptions, Texture } from 'pixi.js';
import {
    AmbientLight, BoxGeometry, Color, DirectionalLight, Group, Mesh, MeshPhongMaterial, MeshStandardMaterial, NeutralToneMapping,
    type Object3D, PerspectiveCamera, PMREMGenerator, SphereGeometry,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { destroyObject } from '@mvtjs/three';
import { captureHtmlPicture } from './html-picture';
import { describeDifference, hashPixels, isPass, sessionFor, toBase64, visualCommands } from './judge';
import { drawPixiPicture, type PixiPictureOptions, preparePixiPose } from './pixi-picture';
import type { VisualEnvironment, VisualKind, VisualVerdict } from './protocol';
import { drawThreePicture, type ThreePictureOptions } from './three-picture';

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Checks, before any test, that this machine is the reference environment:
 * the browser's facts, then a calibration set of small pictures, each
 * exercising one way a picture can differ between machines. If anything
 * differs beyond the tolerance, the run stops with one error saying what,
 * rather than failing every test for one reason nobody can see. In
 * `environment` mode, it writes the facts and the calibration set's
 * references instead. Once per run for each kind of page.
 */
export async function checkCalibration(kind: VisualKind): Promise<void> {
    const session = await sessionFor({ calibration: kind });
    if (session.isCalibrated) return;
    const problems = [...await visualCommands.visualEnvironment(environment())];
    if (problems.length === 0) {
        const pictures = kind === 'pixi' ? PIXI_CALIBRATION : HTML_CALIBRATION;
        for (const [name, draw] of Object.entries(pictures)) {
            const verdict = await draw(name, session.hashes[name]);
            if (!isPass(verdict)) {
                const detail = verdict.outcome === 'differs' ? describeDifference(verdict) : verdict.outcome;
                problems.push(`the calibration picture '${name}' differs (${detail}): see ${verdict.diffFile ?? verdict.actualFile}`);
            }
        }
    }
    if (problems.length > 0) {
        const message = `This machine is not the visual tests' reference environment (${kind}): ${problems.join('; ')}. `
            + 'No picture was compared. If the browser was upgraded on purpose, run `npm run test:visual:environment` and review the changes.';
        await visualCommands.visualAbort(message);
        throw new Error(message);
    }
    await visualCommands.visualCalibrated(kind);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type Calibration = (name: string, expectedHash: string | undefined) => Promise<VisualVerdict>;

function environment(): VisualEnvironment {
    const gl = document.createElement('canvas').getContext('webgl2');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
        browser: /HeadlessChrome\/[\d.]+/.exec(navigator.userAgent)?.[0] ?? navigator.userAgent,
        webglRenderer: info !== undefined && info !== null && gl !== null ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'none',
        locale: Intl.DateTimeFormat().resolvedOptions().locale,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        devicePixelRatio,
    };
}

/** A calibration picture drawn with Pixi. */
function pixi(pose: () => Container, options: PixiPictureOptions = {}): Calibration {
    return async (name, expectedHash) => {
        preparePixiPose(options);
        const view = pose();
        try {
            return await judgeWebGl(name, expectedHash, await drawPixiPicture(view, { ...options, maxPixels: inject('visualMaxPixels') }));
        }
        finally {
            view.destroy({ children: true });
        }
    };
}

/** A calibration picture drawn with three.js, in the WebGL set: it shares the page, and SwiftShader. */
function three(pose: () => Object3D, options: ThreePictureOptions): Calibration {
    return async (name, expectedHash) => {
        const view = pose();
        try {
            return await judgeWebGl(name, expectedHash, drawThreePicture(view, { ...options, maxPixels: inject('visualMaxPixels') }));
        }
        finally {
            destroyObject(view);
        }
    };
}

async function judgeWebGl(
    name: string,
    expectedHash: string | undefined,
    picture: { readonly width: number; readonly height: number; readonly pixels: Uint8Array },
): Promise<VisualVerdict> {
    const hash = await hashPixels(picture.width, picture.height, picture.pixels);
    if (hash === expectedHash) return { outcome: 'same', referenceFile: name };
    return visualCommands.visualMismatch({
        calibration: 'pixi', name, test: `calibration ${name}`,
        width: picture.width, height: picture.height, hash, pixels: toBase64(picture.pixels),
    });
}

/** A calibration picture in HTML. */
function html(markup: string): Calibration {
    return async (name) => {
        const root = document.createElement('div');
        root.style.cssText = 'padding:8px;color:#e6edf3;font-size:14px;';
        root.innerHTML = markup;
        return captureHtmlPicture(root, { maxPixels: inject('visualMaxPixels') }, { calibration: 'html', name, test: `calibration ${name}` });
    };
}

const SAMPLE = 'Sphinx of black quartz, judge my vow. 0123456789 $1,250';

function textBlock(family: string, extra: Partial<TextStyleOptions> = {}): Container {
    const root = new Container();
    let y = 0;
    for (const weight of ['400', '700', '900'] as const) {
        for (const size of [10, 13, 16, 24]) {
            const text = new Text({ text: SAMPLE, style: { fontFamily: family, fontSize: size, fontWeight: weight, fill: 0xffffff, ...extra } });
            text.y = y;
            root.addChild(text);
            y += Math.ceil(size * 1.35);
        }
    }
    return root;
}

function checkerSprite(): Container {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('No 2D canvas');
    for (let i = 0; i < 16; i++) {
        ctx.fillStyle = ['#ff4f8b', '#ffe45c', '#2a1766', '#5bd1ff'][(i % 4 + Math.floor(i / 4)) % 4];
        ctx.fillRect((i % 4) * 4, Math.floor(i / 4) * 4, 4, 4);
    }
    const sprite = new Sprite(Texture.from(canvas));
    sprite.scale.set(5.3);
    sprite.rotation = 0.3;
    sprite.position.set(30, 4);
    const root = new Container();
    root.addChild(sprite);
    return root;
}

const SMOOTH: PixiPictureOptions = { artStyle: 'smooth' };

/** A sphere and a box, in two kinds of material, for the lighting to show on. */
function shapes(): Object3D {
    const group = new Group();
    const sphere = new Mesh(new SphereGeometry(1, 48, 32), new MeshStandardMaterial({ color: 0xff4f8b, roughness: 0.35, metalness: 0.2 }));
    const box = new Mesh(new BoxGeometry(0.9, 0.9, 0.9), new MeshPhongMaterial({ color: 0x5bd1ff, shininess: 80 }));
    box.position.set(1.6, -0.2, -0.5);
    box.rotation.set(0.4, 0.7, 0);
    group.add(sphere, box);
    return group;
}

function shapesCamera(): PerspectiveCamera {
    const camera = new PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0.6, 0.4, 5);
    camera.lookAt(0.4, 0, 0);
    return camera;
}

const PIXI_CALIBRATION: Readonly<Record<string, Calibration>> = {
    'circle-msaa': pixi(() => new Graphics().circle(40, 40, 33).fill(0xff4f8b).stroke({ width: 3, color: 0xffe45c }), SMOOTH),
    'circle-aliased': pixi(() => new Graphics().circle(40, 40, 33).fill(0xff4f8b).stroke({ width: 3, color: 0xffe45c }), {}),
    'gradients': pixi(() => {
        const linear = new FillGradient({
            type: 'linear', start: { x: 0, y: 0 }, end: { x: 1, y: 0 },
            colorStops: [{ offset: 0, color: 0xff4f8b }, { offset: 0.5, color: 0xffe45c }, { offset: 1, color: 0x2a1766 }],
        });
        return new Graphics().rect(0, 0, 240, 40).fill(linear).roundRect(20, 60, 200, 60, 18).fill(linear);
    }, SMOOTH),
    'blur': pixi(() => {
        const shape = new Graphics().star(60, 60, 5, 40, 18).fill(0x5bd1ff).rect(110, 30, 60, 60).fill(0xffe45c);
        shape.filters = [new BlurFilter({ strength: 6, quality: 4 })];
        const root = new Container();
        root.addChild(shape);
        return root;
    }, { width: 200, height: 130, artStyle: 'smooth' }),
    'texture-linear': pixi(checkerSprite, { width: 120, height: 120, artStyle: 'smooth' }),
    'texture-nearest': pixi(checkerSprite, { width: 120, height: 120 }),
    'text-sans': pixi(() => textBlock('"Segoe UI", sans-serif'), SMOOTH),
    'text-mono': pixi(() => textBlock('monospace'), SMOOTH),
    'text-effects': pixi(() => {
        const root = new Container();
        const gradient = new FillGradient({
            type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
            colorStops: [{ offset: 0, color: 0xffe45c }, { offset: 1, color: 0xff4f8b }],
        });
        const a = new Text({ text: 'WIN 1,250', style: { fontFamily: 'sans-serif', fontSize: 44, fontWeight: '900', fill: gradient, stroke: { color: 0x140a38, width: 6 } } });
        const b = new Text({ text: 'Shadowed, spaced', style: { fontFamily: 'monospace', fontSize: 24, letterSpacing: 3, fill: 0xffffff, dropShadow: { color: 0x000000, blur: 4, distance: 4, angle: Math.PI / 4, alpha: 0.8 } } });
        const c = new Text({ text: 'Italic text', style: { fontFamily: 'sans-serif', fontSize: 20, fontStyle: 'italic', fill: 0xffffff } });
        b.y = 60;
        c.y = 100;
        root.addChild(a, b, c);
        return root;
    }, SMOOTH),
    'three-lights': three(() => {
        const group = shapes();
        const light = new DirectionalLight(0xffffff, 2.5);
        light.position.set(3, 4, 5);
        group.add(new AmbientLight(0xffffff, 0.3), light);
        return group;
    }, { width: 160, height: 120, camera: shapesCamera }),
    // The fruit machine's way: a room to reflect, tone-mapped, on a coloured background
    'three-environment': three(shapes, {
        width: 160,
        height: 120,
        camera: shapesCamera,
        scene: ({ scene, renderer }) => {
            renderer.toneMapping = NeutralToneMapping;
            scene.background = new Color(0x15102b);
            const environment = new PMREMGenerator(renderer);
            scene.environment = environment.fromScene(new RoomEnvironment(), 0.04).texture;
            environment.dispose();
        },
    }),
};

const HTML_CALIBRATION: Readonly<Record<string, Calibration>> = {
    'blank-text': html([10, 13, 13.5, 16, 17.3, 24].map((size) => `<div style="font-size:${size}px;width:max-content;border:1px solid #58a6ff;margin:2px 0">${SAMPLE}</div>`).join('')
        + '<p style="width:200px;border:1px solid #ffe45c;line-height:1.4">Wrapping text, with emoji 😀 and 漢字, in a narrow box.</p>'),
    'boxes': html(`<div style="display:flex;gap:16px">
        <div style="width:90px;height:60px;border-radius:14px 4px 22px 8px;background:linear-gradient(135deg,#ff4f8b,#ffe45c)"></div>
        <div style="width:60px;height:60px;border-radius:50%;background:radial-gradient(circle,#fff,#2a1766);box-shadow:0 6px 14px rgba(0,0,0,.6)"></div>
        <div style="width:60px;height:40px;border:3px dashed #5bd1ff;outline:2px solid #58a6ff;outline-offset:3px"></div></div>`),
    'rotated': html(`<div style="display:flex;gap:24px;padding:12px">
        <div style="width:60px;height:40px;background:#ffe45c;transform:rotate(7deg)"></div>
        <div style="perspective:200px"><div style="width:60px;height:40px;background:#ff4f8b;transform:rotateY(35deg)"></div></div>
        <img style="width:80px;height:60px;transform:rotate(-3deg)" src="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#2a1766"/><circle cx="20" cy="15" r="10" fill="#5bd1ff"/></svg>')}"></div>`),
    'filters': html(`<div style="display:flex;gap:18px;padding:10px;background:linear-gradient(90deg,#123,#456)">
        <div style="width:50px;height:50px;background:#ffe45c;filter:blur(3px)"></div>
        <div style="width:50px;height:50px;background:#5bd1ff;filter:drop-shadow(4px 4px 3px #000)"></div>
        <div style="width:50px;height:50px;backdrop-filter:blur(4px);border:1px solid #fff"></div></div>`),
    'controls': html(`<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;width:520px">
        <input type="checkbox" checked><input type="radio" checked><input type="range" value="30">
        <progress value="0.4"></progress><button>Button</button><select><option>Option</option></select>
        <input type="text" value="Text field"><textarea rows="2" cols="12">Two lines</textarea></div>`),
};

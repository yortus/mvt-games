// Spike: the calibration set. Each picture exercises one way pictures can differ between machines.
import { BlurFilter, Container, FillGradient, Graphics, Sprite, Text, type TextStyleOptions, Texture } from 'pixi.js';
import { describe } from 'vitest';
import { visualHtmlTest, visualTest, visualThreeTest } from './harness';

const SAMPLE = 'Sphinx of black quartz, judge my vow. 0123456789 $1,250';
const SIZES = [10, 13, 16, 24, 40];
const WEIGHTS = ['400', '700', '900'] as const;

function textBlock(family: string, extra: Partial<TextStyleOptions> = {}): Container {
    const root = new Container();
    let y = 0;
    for (const weight of WEIGHTS) {
        for (const size of SIZES) {
            const text = new Text({ text: SAMPLE, style: { fontFamily: family, fontSize: size, fontWeight: weight, fill: 0xffffff, ...extra } });
            text.y = y;
            root.addChild(text);
            y += Math.ceil(size * 1.35);
        }
    }
    return root;
}

function checkerTexture(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
            ctx.fillStyle = ['#ff4f8b', '#ffe45c', '#2a1766', '#5bd1ff'][(x + y * 3) % 4];
            ctx.fillRect(x * 4, y * 4, 4, 4);
        }
    }
    return Texture.from(canvas);
}

function sprite(): Container {
    const s = new Sprite(checkerTexture());
    s.scale.set(5.3);
    s.rotation = 0.3;
    s.position.set(30, 4);
    const c = new Container();
    c.addChild(s);
    return c;
}

describe('pixi', () => {
    visualTest('circle msaa', () => new Graphics().circle(40, 40, 33).fill(0xff4f8b).stroke({ width: 3, color: 0xffe45c }));
    visualTest('circle aliased', () => new Graphics().circle(40, 40, 33).fill(0xff4f8b).stroke({ width: 3, color: 0xffe45c }), { pixelArt: true });
    visualTest('gradients', () => {
        const linear = new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, colorStops: [{ offset: 0, color: 0xff4f8b }, { offset: 0.5, color: 0xffe45c }, { offset: 1, color: 0x2a1766 }] });
        const radial = new FillGradient({ type: 'radial', center: { x: 0.5, y: 0.5 }, innerRadius: 0, outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.5, colorStops: [{ offset: 0, color: 0xffffff }, { offset: 1, color: 0x2a1766 }] });
        return new Graphics().rect(0, 0, 240, 40).fill(linear).circle(60, 100, 40).fill(radial).roundRect(120, 60, 120, 80, 18).fill(linear);
    });
    visualTest('blur', () => {
        const g = new Graphics().star(60, 60, 5, 40, 18).fill(0x5bd1ff).rect(110, 30, 60, 60).fill(0xffe45c);
        g.filters = [new BlurFilter({ strength: 6, quality: 4 })];
        const c = new Container();
        c.addChild(g);
        return c;
    }, { width: 200, height: 130 });
    visualTest('texture linear', sprite, { width: 120, height: 120 });
    visualTest('texture nearest', sprite, { width: 120, height: 120, pixelArt: true });
    visualTest('text test sans', () => textBlock('VT Sans'));
    visualTest('text test mono', () => textBlock('VT Mono'));
    visualTest('text generic names', () => {
        const root = new Container();
        const families = ['monospace', '"Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif', 'ui-monospace, Consolas, monospace', 'system-ui', 'Georgia, serif'];
        families.forEach((fontFamily, i) => {
            const t = new Text({ text: SAMPLE, style: { fontFamily, fontSize: 18, fontWeight: i % 2 ? 'bold' : 'normal', fill: 0xffffff } });
            t.y = i * 26;
            root.addChild(t);
        });
        return root;
    });
    visualTest('text effects', () => {
        const root = new Container();
        const gradient = new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, colorStops: [{ offset: 0, color: 0xffe45c }, { offset: 1, color: 0xff4f8b }], textureSpace: 'local' });
        const a = new Text({ text: 'WIN 1,250', style: { fontFamily: 'VT Sans', fontSize: 44, fontWeight: '900', fill: gradient, stroke: { color: 0x140a38, width: 6 } } });
        const b = new Text({ text: 'Shadowed mono', style: { fontFamily: 'VT Mono', fontSize: 28, fill: 0xffffff, dropShadow: { color: 0x000000, blur: 4, distance: 4, angle: Math.PI / 4, alpha: 0.8 } } });
        b.y = 60;
        root.addChild(a, b);
        return root;
    });
    // Control: a system font no test font stands in for. Expected to differ between systems.
    visualTest('CONTROL text unpinned', () => textBlock('"Times New Roman"'));
});

const DOM_SAMPLE = SAMPLE;

function domBlock(family: string): HTMLElement {
    const root = document.createElement('div');
    root.style.cssText = 'color:#fff;padding:4px;width:560px;';
    for (const weight of WEIGHTS) {
        for (const size of SIZES) {
            const p = document.createElement('div');
            p.textContent = DOM_SAMPLE;
            p.style.cssText = `font-family:${family};font-size:${size}px;font-weight:${weight};line-height:1.35;white-space:nowrap;`;
            root.append(p);
        }
    }
    return root;
}

describe('dom', () => {
    visualHtmlTest('text test sans', () => domBlock('"VT Sans"'));
    visualHtmlTest('text test mono', () => domBlock('"VT Mono"'));
    visualHtmlTest('text shadowed names', () => domBlock('"Segoe UI", "Helvetica Neue", Helvetica, Arial'));
    visualHtmlTest('boxes', () => {
        const root = document.createElement('div');
        root.style.cssText = 'display:flex;gap:16px;padding:16px;';
        root.innerHTML = `
            <div style="width:120px;height:80px;border-radius:18px;background:linear-gradient(135deg,#ff4f8b,#ffe45c 60%,#2a1766)"></div>
            <div style="width:80px;height:80px;border-radius:50%;background:radial-gradient(circle,#fff,#2a1766);box-shadow:0 6px 14px rgba(0,0,0,.6)"></div>
            <div style="width:100px;height:80px;border:3px solid #5bd1ff;border-radius:8px;transform:rotate(7deg)"></div>`;
        return root;
    });
    // Control: a system font no test font stands in for. Expected to differ between systems.
    visualHtmlTest('CONTROL text unpinned', () => domBlock('"Times New Roman"'));
});

describe('three', () => {
    visualThreeTest('lit sphere', async () => {
        const T = await import('three');
        const scene = new T.Scene();
        scene.background = new T.Color(0x202024);
        const sphere = new T.Mesh(new T.SphereGeometry(1, 48, 32), new T.MeshStandardMaterial({ color: 0xff4f8b, roughness: 0.35, metalness: 0.2 }));
        const box = new T.Mesh(new T.BoxGeometry(0.9, 0.9, 0.9), new T.MeshPhongMaterial({ color: 0x5bd1ff, shininess: 80 }));
        box.position.set(1.6, -0.2, -0.5);
        box.rotation.set(0.4, 0.7, 0);
        scene.add(sphere, box, new T.AmbientLight(0xffffff, 0.3));
        const light = new T.DirectionalLight(0xffffff, 2.5);
        light.position.set(3, 4, 5);
        scene.add(light);
        const camera = new T.PerspectiveCamera(45, 160 / 120, 0.1, 100);
        camera.position.set(0.6, 0.4, 5);
        camera.lookAt(0.4, 0, 0);
        return { scene, camera };
    }, { width: 160, height: 120 });
});

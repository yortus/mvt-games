// Spike: HTML features one at a time, to see which differ between systems.
import { describe } from 'vitest';
import { visualHtmlTest } from '../harness';

function el(html: string, style = ''): () => HTMLElement {
    return () => {
        const root = document.createElement('div');
        root.style.cssText = `color:#e6edf3;font-family:system-ui,sans-serif;font-size:14px;padding:8px;${style}`;
        root.innerHTML = html;
        return root;
    };
}

// A small PNG drawn on a canvas, as a data URL
function checkerPng(): string {
    const c = document.createElement('canvas');
    c.width = c.height = 8;
    const ctx = c.getContext('2d')!;
    for (let i = 0; i < 64; i++) {
        ctx.fillStyle = ['#ff4f8b', '#ffe45c', '#2a1766', '#5bd1ff'][(i + (i >> 3)) % 4];
        ctx.fillRect(i % 8, i >> 3, 1, 1);
    }
    return c.toDataURL('image/png');
}

describe('no text', () => {
    visualHtmlTest('boxes and shadows', el(`
        <div style="display:flex;gap:16px">
          <div style="width:90px;height:60px;border-radius:14px 4px 22px 8px;background:linear-gradient(135deg,#ff4f8b,#ffe45c)"></div>
          <div style="width:60px;height:60px;border-radius:50%;background:radial-gradient(circle,#fff,#2a1766);box-shadow:0 6px 14px rgba(0,0,0,.6)"></div>
          <div style="width:60px;height:60px;background:conic-gradient(red,yellow,lime,aqua,blue,magenta,red)"></div>
          <div style="width:60px;height:60px;box-shadow:inset 0 0 12px #5bd1ff;border-radius:8px"></div>
        </div>`));
    visualHtmlTest('borders and outlines', el(`
        <div style="display:flex;gap:14px">
          <div style="width:50px;height:40px;border:3px dashed #5bd1ff"></div>
          <div style="width:50px;height:40px;border:3px dotted #ffe45c"></div>
          <div style="width:50px;height:40px;border:6px double #ff4f8b"></div>
          <div style="width:50px;height:40px;outline:2px solid #58a6ff;outline-offset:3px;border-radius:6px"></div>
          <div style="width:50px;height:40px;border:4px solid;border-color:#f00 #0f0 #00f #ff0;border-radius:10px"></div>
        </div>`));
    visualHtmlTest('transforms', el(`
        <div style="display:flex;gap:24px;padding:12px">
          <div style="width:60px;height:40px;background:#ffe45c;transform:rotate(7deg)"></div>
          <div style="width:60px;height:40px;background:#5bd1ff;transform:rotate(-3.5deg) scale(1.07)"></div>
          <div style="perspective:200px"><div style="width:60px;height:40px;background:#ff4f8b;transform:rotateY(35deg)"></div></div>
          <div style="width:60px;height:40px;background:#2fd27a;clip-path:polygon(10% 0,100% 20%,90% 100%,0 80%)"></div>
        </div>`));
    visualHtmlTest('filters and blending', el(`
        <div style="display:flex;gap:18px;padding:10px;background:linear-gradient(90deg,#123,#456)">
          <div style="width:50px;height:50px;background:#ffe45c;filter:blur(3px)"></div>
          <div style="width:50px;height:50px;background:#5bd1ff;filter:drop-shadow(4px 4px 3px #000)"></div>
          <div style="width:50px;height:50px;background:#ff4f8b;opacity:.55"></div>
          <div style="width:50px;height:50px;background:#2fd27a;mix-blend-mode:screen"></div>
          <div style="width:50px;height:50px;backdrop-filter:blur(4px) saturate(2);border:1px solid #fff"></div>
          <div style="width:50px;height:50px;background:#fff;mask-image:linear-gradient(#000,transparent)"></div>
        </div>`));
    visualHtmlTest('images', () => {
        const png = checkerPng();
        return el(`
            <div style="display:flex;gap:12px;align-items:center">
              <img src="${png}" style="width:56px;height:56px">
              <img src="${png}" style="width:56px;height:56px;image-rendering:pixelated">
              <svg width="70" height="56" viewBox="0 0 70 56"><circle cx="28" cy="28" r="22" fill="#ff4f8b" stroke="#fff" stroke-width="3"/><path d="M50 8 L66 48 L40 40 Z" fill="#5bd1ff"/></svg>
              <div style="width:56px;height:56px;background:url(${png}) 0 0/14px 14px"></div>
            </div>`)();
    });
    visualHtmlTest('controls without text', el(`
        <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;width:520px">
          <input type="checkbox"><input type="checkbox" checked>
          <input type="radio"><input type="radio" checked>
          <input type="range" value="30">
          <input type="range" value="70" style="accent-color:#58a6ff">
          <progress value="0.4"></progress>
          <progress value="0.7" style="accent-color:#d29922"></progress>
          <meter value="0.6"></meter>
        </div>`));
    visualHtmlTest('scrolling box', el(`
        <div style="width:200px;height:80px;overflow:auto;scrollbar-gutter:stable;background:#222;border:1px solid #555">
          <div style="height:300px;background:linear-gradient(#5bd1ff,#2a1766)"></div>
        </div>`));
    visualHtmlTest('canvas element', () => {
        const c = document.createElement('canvas');
        c.width = 160;
        c.height = 80;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#123';
        ctx.fillRect(0, 0, 160, 80);
        ctx.fillStyle = '#ffe45c';
        ctx.beginPath();
        ctx.arc(40, 40, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ff4f8b';
        ctx.lineWidth = 5;
        ctx.strokeRect(84, 14, 60, 50);
        const wrap = document.createElement('div');
        wrap.append(c);
        return wrap;
    });
});

describe('text', () => {
    visualHtmlTest('paragraph wrapping', el(`
        <p style="width:260px;margin:0;line-height:1.4">The quick brown fox jumps over the lazy dog, then naps for a while.
        Sphinx of black quartz, judge my vow. 0123456789 $1,250</p>`));
    visualHtmlTest('weights and styles', el(`
        <div style="font-weight:400">Regular text</div><div style="font-weight:700">Bold text</div>
        <div style="font-weight:900">Black text</div><div style="font-style:italic">Italic text</div>
        <div style="font-family:Georgia,serif;font-style:italic;font-weight:bold">i</div>
        <div style="font-family:ui-monospace,Consolas,monospace">monospace 0123</div>`));
    visualHtmlTest('symbols and emoji', el(`
        <div>× ← ❚❚ ⛶ · ★ ♥ → ↑ ↓</div>
        <div>←︎ ↑︎ ↓︎ →︎</div>
        <div>Emoji: 😀 🎰 🍒</div><div>漢字 かな Ελληνικά Кириллица عربى</div>`));
    visualHtmlTest('decorations and lists', el(`
        <a href="#" style="color:#58a6ff">underlined link</a> <s>struck</s> <u style="text-decoration-style:wavy">wavy</u>
        <ul style="margin:4px 0"><li>bullet one</li><li>bullet two</li></ul>
        <ol style="margin:4px 0"><li>first</li><li>second</li></ol>
        <div style="width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">This line is far too long to fit</div>`));
    visualHtmlTest('controls with text', el(`
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;width:520px">
          <button>Default button</button>
          <button disabled>Disabled</button>
          <input type="text" value="Some text">
          <input type="search" placeholder="Search games">
          <select><option>Option one</option></select>
          <textarea rows="2" cols="16">Two lines
of text</textarea>
        </div>`));
});

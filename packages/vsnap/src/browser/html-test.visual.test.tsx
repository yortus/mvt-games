// These are the visual test harness's own tests. Each one checks one case
// of capturing an HTML view.
import { describe, expect, it } from 'vitest';
import { adoptHtmlRules, settleAnimations } from './html-rules';
import { htmlTest } from './visual-test';

function createBlock(markup: string): HTMLElement {
    const root = document.createElement('div');
    root.style.cssText = 'padding:8px;color:#e6edf3;font-size:14px;';
    root.innerHTML = markup;
    return root;
}

describe('htmlTest', () => {
    htmlTest('text, drawn blank', () => createBlock('<h3 style="margin:0">A heading</h3><p style="width:180px">A paragraph long enough to wrap onto a second line.</p>'));

    htmlTest('a styled control', () => createBlock('<button style="font:inherit;padding:6px 14px;border:1px solid #30363d;border-radius:6px;background:#21262d;color:#c9d1d9">Spin</button>'));

    htmlTest('a rotated image', () => createBlock(`<img style="width:80px;transform:rotate(-4deg)" src="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#2a1766"/><circle cx="20" cy="15" r="10" fill="#5bd1ff"/></svg>')}">`));

    htmlTest('at a fixed size', { width: 120, height: 80 }, () => createBlock('<div style="width:40px;height:40px;background:#ff4f8b"></div>'));

    // Animations are brought to rest before the capture: the spinner, which
    // never ends, is cancelled, and the fade, which ends, is finished. Each
    // repeat must match the one reference.
    htmlTest('animations, at rest', { repeats: 3 }, () => createBlock(`
        <style>
            @keyframes test-spin { to { transform: rotate(360deg) } }
            @keyframes test-fade { from { opacity: 0 } to { opacity: 1 } }
        </style>
        <div style="display:flex;gap:12px">
            <div style="width:30px;height:30px;background:#5bd1ff;animation:test-spin .7s linear infinite"></div>
            <div style="width:30px;height:30px;background:#ff4f8b;animation:test-fade 5s forwards"></div>
        </div>`));

    // A web component's text, in its shadow root, is blank too, and its odd
    // font size is rounded to a quarter pixel.
    htmlTest('text in a shadow root, drawn blank', () => {
        const block = createBlock('');
        const shadow = block.attachShadow({ mode: 'open' });
        shadow.innerHTML = '<style>p { font-family: Arial, sans-serif; font-size: 17.3px; margin: 0; width: 160px }</style><p>Text in a web component, long enough to wrap.</p>';
        return block;
    });

    it('gives the page rules to an open shadow root', () => {
        const block = createBlock('');
        const shadow = block.attachShadow({ mode: 'open' });
        shadow.innerHTML = '<style>p { font-family: Arial }</style><p>Text</p>';
        document.body.append(block);
        try {
            adoptHtmlRules(block);
            expect(getComputedStyle(shadow.querySelector('p') as Element).fontFamily).toContain('Visual Blank');
        }
        finally {
            block.remove();
        }
    });

    it('brings animations to rest', async () => {
        const block = createBlock('<div style="width:10px;height:10px"></div>');
        document.body.append(block);
        try {
            const box = block.firstElementChild as HTMLElement;
            const spin = box.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 700, iterations: Infinity });
            const fade = box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 5000, fill: 'forwards' });
            await settleAnimations(block);
            expect(spin.playState).toBe('idle');
            expect(fade.playState).toBe('finished');
            expect(getComputedStyle(box).opacity).toBe('1');
        }
        finally {
            block.remove();
        }
    });
});

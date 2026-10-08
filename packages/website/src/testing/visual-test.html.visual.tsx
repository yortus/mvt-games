// The harness's own visual tests: what an HTML picture covers, one case each.
import { describe } from 'vitest';
import { visualTest } from '#testing';

function element(markup: string): HTMLElement {
    const root = document.createElement('div');
    root.style.cssText = 'padding:8px;color:#e6edf3;font-size:14px;';
    root.innerHTML = markup;
    return root;
}

describe('visualTest', () => {
    visualTest('text, drawn blank', () => element('<h3 style="margin:0">A heading</h3><p style="width:180px">A paragraph long enough to wrap onto a second line.</p>'));

    visualTest('a styled control', () => element('<button style="font:inherit;padding:6px 14px;border:1px solid #30363d;border-radius:6px;background:#21262d;color:#c9d1d9">Spin</button>'));

    visualTest('a rotated image', () => element(`<img style="width:80px;transform:rotate(-4deg)" src="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#2a1766"/><circle cx="20" cy="15" r="10" fill="#5bd1ff"/></svg>')}">`));

    visualTest('at a fixed size', () => element('<div style="width:40px;height:40px;background:#ff4f8b"></div>'), { width: 120, height: 80 });
});

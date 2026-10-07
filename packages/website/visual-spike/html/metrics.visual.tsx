// Spike: text measurements, recorded beside the pictures, to see why one system lays text out differently.
import { describe, test } from 'vitest';
import { recordData } from '../harness';

describe('metrics', () => {
    test('line boxes and widths', async () => {
        const out: Record<string, string> = {};
        const host = document.createElement('div');
        host.style.cssText = 'position:absolute;left:0;top:0;';
        document.body.append(host);
        for (const size of [10, 12, 13, 14, 16, 18, 24]) {
            const block = document.createElement('div');
            block.style.cssText = `font-family:system-ui,sans-serif;font-size:${size}px;line-height:normal;width:max-content;`;
            block.textContent = 'Sphinx of black quartz';
            host.append(block);
            const r = block.getBoundingClientRect();
            const span = document.createElement('span');
            span.textContent = 'Sphinx';
            block.append(span);
            const s = span.getBoundingClientRect();
            out[`${size}px`] = `block ${r.width.toFixed(3)}x${r.height.toFixed(3)} span ${s.width.toFixed(3)}x${s.height.toFixed(3)} top ${(s.top - r.top).toFixed(3)}`;
            block.remove();
        }
        const input = document.createElement('input');
        const button = document.createElement('button');
        button.textContent = 'Button';
        const select = document.createElement('select');
        select.innerHTML = '<option>Option one</option>';
        host.append(input, button, select);
        for (const [name, e] of [['input', input], ['button', button], ['select', select]] as const) {
            const r = e.getBoundingClientRect();
            out[name] = `${r.width.toFixed(3)}x${r.height.toFixed(3)}`;
        }
        host.remove();
        await recordData('_metrics', out);
    });
});

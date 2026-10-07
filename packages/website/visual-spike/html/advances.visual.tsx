// Spike: how each invisible fixed-width font lays out, at several sizes. A 22-character line,
// whose exact width is 22 x 0.6 x size; whole-pixel advances give 22 x round(0.6 x size).
import { describe, test } from 'vitest';
import blank from '../fonts/VTBlank.otf?url';
import degenerate from '../fonts/VTBlankDegenerate.otf?url';
import far from '../fonts/VTBlankFar.otf?url';
import tt from '../fonts/VTBlankTT.ttf?url';
import ttDegenerate from '../fonts/VTBlankTTDegenerate.ttf?url';
import { recordData } from '../harness';

const FONTS = { blank, degenerate, far, tt, ttDegenerate };
const SIZES = [10, 11, 12, 13, 14, 15, 16, 18, 24, 13.5, 17.3];

describe('advances', () => {
    test('line widths per font', async () => {
        const out: Record<string, string> = {};
        const host = document.createElement('div');
        host.style.cssText = 'position:absolute;left:0;top:0;';
        document.body.append(host);
        for (const [name, url] of Object.entries(FONTS)) {
            const family = `Probe ${name}`;
            const face = new FontFace(family, `url(${url})`);
            await face.load();
            document.fonts.add(face);
            const widths: string[] = [];
            for (const size of SIZES) {
                const line = document.createElement('div');
                line.style.cssText = `font-family:"${family}";font-size:${size}px;width:max-content;`;
                line.textContent = 'Sphinx of black quartz';
                host.append(line);
                widths.push(`${size}:${line.getBoundingClientRect().width.toFixed(3)}`);
                line.remove();
            }
            out[name] = widths.join(' ');
        }
        out.exact = SIZES.map((s) => `${s}:${(22 * 0.6 * s).toFixed(3)}`).join(' ');
        host.remove();
        await recordData('_advances', out);
    });
});

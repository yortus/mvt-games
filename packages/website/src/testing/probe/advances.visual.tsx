// Temporary probe: line widths of each blank-font variant at many sizes, compared with Windows'
import { commands } from 'vitest/browser';
import { test } from 'vitest';
import a500 from './a500.ttf?url';
import a625 from './a625.ttf?url';
import cur from './cur.ttf?url';
import u1024a640 from './u1024a640.ttf?url';
import u16a8 from './u16a8.ttf?url';
import u2048a1024 from './u2048a1024.ttf?url';
import u2048a1280 from './u2048a1280.ttf?url';
import u64a40 from './u64a40.ttf?url';

const FONTS: Record<string, string> = { cur, a500, a625, u1024a640, u2048a1024, u2048a1280, u16a8, u64a40 };
const SIZES: number[] = [];
// Every eighth of a pixel from 6 to 40
for (let s = 48; s <= 320; s++) SIZES.push(s / 8);
const GRIDS: [string, (size: number) => boolean][] = [
    ['whole', (s) => Number.isInteger(s)],
    ['half', (s) => Number.isInteger(s * 2)],
    ['quarter', (s) => Number.isInteger(s * 4)],
    ['eighth', () => true],
];
const LENGTHS = [1, 3, 7, 20, 55, 133, 400];
const STYLES: Record<string, string> = { plain: '' };
const CONFIGS: [string, string, string][] = [];
for (const name of Object.keys(FONTS)) CONFIGS.push([name, name, 'plain']);

test('advances', async () => {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:0;top:0;';
    document.body.append(host);
    const out: Record<string, number[]> = {};
    for (const [name, url] of Object.entries(FONTS)) {
        const face = new FontFace(`Probe ${name}`, `url(${url})`);
        await face.load();
        document.fonts.add(face);
    }
    for (const [config, font, style] of CONFIGS) {
        const family = `Probe ${font}`;
        const widths: number[] = [];
        for (const size of SIZES) {
            for (const n of LENGTHS) {
                const line = document.createElement('div');
                line.style.cssText = `font-size:${size}px;width:max-content;white-space:pre;${STYLES[style]}`;
                // Inline and important, over the harness's own important blank font
                line.style.setProperty('font-family', `"${family}"`, 'important');
                line.textContent = 'x'.repeat(n);
                host.append(line);
                widths.push(Math.round(line.getBoundingClientRect().width * 64));
                line.remove();
            }
        }
        out[config] = widths;
    }
    host.remove();
    const platform = navigator.userAgent.includes('Windows') ? 'windows' : navigator.userAgent.includes('Mac') ? 'mac' : 'linux';
    if (platform === 'windows' && import.meta.env.VITE_PROBE_WRITE === '1') {
        await commands.writeFile('./probe-windows.json', JSON.stringify(out));
        return;
    }
    const expected = JSON.parse(await commands.readFile('./probe-windows.json')) as Record<string, number[]>;
    const lines: string[] = [`${platform}: sizes ${SIZES.length}, lengths ${LENGTHS.join('/')}`];
    for (const [name] of CONFIGS) {
        const parts: string[] = [];
        for (const [grid, inGrid] of GRIDS) {
            let sizes = 0;
            let bad = 0;
            let maxDiff = 0;
            const examples: string[] = [];
            for (let si = 0; si < SIZES.length; si++) {
                if (!inGrid(SIZES[si])) continue;
                sizes++;
                let isBad = false;
                for (let li = 0; li < LENGTHS.length; li++) {
                    const i = si * LENGTHS.length + li;
                    const diff = out[name][i] - expected[name][i];
                    if (diff === 0) continue;
                    isBad = true;
                    maxDiff = Math.max(maxDiff, Math.abs(diff));
                    if (examples.length < 4) examples.push(`${SIZES[si]}x${LENGTHS[li]}:${diff}`);
                }
                if (isBad) bad++;
            }
            parts.push(`${grid} ${bad}/${sizes} max ${maxDiff} [${examples.join(' ')}]`);
        }
        lines.push(`${name}: ${parts.join('; ')}`);
    }
    throw new Error(`PROBE ${lines.join(' | ')}`);
});

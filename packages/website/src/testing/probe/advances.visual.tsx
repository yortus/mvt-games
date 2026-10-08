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
for (let s = 80; s <= 320; s++) SIZES.push(s / 10);
SIZES.push(13.333333, 10.666667, 14.666667, 21.333333, 13.3333333333, 15.12, 17.28, 13.75);
const LENGTHS = [1, 7, 55];

test('advances', async () => {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:0;top:0;';
    document.body.append(host);
    const out: Record<string, number[]> = {};
    for (const [name, url] of Object.entries(FONTS)) {
        const family = `Probe ${name}`;
        const face = new FontFace(family, `url(${url})`);
        await face.load();
        document.fonts.add(face);
        const widths: number[] = [];
        for (const size of SIZES) {
            for (const n of LENGTHS) {
                const line = document.createElement('div');
                line.style.cssText = `font-family:"${family}";font-size:${size}px;width:max-content;white-space:pre`;
                line.textContent = 'x'.repeat(n);
                host.append(line);
                widths.push(Math.round(line.getBoundingClientRect().width * 64));
                line.remove();
            }
        }
        out[name] = widths;
    }
    host.remove();
    const platform = navigator.userAgent.includes('Windows') ? 'windows' : navigator.userAgent.includes('Mac') ? 'mac' : 'linux';
    if (platform === 'windows' && import.meta.env.VITE_PROBE_WRITE === '1') {
        await commands.writeFile('./probe-windows.json', JSON.stringify(out));
        return;
    }
    const expected = JSON.parse(await commands.readFile('./probe-windows.json')) as Record<string, number[]>;
    const lines: string[] = [`${platform}: sizes ${SIZES.length}, lengths ${LENGTHS.join('/')}`];
    for (const name of Object.keys(FONTS)) {
        const mismatches: string[] = [];
        let maxDiff = 0;
        const bySize = new Set<number>();
        for (let i = 0; i < out[name].length; i++) {
            const diff = out[name][i] - expected[name][i];
            if (diff === 0) continue;
            const size = SIZES[Math.floor(i / LENGTHS.length)];
            const n = LENGTHS[i % LENGTHS.length];
            bySize.add(size);
            maxDiff = Math.max(maxDiff, Math.abs(diff));
            if (mismatches.length < 12) mismatches.push(`${size}x${n}:${expected[name][i]}->${out[name][i]}`);
        }
        lines.push(`${name}: ${bySize.size} sizes differ, max ${maxDiff}/64. ${mismatches.join(' ')}`);
    }
    throw new Error(`PROBE ${lines.join(' | ')}`);
});

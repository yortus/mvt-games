// Spike: run every text variant, here (update: write the references) or in CI (compare with them).
//   node packages/website/visual-spike/run-variants.mjs update|compare <label-prefix>
// References per variant: visual-spike/__refs-v-<variant>__/ (calibration PNGs and every hash committed).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const [mode = 'compare', prefix = 'local'] = process.argv.slice(2);
const root = join(import.meta.dirname, '..', '..', '..');
const FLAGS = '--font-render-hinting=none --disable-font-subpixel-positioning';
const VARIANTS = [
    { name: 'native', env: {}, speed: true },
    { name: 'paths', env: { SPIKE_TEXT_AS_PATHS: '1' }, speed: true },
    { name: 'colr', env: { SPIKE_COLR: '1' }, speed: false },
    { name: 'flags', env: { SPIKE_EXTRA_ARGS: FLAGS }, speed: false },
    { name: 'colrflags', env: { SPIKE_COLR: '1', SPIKE_EXTRA_ARGS: FLAGS }, speed: false },
    // HTML: each file brings its own stylesheet, so each runs in a fresh page
    ...['native', 'blank', 'block', 'blankreal', 'blanktt', 'green'].map((m) => ({ name: `h-${m}`, env: { SPIKE_HTML_TEXT: m, SPIKE_ISOLATE: '1' }, html: true })),
    // TrueType blank text with hinting off: Linux keeps fractional advances, as Windows and macOS do
    { name: 'h-blanktt-nohint', env: { SPIKE_HTML_TEXT: 'blanktt', SPIKE_ISOLATE: '1', SPIKE_EXTRA_ARGS: '--font-render-hinting=none' }, html: true },
    // The same, with form controls' default size made whole; and again with software compositing
    { name: 'h-final', env: { SPIKE_HTML_TEXT: 'blanktt', SPIKE_ISOLATE: '1', SPIKE_CONTROL_SIZE: '1', SPIKE_EXTRA_ARGS: '--font-render-hinting=none' }, html: true },
    { name: 'h-final-sw', env: { SPIKE_HTML_TEXT: 'blanktt', SPIKE_ISOLATE: '1', SPIKE_CONTROL_SIZE: '1', SPIKE_EXTRA_ARGS: '--font-render-hinting=none --disable-gpu --disable-gpu-compositing' }, html: true },
];
const only = process.env.SPIKE_VARIANTS?.split(',');

if (!existsSync(join(import.meta.dirname, 'speed', 'generated'))) {
    spawnSync(process.execPath, [join(import.meta.dirname, 'speed', 'generate.mjs')], { stdio: 'inherit' });
}

for (const v of VARIANTS) {
    if (only && !only.includes(v.name)) continue;
    const include = v.html ? ['visual-spike/html/*.visual.tsx'] : ['visual-spike/calibration.visual.tsx', 'visual-spike/entries.visual.tsx'];
    if (v.speed) include.push('visual-spike/speed/generated/*.visual.tsx');
    const env = {
        ...process.env,
        ...v.env,
        SPIKE_MODE: mode,
        SPIKE_REFS: v.html ? `__refs-${v.name}__` : `__refs-v-${v.name}__`,
        SPIKE_LABEL: `${prefix}-${v.name}`,
        SPIKE_INCLUDE: include.join(','),
        VITE_CONFIG_NATIVE_IGNORE_WARNING: 'true',
    };
    const t0 = Date.now();
    const r = spawnSync('npx', ['vitest', 'run', '--config', 'packages/website/visual-spike/vitest.config.ts'], { cwd: root, env, encoding: 'utf8', shell: true });
    const summary = (r.stdout + r.stderr).split('\n').filter((l) => /Tests\s+\d|Test Files/.test(l)).join(' | ');
    console.log(`${v.name}: ${summary.replace(/\s+/g, ' ')} wall ${Date.now() - t0} ms`);
}

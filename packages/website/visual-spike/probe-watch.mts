// Spike probe: watch mode. Start once (browser up, modules loaded), then time re-runs of one file
// after editing the view it tests, as a developer would.
// Run from the repo root: npx tsx packages/website/visual-spike/probe-watch.mts
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createVitest } from 'vitest/node';

process.env.SPIKE_INCLUDE = 'visual-spike/speed/generated/*.visual.tsx';
process.env.SPIKE_REFS = '__refs-speed__';
process.env.SPIKE_LABEL = 'watch';
const file = resolve('packages/website/visual-spike/speed/generated/speed-002.visual.tsx').replace(/\\/g, '/');
const view = resolve('packages/website/src/entries/fruit-machine/views/pixi/spin-button-view.tsx');
const results = resolve('packages/website/visual-spike/results/watch.json');
const original = readFileSync(view, 'utf8');

const lastAt = (): number => Math.max(...Object.values(JSON.parse(readFileSync(results, 'utf8')) as Record<string, { at?: number }>).map((r) => r.at ?? 0));

let t = performance.now();
const vitest = await createVitest('test', { config: resolve('packages/website/visual-spike/vitest.config.ts'), watch: true, reporters: ['dot'] });
await vitest.start([file]);
console.log(`\nfirst run of one file (browser launch included): ${Math.round(performance.now() - t)} ms, last picture at ${lastAt()}`);
try {
    for (let i = 0; i < 3; i++) {
        writeFileSync(view, `${original}\n// edit ${i}\n`);
        const edited = vitest.vite.moduleGraph.getModulesByFile(view.replace(/\\/g, '/'));
        console.log(`modules for the view in the graph: ${edited?.size ?? 0}`);
        t = performance.now();
        await vitest.rerunFiles([file]);
        console.log(`\nre-run ${i + 1} after an edit: ${Math.round(performance.now() - t)} ms, last picture at ${lastAt()}`);
    }
}
finally {
    writeFileSync(view, original);
}
await vitest.close();
process.exit(0);

// Spike: summarise a results file's timings, or compare two results files' hashes.
//   node analyse.mjs <label>            timings
//   node analyse.mjs <label> <label2>   which pictures differ
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const load = (label) => JSON.parse(readFileSync(join(import.meta.dirname, 'results', `${label}.json`), 'utf8'));
const [a, b] = process.argv.slice(2);
const A = load(a);

if (b) {
    const B = load(b);
    let same = 0;
    for (const key of Object.keys(A)) {
        if (!(key in B)) { console.log('missing in', b, key); continue; }
        if (A[key].hash === B[key].hash) same++;
        else console.log('DIFFERS', key, B[key].changed !== undefined ? `(${B[key].changed} px, max delta ${B[key].maxDelta})` : '');
    }
    console.log(`${same} of ${Object.keys(A).length} identical`);
}
else {
    const pct = (xs, p) => xs.length ? [...xs].sort((x, y) => x - y)[Math.min(xs.length - 1, Math.floor(p * xs.length))] : NaN;
    const groups = {};
    for (const [key, r] of Object.entries(A)) {
        const kind = key.includes('> dom >') ? 'html' : 'webgl';
        const total = Object.entries(r.ms).filter(([k]) => k !== 'slowPath' || true).reduce((s, [, v]) => s + v, 0);
        (groups[kind] ??= []).push({ key, total, ...r.ms, px: r.width * r.height });
    }
    for (const [kind, rows] of Object.entries(groups)) {
        const fields = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((f) => f !== 'key');
        console.log(`\n${kind}: ${rows.length} pictures`);
        for (const f of fields) console.log(`  ${f.padEnd(10)} median ${pct(rows.map((r) => r[f] ?? 0), 0.5).toFixed(2).padStart(9)}  p95 ${pct(rows.map((r) => r[f] ?? 0), 0.95).toFixed(2).padStart(9)}  sum ${rows.reduce((s, r) => s + (r[f] ?? 0), 0).toFixed(0).padStart(7)}`);
        console.log('  slowest:');
        for (const r of [...rows].sort((x, y) => y.total - x.total).slice(0, 6)) console.log(`    ${r.total.toFixed(1).padStart(7)} ms  ${r.key}  (${r.px} px)`);
    }
}

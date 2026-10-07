// Spike: summarise a CI run as GitHub annotations (readable through the public API without a token).
//   node ci-summary.mjs <os-label>
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const os = process.argv[2];
const VARIANTS = (process.env.SPIKE_VARIANTS ?? 'native,paths,colr,flags,colrflags,h-native,h-blank,h-block,h-blankreal,h-blanktt,h-blanktt-nohint,h-green').split(',');
const load = (label) => {
    const file = join(import.meta.dirname, 'results', `${label}.json`);
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined;
};
const notice = (title, lines) => console.log(`::notice title=${os} ${title}::${lines.join('%0A').slice(0, 3800)}`);

let envShown = false;
for (const v of VARIANTS) {
    const r = load(`ci-${os}-${v}`);
    if (r === undefined) {
        notice(v, ['no results']);
        continue;
    }
    if (!envShown) {
        const e = r._environment ?? {};
        notice('environment', [e.userAgent, e.platform, `cores ${e.cores}`, e.webglRenderer]);
        envShown = true;
    }
    const lines = [];
    const kinds = {};
    for (const [key, x] of Object.entries(r)) {
        if (key === '_environment') continue;
        if (key === '_advances') { lines.push('advances: ' + Object.entries(x).map(([k, v]) => k + ' ' + v).join(' | ')); continue; }
        if (key === '_metrics') { lines.push('metrics: ' + Object.entries(x).map(([k, v]) => k + ' ' + v).join('; ')); continue; }
        const [file, group, name] = key.split(' > ');
        const kind = file.startsWith('html/') ? file.slice(5).replace('.visual.tsx', '') + (group === 'no text' ? ' (no text)' : '') : file.startsWith('calibration') ? `cal ${group}` : file.startsWith('entries') ? 'entries' : `speed ${name.split(' ')[0]}`;
        kinds[kind] ??= [0, 0];
        const same = x.verdict === 'same';
        kinds[kind][same ? 0 : 1]++;
        if (!same && (file.startsWith('calibration') || file.startsWith('html/'))) lines.push(`${group} > ${name}: ${x.verdict}${x.changed !== undefined ? ` ${x.changed}px (not green ${x.notGreen}) max ${x.maxDelta}` : ''}`);
        if (!same && file.startsWith('entries') && name.endsWith('thumbnail')) lines.push(`entry ${name}: ${x.verdict}${x.changed !== undefined ? ` ${x.changed}px` : ''}`);
    }
    const counts = Object.entries(kinds).map(([k, [s, d]]) => `${k} ${s}/${s + d}`).join(', ');
    notice(`${v} (same/total)`, [counts, ...lines]);
}

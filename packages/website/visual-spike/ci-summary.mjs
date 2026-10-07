// Spike: summarise a CI run as GitHub annotations (readable through the public API without a token).
//   node ci-summary.mjs <os-label>
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const os = process.argv[2];
const load = (label) => {
    const file = join(import.meta.dirname, 'results', `${label}.json`);
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
};
const notice = (title, lines) => {
    const text = lines.join('%0A').slice(0, 3800);
    console.log(`::notice title=${os} ${title}::${text}`);
};

const cal = load(`ci-${os}-cal`);
const speed = load(`ci-${os}-speed`);
const localSpeed = load('speed-local');
const env = cal._environment ?? speed._environment ?? {};
notice('environment', [env.userAgent, env.platform, `cores ${env.cores}`, env.webglRenderer, `${env.locale} ${env.timeZone} dpr ${env.devicePixelRatio}`]);

// Calibration and entries: compared against the references made on Windows
const calLines = [];
let calSame = 0;
for (const [key, r] of Object.entries(cal)) {
    if (key === '_environment') continue;
    if (r.verdict === 'same') calSame++;
    else calLines.push(`${r.verdict} ${key.replace('.visual.tsx', '')}${r.changed !== undefined ? ` (${r.changed}px, max ${r.maxDelta})` : ''}`);
}
notice('calibration+entries', [`${calSame} of ${Object.keys(cal).length - 1} identical to Windows refs`, ...calLines]);

// Speed suite: hashes against this repo's Windows run
let same = 0;
let total = 0;
const differ = {};
const names = [];
for (const [key, r] of Object.entries(speed)) {
    if (key === '_environment') continue;
    total++;
    if (localSpeed[key]?.hash === r.hash) same++;
    else {
        const kind = key.split(' > ')[2].split(' ')[0];
        differ[kind] = (differ[kind] ?? 0) + 1;
        if (names.length < 40) names.push(key.split(' > ')[2]);
    }
}
notice('speed hashes', [`${same} of ${total} identical to Windows`, JSON.stringify(differ), ...names]);

// Timing
const rows = Object.entries(speed).filter(([k]) => k !== '_environment').map(([, r]) => r);
const totals = rows.map((r) => Object.entries(r.ms).filter(([k]) => k !== 'slowPath').reduce((s, [, v]) => s + v, 0)).sort((a, b) => a - b);
const pct = (p) => totals[Math.min(totals.length - 1, Math.floor(p * totals.length))]?.toFixed(2);
const ats = rows.map((r) => r.at).sort((a, b) => a - b);
notice('timing', [
    `fast-path per picture (no slow path): median ${pct(0.5)} ms, p95 ${pct(0.95)} ms`,
    `first picture at ${ats[0]} ms page time, last at ${ats[ats.length - 1]} ms`,
    `wall: ${process.env.SPEED_WALL ?? '?'}`,
]);

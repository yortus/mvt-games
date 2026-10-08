// Temporary: blank-font variants for the advance probe
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const here = import.meta.dirname;
const source = readFileSync(resolve(here, '../../../scripts/visual/blank-font.ts'), 'utf8');
const variants: [string, number, number, number, number][] = [
    ['cur', 1000, 600, 800, 200],
    ['a500', 1000, 500, 800, 200],
    ['a625', 1000, 625, 800, 200],
    ['u1024a640', 1024, 640, 820, 204],
    ['u2048a1024', 2048, 1024, 1638, 410],
    ['u2048a1280', 2048, 1280, 1638, 410],
    ['u16a8', 16, 8, 13, 3],
    ['u64a40', 64, 40, 51, 13],
];
for (const [name, upm, adv, asc, desc] of variants) {
    const patched = source
        .replace('const UNITS_PER_EM = 1000;', `const UNITS_PER_EM = ${upm};`)
        .replace('const ADVANCE = 600;', `const ADVANCE = ${adv};`)
        .replace('const ASCENT = 800;', `const ASCENT = ${asc};`)
        .replace('const DESCENT = 200;', `const DESCENT = ${desc};`);
    const tmp = resolve(here, `tmp-${name}.ts`);
    writeFileSync(tmp, patched);
    const { buildBlankFont } = await import(pathToFileURL(tmp).href);
    writeFileSync(resolve(here, `${name}.ttf`), buildBlankFont({ family: `Probe ${name}` }));
}

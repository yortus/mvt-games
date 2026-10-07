// Spike: writes the speed suite, 100 files of 10 pictures each (gitignored).
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, 'generated');
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
for (let f = 0; f < 100; f++) {
    const lines = [
        `import { describe } from 'vitest';`,
        `import { visualTest } from '../../harness';`,
        `import { speedPose } from '../poses';`,
        ``,
        `describe('speed ${f}', () => {`,
        `    for (let i = ${f * 10}; i < ${f * 10 + 10}; i++) {`,
        `        const p = speedPose(i);`,
        `        visualTest(p.name, p.pose, p.options);`,
        `    }`,
        `});`,
        ``,
    ];
    writeFileSync(join(dir, `speed-${String(f).padStart(3, '0')}.visual.tsx`), lines.join('\n'));
}
console.log('wrote 100 files');

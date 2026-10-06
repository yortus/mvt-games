/**
 * Run all per-game texture generators.
 *
 * Usage:  npm run generate-textures
 *
 * Discovers and executes every `scripts/generate-*-textures.ts` file.
 * Add a new generator for each game - it will be picked up automatically.
 */

import { globSync } from 'glob';
import { execFileSync } from 'node:child_process';

const scripts = globSync('scripts/generate-*-textures.ts');

if (scripts.length === 0) {
    console.log('No texture generators found.');
    process.exit(0);
}

console.log(`Found ${scripts.length} texture generator(s):\n`);

for (const script of scripts) {
    console.log(`▸ ${script}`);
    execFileSync('npx', ['tsx', script], { stdio: 'inherit', shell: true });
    console.log();
}

console.log('All texture generators complete.');

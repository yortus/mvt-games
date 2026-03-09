/**
 * Run all per-game sprite generators.
 *
 * Usage:  npm run generate-sprites
 *
 * Discovers and executes every `scripts/generate-*-sprites.ts` file.
 * Add a new generator for each game — it will be picked up automatically.
 */

import { globSync } from 'glob';
import { execFileSync } from 'node:child_process';

const scripts = globSync('scripts/generate-*-sprites.ts');

if (scripts.length === 0) {
    console.log('No sprite generators found.');
    process.exit(0);
}

console.log(`Found ${scripts.length} sprite generator(s):\n`);

for (const script of scripts) {
    console.log(`▸ ${script}`);
    execFileSync('npx', ['tsx', script], { stdio: 'inherit', shell: true });
    console.log();
}

console.log('All sprite generators complete.');

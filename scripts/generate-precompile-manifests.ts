/**
 * Saves every JSX target's precompile manifest beside it, from its element
 * table. Run after changing an element table; `precompile-manifests.test.ts`
 * fails until you do.
 *
 * Usage:  npm run generate-precompile-manifests
 */

import { writeFileSync } from 'node:fs';
import { formatManifest, precompileManifests } from './precompile-manifests';

const files = precompileManifests();
for (let i = 0; i < files.length; i++) {
    writeFileSync(files[i].path, formatManifest(files[i].manifest));
    console.log(`▸ ${files[i].path}`);
}

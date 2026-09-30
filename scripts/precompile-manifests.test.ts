import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatManifest, precompileManifests } from './precompile-manifests';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// In Node: every table can be read without a renderer running. The precompiler itself never reads them, only the saved manifests.
describe('precompile manifests', () => {
    const imports = (JSON.parse(readFileSync('package.json', 'utf8')) as { imports: Record<string, string> }).imports;

    for (const file of precompileManifests()) {
        describe(file.importSource, () => {
            it('is saved as its element table makes it (else run npm run generate-precompile-manifests)', () => {
                expect(readFileSync(file.path, 'utf8')).toBe(formatManifest(file.manifest));
            });

            it('is what <importSource>/precompile resolves to', () => {
                expect(imports[`${file.importSource}/precompile`]).toBe(`./${file.path}`);
            });
        });
    }
});

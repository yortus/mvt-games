import { RuleTester } from 'eslint';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import tseslint from 'typescript-eslint';
import { afterAll, describe, it } from 'vitest';
import { noDeepImports } from './no-deep-imports';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({ languageOptions: { parser: tseslint.parser } });

// Two installed packages, one with an `exports` field and one without, for a
// file in `src/` to import.
const root = mkdtempSync(join(tmpdir(), 'no-deep-imports-'));
writePackage('with-exports', { name: 'with-exports', exports: { '.': './index.js', './extra': './extra.js' } });
writePackage('@scope/with-exports', { name: '@scope/with-exports', exports: './index.js' });
writePackage('without-exports', { name: 'without-exports', main: './index.js' });
writePackage('@scope/without-exports', { name: '@scope/without-exports', main: './index.js' });
const filename = join(root, 'src', 'game', 'file.ts');

afterAll(() => rmSync(root, { recursive: true, force: true }));

ruleTester.run('no-deep-imports', noDeepImports, {
    valid: [
        // A file in the same folder, a folder, or a folder further up.
        { code: 'import { a } from \'./a\';', filename },
        { code: 'import { a } from \'../models\';', filename },
        { code: 'import { a } from \'../../shared\';', filename },
        { code: 'export { a } from \'../models\';', filename },
        { code: 'export * from \'./a\';', filename },
        { code: 'const m = import(\'./a\');', filename },
        { code: 'type T = import(\'../models\').Model;', filename },
        // Packages by name, and through an `exports` field.
        { code: 'import a from \'with-exports\';', filename },
        { code: 'import a from \'with-exports/extra\';', filename },
        { code: 'import a from \'@scope/with-exports/extra\';', filename },
        { code: 'import a from \'without-exports\';', filename },
        { code: 'import a from \'@scope/without-exports\';', filename },
        // Subpath imports, Node's own modules, and packages that are not installed.
        { code: 'import a from \'#shared\';', filename },
        { code: 'import a from \'fs/promises\';', filename },
        { code: 'import a from \'node:fs/promises\';', filename },
        { code: 'import a from \'not-installed/deep\';', filename },
        // A file the bundler turns into something else, such as a worklet's URL.
        { code: 'import url from \'./worklet/processor?worker&url\';', filename },
        // A folder's index file by its full name, where allowed.
        { code: 'import a from \'./scripts/index.ts\';', filename, options: [{ allowIndexFile: true }] },
    ],
    invalid: [
        { code: 'import { a } from \'./models/ship-model\';', filename, errors: [{ messageId: 'pastBarrel' }] },
        { code: 'import { a } from \'../models/ship-model\';', filename, errors: [{ messageId: 'pastBarrel' }] },
        { code: 'import { a } from \'../../utils/src/watch\';', filename, errors: [{ messageId: 'pastBarrel' }] },
        { code: 'import { a } from \'../models/index\';', filename, errors: [{ messageId: 'pastBarrel' }] },
        { code: 'export { a } from \'../models/ship-model\';', filename, errors: [{ messageId: 'pastBarrel' }] },
        { code: 'export * from \'./models/ship-model\';', filename, errors: [{ messageId: 'pastBarrel' }] },
        { code: 'const m = import(\'./models/ship-model\');', filename, errors: [{ messageId: 'pastBarrel' }] },
        { code: 'type T = import(\'../models/ship-model\').Model;', filename, errors: [{ messageId: 'pastBarrel' }] },
        { code: 'import a from \'./scripts/index.ts\';', filename, errors: [{ messageId: 'pastBarrel' }] },
        { code: 'import a from \'./scripts/lib/index.ts\';', filename, options: [{ allowIndexFile: true }], errors: [{ messageId: 'pastBarrel' }] },
        { code: 'import a from \'without-exports/lib/a.js\';', filename, errors: [{ messageId: 'intoPackage' }] },
        { code: 'import a from \'@scope/without-exports/lib/a.js\';', filename, errors: [{ messageId: 'intoPackage' }] },
    ],
});

/** Writes `node_modules/<name>/package.json` under the test's folder. */
function writePackage(name: string, manifest: object): void {
    const dir = join(root, 'node_modules', name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest));
}

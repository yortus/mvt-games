import { RuleTester } from 'eslint';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import tseslint from 'typescript-eslint';
import { afterAll, describe, it } from 'vitest';
import { noRelativeImportsIntoSrc } from './no-relative-imports-into-src';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({ languageOptions: { parser: tseslint.parser } });

// Two packages side by side: a site with a worker and scripts beside its
// `src/`, and a library.
const root = mkdtempSync(join(tmpdir(), 'no-relative-imports-into-src-'));
writePackage('site');
writePackage('library');
const inSrc = join(root, 'site', 'src', 'game', 'file.ts');
const inWorker = join(root, 'site', 'worker', 'index.ts');
const inScripts = join(root, 'site', 'scripts', 'build', 'run.ts');
const inOtherSrc = join(root, 'library', 'src', 'file.ts');

afterAll(() => rmSync(root, { recursive: true, force: true }));

ruleTester.run('no-relative-imports-into-src', noRelativeImportsIntoSrc, {
    valid: [
        // Inside `src/`, relative imports stay inside it.
        { code: 'import { a } from \'../models\';', filename: inSrc },
        { code: 'import { a } from \'../../src/models\';', filename: inSrc },
        // Outside `src/`, a mapping, a package name, or a path that stays outside `src/`.
        { code: 'import { a } from \'#highscores\';', filename: inWorker },
        { code: 'import { a } from \'site\';', filename: inWorker },
        { code: 'import { a } from \'./rules\';', filename: inWorker },
        { code: 'import { a } from \'../scripts\';', filename: inWorker },
        { code: 'import { a } from \'../../worker\';', filename: inScripts },
        // A folder that is only named like `src`.
        { code: 'import { a } from \'../srcs\';', filename: inWorker },
    ],
    invalid: [
        { code: 'import { a } from \'../src/highscores\';', filename: inWorker, errors: [{ messageId: 'intoSrc' }] },
        { code: 'import { a } from \'../src\';', filename: inWorker, errors: [{ messageId: 'intoSrc' }] },
        { code: 'import { a } from \'../../src/highscores/rules\';', filename: inScripts, errors: [{ messageId: 'intoSrc' }] },
        { code: 'export * from \'../src/highscores\';', filename: inWorker, errors: [{ messageId: 'intoSrc' }] },
        { code: 'export { a } from \'../src/highscores\';', filename: inWorker, errors: [{ messageId: 'intoSrc' }] },
        { code: 'const m = import(\'../src/highscores\');', filename: inWorker, errors: [{ messageId: 'intoSrc' }] },
        { code: 'type T = import(\'../src/highscores\').Table;', filename: inWorker, errors: [{ messageId: 'intoSrc' }] },
        // Another package's `src/`, even from inside a `src/` of its own.
        { code: 'import { a } from \'../../site/src/highscores\';', filename: inOtherSrc, errors: [{ messageId: 'intoSrc' }] },
    ],
});

/** Writes `<name>/package.json` under the test's folder. */
function writePackage(name: string): void {
    const dir = join(root, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name }));
}

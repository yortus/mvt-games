import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import { noModuleState } from './no-module-state';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({ languageOptions: { parser: tseslint.parser } });

ruleTester.run('no-module-state', noModuleState, {
    valid: [
        'const SPEED = 3;',
        'export const RADII = [1, 2, 3];',
        'function createModel() { let count = 0; return { get count() { return count; } }; }',
        'export function createModel() { var legacy = 1; return legacy; }',
        'for (let i = 0; i < 3; i++) {}',
    ],
    invalid: [
        { code: 'let nextSeed = 1;', errors: [{ messageId: 'moduleState' }] },
        { code: 'var count = 0;', errors: [{ messageId: 'moduleState' }] },
        { code: 'export let shared = 0;', errors: [{ messageId: 'moduleState' }] },
        { code: 'let a = 1, b = 2;', errors: [{ messageId: 'moduleState' }, { messageId: 'moduleState' }] },
    ],
});

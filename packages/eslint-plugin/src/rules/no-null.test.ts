import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import { noNull } from './no-null';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

ruleTester.run('no-null', noNull, {
    valid: [
        'let selected: Item | undefined;',
        'if (child === null) stop();',
        'if (null !== el.firstElementChild) go();',
        'if (parent == null) stop();',
        "const text = 'null';",
        '// null in a comment',
    ],
    invalid: [
        { code: 'let selected = null;', errors: [{ messageId: 'value' }] },
        { code: 'find(null);', errors: [{ messageId: 'value' }] },
        { code: 'const x = a ?? null;', errors: [{ messageId: 'value' }] },
        { code: 'let selected: Item | null;', errors: [{ messageId: 'type' }] },
        { code: 'function find(id: string): Item | null { return null; }', errors: [{ messageId: 'type' }, { messageId: 'value' }] },
    ],
});

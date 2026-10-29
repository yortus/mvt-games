import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import { noEmDash } from './no-em-dash';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

// Built from its code point, so this file holds no em-dash of its own
const EM = String.fromCodePoint(0x2014);

ruleTester.run('no-em-dash', noEmDash, {
    valid: [
        '// a hyphen - not a dash',
        'const s = \'plain text\';',
        // The escape sequence is code, not prose
        'const escaped = \'\\u2014\';',
    ],
    invalid: [
        { code: `// before ${EM} after`, output: '// before - after', errors: [{ messageId: 'emDash' }] },
        { code: `/* one ${EM} two ${EM} three */`, output: '/* one - two - three */', errors: 2 },
        { code: `const s = 'a ${EM} b';`, output: 'const s = \'a - b\';', errors: 1 },
        { code: 'const t = `a ' + EM + ' ${x}`;', output: 'const t = `a - ${x}`;', errors: 1 },
        { code: `const v = <p>a ${EM} b</p>;`, output: 'const v = <p>a - b</p>;', errors: 1 },
    ],
});

import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import { noThis } from './no-this';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

ruleTester.run('no-this', noThis, {
    valid: [
        'const model = { x: 0, update: (deltaMs: number) => { model.x += deltaMs; } };',
        "// this in a comment, and in a string: 'this'",
    ],
    invalid: [
        { code: 'function f() { return this.x; }', errors: [{ messageId: 'this' }] },
        { code: 'const o = { m() { this.y = 1; } };', errors: [{ messageId: 'this' }] },
        { code: 'proto.addChild = function addChild(this: Container) { return base.call(this); };', errors: [{ messageId: 'this' }] },
    ],
});

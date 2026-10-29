import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import { noNull } from './no-null';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({ languageOptions: { parser: tseslint.parser } });

ruleTester.run('no-null', noNull, {
    valid: [
        'let selected: Item | undefined;',
        // Checking a third-party value
        'if (child === null) stop();',
        'if (null !== el.firstElementChild) go();',
        'if (parent == null) stop();',
        // Holding a third-party value where it arrives
        'function bubble(object: Object3D) { for (let node: Object3D | null = object; node !== null; node = node.parent) visit(node); }',
        'function nav() { const el = document.querySelector(".nav") as HTMLElement | null; return el; }',
        'const pick = () => params.get("view") as string | null;',
        'function outer() { function inner(x: string | null) { return x; } return inner; }',
        // Not `null`
        'const text = \'null\';',
        '// null in a comment',
    ],
    invalid: [
        { code: 'let selected = null;', errors: [{ messageId: 'value' }] },
        { code: 'find(null);', errors: [{ messageId: 'value' }] },
        { code: 'const x = a ?? null;', errors: [{ messageId: 'value' }] },
        { code: 'function f() { return null; }', errors: [{ messageId: 'value' }] },
        { code: 'let selected: Item | null;', errors: [{ messageId: 'type' }] },
        { code: 'export interface Options { readonly parent: Node | null }', errors: [{ messageId: 'type' }] },
        { code: 'type Maybe = string | null;', errors: [{ messageId: 'type' }] },
        { code: 'function pick(value: string | null): string { return value ?? \'\'; }', errors: [{ messageId: 'type' }] },
        { code: 'function find(id: string): Item | null { return lookup(id); }', errors: [{ messageId: 'type' }] },
        { code: 'const f = (x: number): number | null => x;', errors: [{ messageId: 'type' }] },
    ],
});

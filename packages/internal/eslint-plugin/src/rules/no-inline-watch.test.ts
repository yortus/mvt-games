import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import { noInlineWatch } from './no-inline-watch';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

const IMPORTS = "import { createComputed, createReaction, watch } from '@mvtjs/utils';\n";

ruleTester.run('no-inline-watch', noInlineWatch, {
    valid: [
        IMPORTS + 'const watcher = watch(bindings.phase);\nconst w = watcher.poll();',
        IMPORTS + 'const playExplosionSoundWhenDying = createReaction({ watch: bindings.phase, react: play });\nplayDeath();',
        IMPORTS + 'const scoreText = createComputed({ watch: bindings.score, compute: format });\nscoreText();',
        // Passed on, as a JSX prop or into an array, to be read later
        IMPORTS + 'const view = <text text={createComputed({ watch: bindings.score, compute: format })} />;',
        IMPORTS + 'const reactions = [createReaction({ watch: bindings.phase, react: play })];',
        // Another function that's called watch is left alone
        'watch(path).close();',
    ],
    invalid: [
        {
            code: IMPORTS + 'const w = watch(bindings.phase).poll();',
            errors: [{ messageId: 'inline', data: { name: 'watch', consequence: 'never sees a change' } }],
        },
        {
            code: IMPORTS + 'createReaction({ watch: bindings.phase, react: play })();',
            errors: [{ messageId: 'inline', data: { name: 'createReaction', consequence: 'never sees a change' } }],
        },
        {
            code: IMPORTS + 'const text = createComputed({ watch: bindings.score, compute: format })();',
            errors: [{ messageId: 'inline', data: { name: 'createComputed', consequence: 'never caches' } }],
        },
        {
            code: IMPORTS + 'const version = createComputed({ watch: bindings.score, compute: format }).version;',
            errors: [{ messageId: 'inline', data: { name: 'createComputed', consequence: 'never caches' } }],
        },
    ],
});

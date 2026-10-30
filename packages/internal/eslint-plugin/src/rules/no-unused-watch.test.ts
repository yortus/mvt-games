import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import { noUnusedWatch } from './no-unused-watch';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({ languageOptions: { parser: tseslint.parser } });

const IMPORTS = "import { createComputed, createReaction, watch } from '@mvtjs/utils';\n";

ruleTester.run('no-unused-watch', noUnusedWatch, {
    valid: [
        IMPORTS + 'const watcher = watch(bindings.phase);\nfunction refresh() { const w = watcher.poll(); }',
        IMPORTS + 'const playExplosionSoundWhenDying = createReaction({ watch: bindings.phase, react: play });\nsetRefresh(view, playExplosionSoundWhenDying);',
        IMPORTS + 'const playExplosionSoundWhenDying = createReaction({ watch: bindings.phase, react: play });\nfunction refresh() { playExplosionSoundWhenDying(); }',
        IMPORTS + 'const reactions = [createReaction({ watch: bindings.phase, react: play })];',
        IMPORTS + 'const watcher = watch(bindings.phase);\nreturn { watcher };',
        IMPORTS + 'const watcher = watch(bindings.phase);\nusePoller(watcher);',
        IMPORTS + 'const view = { watcher: watch(bindings.phase) };',
        // A computed value that's never read costs nothing, and TypeScript reports an unused variable
        IMPORTS + 'const scoreText = createComputed({ watch: bindings.score, compute: format });',
        // Another function that's called watch is left alone
        "import { watch } from 'node:fs';\nwatch(path);",
        // The library's own files import it by a relative path
        "import { watch } from './watch';\nconst watcher = watch(bindings.phase);\nwatcher.poll();",
        'watch(path);',
    ],
    invalid: [
        {
            code: IMPORTS + 'const watcher = watch(bindings.phase);',
            errors: [{ messageId: 'neverPolled' }],
        },
        {
            code: IMPORTS + 'const watcher = watch(bindings.phase);\nconst lives = watcher.lives;',
            errors: [{ messageId: 'neverPolled' }],
        },
        {
            code: IMPORTS + 'const playExplosionSoundWhenDying = createReaction({ watch: bindings.phase, react: play });',
            errors: [{ messageId: 'neverCalled' }],
        },
        {
            code: IMPORTS + 'watch(bindings.phase);',
            errors: [{ messageId: 'discarded', data: { name: 'watch', use: 'call its `poll()`' } }],
        },
        {
            code: IMPORTS + 'createReaction({ watch: bindings.phase, react: play });',
            errors: [{ messageId: 'discarded', data: { name: 'createReaction', use: 'call it' } }],
        },
        {
            code: "import { watch as watchValues } from '@mvtjs/utils';\nconst watcher = watchValues(bindings.phase);",
            errors: [{ messageId: 'neverPolled' }],
        },
    ],
});

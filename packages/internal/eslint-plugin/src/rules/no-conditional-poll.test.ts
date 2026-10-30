import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import { noConditionalPoll } from './no-conditional-poll';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({ languageOptions: { parser: tseslint.parser } });

const REACTION = "import { createReaction } from '@mvtjs/utils';\n"
    + 'const playExplosionSoundWhenDying = createReaction({ watch: bindings.phase, react: play });\n';

ruleTester.run('no-conditional-poll', noConditionalPoll, {
    valid: [
        'function refresh() { const w = watcher.poll(); if (w.changed) draw(); }',
        // The condition of an `if` runs on every step
        'function refresh() { if (watcher.poll().changed) draw(); }',
        'function refresh() { const w = watcher.poll(); if (!w.anyChanged) return; draw(w); }',
        // A return in a nested function is that function's own
        'function refresh() { items.forEach((item) => { if (!item) return; }); watcher.poll(); }',
        // A poll in a nested function is judged within that function
        'function refresh() { if (isOpen) { setRefresh(view, () => { watcher.poll(); }); } }',
        REACTION + 'function refresh() { playExplosionSoundWhenDying(); if (isPaused) return; }',
        REACTION + 'setRefresh(view, playExplosionSoundWhenDying);',
        // Reactions called above where they're made are found too
        "import { createReaction } from '@mvtjs/utils';\nfunction refresh() { playExplosionSoundWhenDying(); }\n"
        + 'const playExplosionSoundWhenDying = createReaction({ watch: bindings.phase, react: play });',
        // A function that isn't a reaction is left alone
        'function refresh() { if (isOpen) draw(); }',
    ],
    invalid: [
        {
            code: 'function refresh() { if (isOpen) { const w = watcher.poll(); } }',
            errors: [{ messageId: 'conditional', data: { what: 'poll' } }],
        },
        {
            code: 'function refresh() { if (isOpen) draw(); else watcher.poll(); }',
            errors: [{ messageId: 'conditional' }],
        },
        {
            code: 'const refresh = () => isOpen && watcher.poll();',
            errors: [{ messageId: 'conditional' }],
        },
        {
            code: 'const refresh = () => (isOpen ? watcher.poll() : undefined);',
            errors: [{ messageId: 'conditional' }],
        },
        {
            code: 'function refresh() { switch (phase) { case "a": watcher.poll(); break; } }',
            errors: [{ messageId: 'conditional' }],
        },
        {
            code: 'function refresh() { if (isPaused) return; const w = watcher.poll(); }',
            errors: [{ messageId: 'afterReturn', data: { what: 'poll' } }],
        },
        {
            code: 'function refresh() { if (isPaused) { return; } { const w = watcher.poll(); } }',
            errors: [{ messageId: 'afterReturn' }],
        },
        {
            code: REACTION + 'function refresh() { if (isOpen) playExplosionSoundWhenDying(); }',
            errors: [{ messageId: 'conditional', data: { what: 'reaction call' } }],
        },
        {
            code: REACTION + 'function refresh() { if (isPaused) return; playExplosionSoundWhenDying(); }',
            errors: [{ messageId: 'afterReturn', data: { what: 'reaction call' } }],
        },
    ],
});

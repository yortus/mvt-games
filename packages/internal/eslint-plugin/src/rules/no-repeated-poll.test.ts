import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import { noRepeatedPoll } from './no-repeated-poll';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({ languageOptions: { parser: tseslint.parser } });

ruleTester.run('no-repeated-poll', noRepeatedPoll, {
    valid: [
        'function refresh() { const w = watcher.poll(); if (w.changed) draw(w.current); }',
        'function refresh() { const a = phaseWatcher.poll(); const b = livesWatcher.poll(); }',
        // Each function is its own step
        'function update() { watcher.poll(); }\nfunction refresh() { watcher.poll(); }',
        'function refresh() { watcher.poll(); helpers.forEach(() => { other.poll(); }); }',
        // A poll in a nested function counts toward that function
        'function refresh() { watcher.poll(); const later = () => watcher.poll(); }',
        // A call with arguments isn't a watcher's poll
        'function refresh() { queue.poll(1); queue.poll(1); }',
    ],
    invalid: [
        {
            code: 'function refresh() { const w = watcher.poll(); if (watcher.poll().changed) draw(); }',
            errors: [{ messageId: 'repeated', data: { name: 'watcher' } }],
        },
        {
            code: 'setRefresh(view, () => { view.phaseWatcher.poll(); view.phaseWatcher.poll(); });',
            errors: [{ messageId: 'repeated', data: { name: 'view.phaseWatcher' } }],
        },
    ],
});

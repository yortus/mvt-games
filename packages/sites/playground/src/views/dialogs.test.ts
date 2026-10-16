import { describe, expect, it } from 'vitest';
import { createDialogs } from './dialogs';

describe('the page\'s dialogs', () => {
    it('give whether the visitor confirmed', async () => {
        const dialogs = createDialogs();
        const asked = dialogs.confirm({ title: 'Delete?', message: 'Gone for good.', confirmLabel: 'Delete', isDangerous: true });
        expect(dialogs.current()).toMatchObject({ title: 'Delete?', isCancellable: true, isDangerous: true });
        dialogs.answer('');
        expect(await asked).toBe(true);
        expect(dialogs.current()).toBeUndefined();

        const cancelled = dialogs.confirm({ title: 'Delete?', message: '', confirmLabel: 'Delete' });
        dialogs.answer(undefined);
        expect(await cancelled).toBe(false);
    });

    it('give what the visitor typed, or undefined if they cancelled', async () => {
        const dialogs = createDialogs();
        const asked = dialogs.prompt({ title: 'Rename', message: '', value: 'old', confirmLabel: 'Rename' });
        expect(dialogs.current()?.value).toBe('old');
        dialogs.answer('new');
        expect(await asked).toBe('new');
    });

    it('answer a dialog that another replaces as cancelled, and count each shown', async () => {
        const dialogs = createDialogs();
        const first = dialogs.prompt({ title: 'One', message: '', value: '', confirmLabel: 'OK' });
        const second = dialogs.tell({ title: 'Two', message: '' });
        expect(await first).toBeUndefined();
        expect(dialogs.current()).toMatchObject({ title: 'Two', isCancellable: false, confirmLabel: 'OK' });
        expect(dialogs.shown()).toBe(2);
        dialogs.answer('');
        await second;
    });
});

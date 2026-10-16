import { describe, expect, it } from 'vitest';
import { BLOCKED_INITIALS, INITIALS_CHARACTERS, INITIALS_LENGTH } from '../../highscores';
import { createInitialsViewModel, OK_CELL } from './initials-view-model';

const FIRST = INITIALS_CHARACTERS[0];
const SECOND = INITIALS_CHARACTERS[1];
const LAST = INITIALS_CHARACTERS[INITIALS_CHARACTERS.length - 1];

describe('InitialsViewModel', () => {
    it('starts on the first character in every cell, the cursor on the first, showing', () => {
        const vm = createInitialsViewModel();
        expect(vm.initials).toBe(FIRST.repeat(INITIALS_LENGTH));
        expect(vm.cursor).toBe(0);
        expect(vm.isCursorShown).toBe(true);
    });

    it('opens on remembered initials with the cursor on OK, so one fire sends them', () => {
        const vm = createInitialsViewModel();
        vm.open('TJG');
        expect(vm.initials).toBe('TJG');
        expect(vm.cursor).toBe(OK_CELL);
        expect(vm.fire()).toBe('send');
    });

    it('steps the cursor\'s letter through the characters, round, and not on OK', () => {
        const vm = createInitialsViewModel();
        vm.step(1);
        expect(vm.letterAt(0)).toBe(SECOND);
        vm.step(-1);
        vm.step(-1);
        expect(vm.letterAt(0)).toBe(LAST);
        vm.moveTo(OK_CELL);
        vm.step(1);
        expect(vm.initials).toBe(LAST + FIRST.repeat(INITIALS_LENGTH - 1));
    });

    it('moves on with fire, and sends from OK', () => {
        const vm = createInitialsViewModel();
        for (let i = 0; i < INITIALS_LENGTH; i++) expect(vm.fire()).toBeUndefined();
        expect(vm.cursor).toBe(OK_CELL);
        expect(vm.fire()).toBe('send');
    });

    it('keeps the cursor between the first cell and OK', () => {
        const vm = createInitialsViewModel();
        vm.moveTo(-1);
        expect(vm.cursor).toBe(0);
        vm.moveTo(OK_CELL + 1);
        expect(vm.cursor).toBe(OK_CELL);
    });

    it('will not send initials that cannot be, and says so until the next key', () => {
        const vm = createInitialsViewModel();
        const blocked = [...BLOCKED_INITIALS][0];
        for (const char of blocked) vm.pressKey(char);
        expect(vm.fire()).toBeUndefined();
        expect(vm.isRejected).toBe(true);
        vm.pressKey('ArrowLeft');
        expect(vm.isRejected).toBe(false);
    });

    it('types a character into the cursor\'s cell and moves on, raising lowercase', () => {
        const vm = createInitialsViewModel();
        expect(vm.pressKey('t')).toBe('handled');
        expect(vm.pressKey('J')).toBe('handled');
        expect(vm.pressKey('.')).toBe('handled');
        expect(vm.initials).toBe('TJ.');
        expect(vm.cursor).toBe(OK_CELL);
        expect(vm.pressKey('x')).toBe('ignored');
        expect(vm.pressKey('Enter')).toBe('send');
    });

    it('steps forward through the characters with down, A to B, and back with up', () => {
        const vm = createInitialsViewModel();
        vm.pressKey('ArrowDown');
        expect(vm.letterAt(0)).toBe(SECOND);
        vm.pressKey('ArrowUp');
        vm.pressKey('ArrowUp');
        expect(vm.letterAt(0)).toBe(LAST);
    });

    it('takes the arrows, Backspace, Enter, Space and Escape, and ignores other keys', () => {
        const vm = createInitialsViewModel();
        expect(vm.pressKey('ArrowDown')).toBe('handled');
        expect(vm.letterAt(0)).toBe(SECOND);
        expect(vm.pressKey('ArrowRight')).toBe('handled');
        expect(vm.pressKey('Backspace')).toBe('handled');
        expect(vm.cursor).toBe(0);
        expect(vm.pressKey(' ')).toBe('handled');
        expect(vm.cursor).toBe(1);
        for (const key of ['!', 'Tab', 'Shift', 'F5', 'é']) expect(vm.pressKey(key), key).toBe('ignored');
    });

    it('skips on a second Escape, and forgets the first after any other key', () => {
        const vm = createInitialsViewModel();
        expect(vm.pressKey('Escape')).toBe('handled');
        expect(vm.isConfirmingSkip).toBe(true);
        vm.pressKey('ArrowUp');
        expect(vm.isConfirmingSkip).toBe(false);
        vm.pressKey('Escape');
        expect(vm.pressKey('Escape')).toBe('skip');
    });

    it('blinks the cursor, and shows it at once after a key', () => {
        const vm = createInitialsViewModel();
        let hidden = false;
        for (let ms = 0; ms < 1000 && !hidden; ms += 50) {
            vm.update(50);
            hidden = !vm.isCursorShown;
        }
        expect(hidden).toBe(true);
        vm.pressKey('ArrowUp');
        expect(vm.isCursorShown).toBe(true);
    });

    it('opens afresh, forgetting a pending skip', () => {
        const vm = createInitialsViewModel();
        vm.pressKey('Escape');
        vm.pressKey('Z');
        vm.open(undefined);
        expect(vm.isConfirmingSkip).toBe(false);
        expect(vm.initials).toBe(FIRST.repeat(INITIALS_LENGTH));
        expect(vm.cursor).toBe(0);
    });
});

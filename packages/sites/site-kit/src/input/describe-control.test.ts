import { describe, expect, it } from 'vitest';
import { ARCADE_CONTROL_KEYS } from './arcade-control-keys';
import { describeControl } from './describe-control';
import { describeKey } from './describe-key';

describe('describeKey', () => {
    it('names Space, the arrows and letters as their key caps show them', () => {
        expect(describeKey(' ')).toBe('Space');
        expect(describeKey('ArrowLeft')).toBe('Left');
        expect(describeKey('ArrowDown')).toBe('Down');
        expect(describeKey('w')).toBe('W');
    });

    it('names any other key as the browser names it', () => {
        expect(describeKey('Enter')).toBe('Enter');
        expect(describeKey('Shift')).toBe('Shift');
    });
});

describe('describeControl', () => {
    it('names a control by its first key in the table', () => {
        expect(describeControl('restart')).toBe(describeKey(ARCADE_CONTROL_KEYS.restart[0]));
        expect(describeControl('left')).toBe(describeKey(ARCADE_CONTROL_KEYS.left[0]));
    });
});

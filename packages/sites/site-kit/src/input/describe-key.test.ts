import { describe, expect, it } from 'vitest';
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

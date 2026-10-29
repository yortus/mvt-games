import { expect, it } from 'vitest';

it('runs in Node, after the unit setup', () => {
    expect(typeof window).toBe('undefined');
    expect((globalThis as { unitSetup?: string }).unitSetup).toBeTypeOf('string');
});

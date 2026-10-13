import { describe, expect, it } from 'vitest';
import { isRefreshCopiesCurrent } from './generate-refresh-copies';

describe('generate-refresh-copies', () => {
    it('has written the current refresh copies', () => {
        expect(
            isRefreshCopiesCurrent(),
            'src/jsx/refresh-copies.ts is out of date. Run `npm run generate-refresh-copies -w @mvtjs/utils`.',
        ).toBe(true);
    });
});

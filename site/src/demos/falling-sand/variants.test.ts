import { describe, expect, it } from 'vitest';
import { DEFAULT_VARIANTS, formatVariants, parseVariants } from './variants';

describe('demo variants', () => {
    it('reads each variant from the query string', () => {
        expect(parseVariants('?storage=arrays&view=pixels&tank=large')).toEqual({
            storage: 'arrays',
            grainsView: 'pixels',
            tankSize: 'large',
        });
    });

    it('falls back to the defaults for missing or unknown values', () => {
        expect(parseVariants('')).toEqual(DEFAULT_VARIANTS);
        expect(parseVariants('?storage=wasm&tank=huge')).toEqual(DEFAULT_VARIANTS);
    });

    it('writes variants back, keeping other parameters, and reads them again unchanged', () => {
        const variants = { storage: 'arrays', grainsView: 'pixels', tankSize: 'medium' } as const;
        const search = formatVariants('?debug=1&storage=objects', variants);

        expect(search).toContain('debug=1');
        expect(parseVariants(search)).toEqual(variants);
    });
});

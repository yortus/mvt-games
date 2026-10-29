import { describe, expect, it } from 'vitest';
import { describeHomePageLoad, measureHomePageLoad } from './scripts/home-page-load.ts';

// The site's home page, the Arcade, loads no renderer before its first paint,
// and its JavaScript stays under a budget, gzipped (see
// `scripts/home-page-load.ts` for why). The deploy checks it as it builds the
// Arcade; this test checks it with the other tests, so a change that makes
// the first load heavier fails here, before it is pushed. It builds the
// Arcade in memory, which takes a few seconds.
describe('the home page', () => {
    it('loads no renderer, and stays within its budget, before its first paint', async () => {
        const load = await measureHomePageLoad();
        // The message lists every chunk loaded and its size, to show what grew
        expect(load.problems, describeHomePageLoad(load)).toEqual([]);
    }, 120_000);
});

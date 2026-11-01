import { describe, expect, it } from 'vitest';
import { describeHomePageLoad, measureHomePageLoad, SITE_NAMES } from './scripts/home-page-load.ts';

// Each site's home page loads no renderer before its first paint, and its
// JavaScript stays under a budget, gzipped (see `scripts/home-page-load.ts`
// for why). The deploy checks them as it builds the sites; this test checks
// them with the other tests, so a change that makes a first load heavier
// fails here, before it is pushed. It builds each site in memory, which takes
// a few seconds.
describe.each(SITE_NAMES)('the %s home page', (site) => {
    it('loads no renderer, and stays within its budget, before its first paint', async () => {
        const load = await measureHomePageLoad(site);
        // The message lists every chunk loaded and its size, to show what grew
        expect(load.problems, describeHomePageLoad(load)).toEqual([]);
    }, 120_000);
});

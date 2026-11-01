// Checks that each site's home page (the arcade's, the demos' and the
// puzzles') stays light to load, and fails the build if one does not: see
// `home-page-load.ts` for what it measures, and why. `npm run build` runs it
// after building the sites; `npm run check:home-page-budget` runs it alone. A test runs the same check with the
// other tests (`home-page-budget.test.ts`), which catches it sooner.

import process from 'node:process';
import { describeHomePageLoad, measureHomePageLoad, SITE_NAMES } from './home-page-load.ts';

let isOver = false;
for (const site of SITE_NAMES) {
    const load = await measureHomePageLoad(site);
    if (load.problems.length > 0) {
        console.error(describeHomePageLoad(load));
        isOver = true;
    }
    else {
        console.log(describeHomePageLoad(load));
    }
}
if (isOver) process.exit(1);

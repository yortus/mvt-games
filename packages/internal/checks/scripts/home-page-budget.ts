// Checks that the site's home page, the Arcade, stays light to load, and
// fails the build if it does not: see `home-page-load.ts` for what it
// measures, and why. `npm run build:arcade` runs it after building; `npm run
// check:home-page-budget` runs it alone. A test runs the same check with the
// other tests (`home-page-budget.test.ts`), which catches it sooner.

import process from 'node:process';
import { describeHomePageLoad, measureHomePageLoad } from './home-page-load.ts';

const load = await measureHomePageLoad();
if (load.problems.length > 0) {
    console.error(describeHomePageLoad(load));
    process.exit(1);
}
console.log(describeHomePageLoad(load));

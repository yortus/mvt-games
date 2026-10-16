import type { Suite } from '../harness/suite';
import { audio80Suite } from './audio80';
import { changeDetectionSuite } from './change-detection';
import { constructionSuite } from './construction';
import { fallingSandScalingSuite } from './falling-sand-scaling';
import { gamesAndDemosSuite } from './games-and-demos';
import { hotPathRulesSuite } from './hot-path-rules';
import { htmlRefreshViewSuite } from './html-refresh-view';
import { jsxRefreshSuite } from './jsx-refresh';
import { memorySuite } from './memory';
import { reactivitySuite } from './reactivity';
import { refreshViewSuite } from './refresh-view';
import { scalingSuite } from './scaling';

/** Every suite, in the order `npm run bench -- all` runs them. */
export const suites: readonly Suite[] = [
    reactivitySuite,
    scalingSuite,
    jsxRefreshSuite,
    changeDetectionSuite,
    constructionSuite,
    refreshViewSuite,
    htmlRefreshViewSuite,
    hotPathRulesSuite,
    memorySuite,
    gamesAndDemosSuite,
    fallingSandScalingSuite,
    audio80Suite,
];

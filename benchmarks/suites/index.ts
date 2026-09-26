import type { Suite } from '../harness/suite';
import { changeDetectionSuite } from './change-detection';
import { constructionSuite } from './construction';
import { fallingSandScalingSuite } from './falling-sand-scaling';
import { gamesAndDemosSuite } from './games-and-demos';
import { hotPathRulesSuite } from './hot-path-rules';
import { memorySuite } from './memory';
import { reactivitySuite } from './reactivity';
import { scalingSuite } from './scaling';
import { scenePassesSuite } from './scene-passes';

/** Every suite, in the order `npm run bench -- all` runs them. */
export const suites: readonly Suite[] = [
    reactivitySuite,
    scalingSuite,
    changeDetectionSuite,
    constructionSuite,
    scenePassesSuite,
    hotPathRulesSuite,
    memorySuite,
    gamesAndDemosSuite,
    fallingSandScalingSuite,
];

import { combinations, type Case, type Suite } from '../harness/suite';

const RULES = ['array-methods', 'for-of', 'string-keys', 'map-grid', 'closures', 'object-keys', 'tuples', 'recompute', 'text'];

/** Each hot path rule: the pattern it warns against, and the one it recommends. */
export const hotPathRulesSuite: Suite = {
    name: 'hot-path-rules',
    description: 'each hot path rule, the pattern to avoid against the one to prefer',
    entry: 'hot-path-rules.case.ts',
    cases: [
        ...combinations({ measure: ['time'], rule: RULES, variant: ['avoid', 'prefer'] }).map((params): Case => ({ params })),
        ...combinations({ measure: ['allocation'], rule: RULES, variant: ['avoid', 'prefer'] }).map((params): Case => ({
            params,
            nodeArgs: ['--expose-gc', '--max-semi-space-size=128'],
        })),
    ],
    tables: [
        {
            id: 'time',
            title: 'Time per frame',
            metric: 'usPerFrame',
            unit: 'µs',
            where: { measure: 'time' },
            rows: ['rule'],
            column: 'variant',
        },
        {
            id: 'allocation',
            title: 'Bytes allocated per frame',
            metric: 'bytesPerFrame',
            maxDecimals: 0,
            unit: 'bytes',
            where: { measure: 'allocation' },
            rows: ['rule'],
            column: 'variant',
        },
    ],
    titles: { rule: 'Rule (per frame, over 1000 game objects unless stated)' },
    labels: {
        variant: { avoid: 'Avoid', prefer: 'Prefer' },
        rule: {
            'array-methods': '`.filter().map()` vs an index loop',
            'for-of': '`for...of` vs an index loop',
            'string-keys': 'template-string key into a `Map` vs arithmetic index into an array',
            'map-grid': 'numeric key into a `Map` vs index into an array',
            'closures': '`forEach` with a new closure vs an index loop',
            'object-keys': '`Object.values()` vs reading properties',
            'tuples': 'returning a `[col, row]` tuple vs an out-parameter',
            'recompute': 'summing 1000 scores every frame vs caching the sum',
            'text': '100 `Text` labels: set every frame vs only on change',
        },
    },
};

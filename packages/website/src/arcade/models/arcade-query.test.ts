import { describe, expect, it } from 'vitest';
import { formatArcadeQuery, parseArcadeQuery } from './arcade-query';
import type { TagChip } from './entry-filters';

const CHIPS: readonly TagChip[] = [
    { group: 'kind', value: 'game' },
    { group: 'kind', value: 'demo' },
    { group: 'era', value: '1970s' },
    { group: 'era', value: '1980s' },
];

describe('the arcade\'s query', () => {
    it('reads tags and words', () => {
        const query = parseArcadeQuery('?kind=game&era=1980s,1970s&q=crumb+chase', CHIPS);
        expect([...query.active.kind]).toEqual(['game']);
        expect([...query.active.era].sort()).toEqual(['1970s', '1980s']);
        expect(query.text).toBe('crumb chase');
    });

    it('ignores tags no chip offers', () => {
        const query = parseArcadeQuery('?kind=art,game&genre=maze', CHIPS);
        expect([...query.active.kind]).toEqual(['game']);
        expect(query.active.genre.size).toBe(0);
        expect(query.text).toBe('');
    });

    it('writes tags in the chips\' order, and leaves out what is empty', () => {
        const query = parseArcadeQuery('?era=1980s,1970s&kind=demo', CHIPS);
        expect(formatArcadeQuery('', query, CHIPS)).toBe('?kind=demo&era=1970s,1980s');
        expect(formatArcadeQuery('', parseArcadeQuery('', CHIPS), CHIPS)).toBe('');
    });

    it('keeps other parameters', () => {
        const query = parseArcadeQuery('?q=sand', CHIPS);
        expect(formatArcadeQuery('?tank=large&kind=game', query, CHIPS)).toBe('?tank=large&q=sand');
    });
});

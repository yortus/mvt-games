import { describe, expect, it } from 'vitest';
import { formatArcadeQuery, parseArcadeQuery } from './arcade-query';
import type { TagChip } from './entry-filters';

const CHIPS: readonly TagChip[] = [
    { group: 'era', value: '1970s' },
    { group: 'era', value: '1980s' },
    { group: 'genre', value: 'maze' },
    { group: 'genre', value: 'shooter' },
];

describe('the arcade\'s query', () => {
    it('reads tags and words', () => {
        const query = parseArcadeQuery('?genre=maze&era=1980s,1970s&q=crumb+chase', CHIPS);
        expect([...query.active.genre]).toEqual(['maze']);
        expect([...query.active.era].sort()).toEqual(['1970s', '1980s']);
        expect(query.text).toBe('crumb chase');
    });

    it('ignores tags no chip offers', () => {
        const query = parseArcadeQuery('?genre=art,maze&renderer=pixi', CHIPS);
        expect([...query.active.genre]).toEqual(['maze']);
        expect(query.active.renderer.size).toBe(0);
        expect(query.text).toBe('');
    });

    it('ignores, and drops, the kind a link from before the sites split names', () => {
        const query = parseArcadeQuery('?kind=game&q=sand', CHIPS);
        expect(query.active.genre.size + query.active.era.size).toBe(0);
        expect(formatArcadeQuery('?kind=game&q=sand', query, CHIPS)).toBe('?q=sand');
    });

    it('writes tags in the chips\' order, and leaves out what is empty', () => {
        const query = parseArcadeQuery('?era=1980s,1970s&genre=shooter', CHIPS);
        expect(formatArcadeQuery('', query, CHIPS)).toBe('?era=1970s,1980s&genre=shooter');
        expect(formatArcadeQuery('', parseArcadeQuery('', CHIPS), CHIPS)).toBe('');
    });

    it('keeps other parameters', () => {
        const query = parseArcadeQuery('?q=sand', CHIPS);
        expect(formatArcadeQuery('?tank=large&genre=maze', query, CHIPS)).toBe('?tank=large&q=sand');
    });
});

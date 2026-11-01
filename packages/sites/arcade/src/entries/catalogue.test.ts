import { describe, expect, it } from 'vitest';
import { GAMES } from '@mvtjs/site-kit/highscores';
import { describeCatalogue } from '@mvtjs/site-kit/testing';
import { SITE } from '../site';
import { CATALOGUE, findEntry } from './catalogue';

describeCatalogue({
    site: SITE,
    entryBarrels: Object.keys(import.meta.glob('./*/index.ts')),
    textureFiles: Object.keys(import.meta.glob('./*/assets/*.png')),
});

describe('the arcade catalogue', () => {
    // Every game with a table is an arcade game, so far. A puzzle with one
    // would move this check to a place that sees every site's catalogue
    it('keeps highscores for exactly the games the highscores Worker has tables for', () => {
        const withTables = CATALOGUE.filter((entry) => entry.hasHighscores === true);
        expect(withTables.map((entry) => entry.id).sort()).toEqual(Object.keys(GAMES).sort());
    });

    it('finds an entry by id', () => {
        expect(findEntry('crumb-chase')?.name).toBe('Crumb Chase');
        expect(findEntry('no-such-entry')).toBeUndefined();
    });
});

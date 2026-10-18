import { describe, expect, it } from 'vitest';
import { formatEntryPath, parseEntryPath } from './arcade-path';

const ARCADE = '/mvt-games/arcade/';

describe('an entry\'s path', () => {
    it('is the Arcade\'s, with the entry\'s id added as a folder', () => {
        expect(formatEntryPath(ARCADE, 'crumb-chase')).toBe('/mvt-games/arcade/crumb-chase/');
    });

    it('reads back as the entry\'s id', () => {
        expect(parseEntryPath(formatEntryPath(ARCADE, 'crumb-chase'), ARCADE)).toBe('crumb-chase');
    });

    it('reads the same without its last slash, or with index.html', () => {
        expect(parseEntryPath('/mvt-games/arcade/crumb-chase', ARCADE)).toBe('crumb-chase');
        expect(parseEntryPath('/mvt-games/arcade/crumb-chase/index.html', ARCADE)).toBe('crumb-chase');
    });

    it('reads the Arcade\'s own path, the wall, as an empty id', () => {
        expect(parseEntryPath(ARCADE, ARCADE)).toBe('');
        expect(parseEntryPath('/mvt-games/arcade', ARCADE)).toBe('');
        expect(parseEntryPath('/mvt-games/arcade/index.html', ARCADE)).toBe('');
    });

    it('reads nothing outside the Arcade, or deeper in it', () => {
        expect(parseEntryPath('/mvt-games/', ARCADE)).toBeUndefined();
        expect(parseEntryPath('/mvt-games/docs/', ARCADE)).toBeUndefined();
        expect(parseEntryPath('/mvt-games/arcade-other/', ARCADE)).toBeUndefined();
        expect(parseEntryPath('/mvt-games/arcade/crumb-chase/more/', ARCADE)).toBeUndefined();
    });

    it('reads nothing from a path that cannot be decoded', () => {
        expect(parseEntryPath('/mvt-games/arcade/%E0%A4%A/', ARCADE)).toBeUndefined();
    });
});

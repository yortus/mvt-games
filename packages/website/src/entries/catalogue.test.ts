import { describe, expect, it } from 'vitest';
import { ENTRY_KINDS, ERAS, GENRES, thumbnailCropOf } from '../entry-types';
import { CATALOGUE, findEntry } from './catalogue';

/** Every entry directory's barrel, as `./crumb-chase/index.ts` and so on. */
const ENTRY_BARRELS = Object.keys(import.meta.glob('./*/index.ts'));

describe('the catalogue', () => {
    it('lists each entry once', () => {
        const ids = CATALOGUE.map((e) => e.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('names each entry for its directory', () => {
        for (const entry of CATALOGUE) {
            const barrel = ENTRY_BARRELS.find((path) => path.endsWith(`/${entry.id}/index.ts`));
            expect(barrel, entry.id).toBeDefined();
        }
    });

    it('lists every entry directory', () => {
        expect(ENTRY_BARRELS.length).toBe(CATALOGUE.length);
    });

    it('tags each entry with known values', () => {
        for (const entry of CATALOGUE) {
            const { kind, era, genres } = entry.tags;
            expect(ENTRY_KINDS, entry.id).toContain(kind);
            if (era !== undefined) expect(ERAS, entry.id).toContain(era);
            for (const genre of genres) expect(GENRES, entry.id).toContain(genre);
            expect(new Set(genres).size, entry.id).toBe(genres.length);
        }
    });

    it('gives each entry a play area', () => {
        for (const entry of CATALOGUE) {
            expect(entry.screenWidth, entry.id).toBeGreaterThan(0);
            expect(entry.screenHeight, entry.id).toBeGreaterThan(0);
        }
    });

    it('crops each thumbnail to a rectangle inside the play area', () => {
        for (const entry of CATALOGUE) {
            const crop = thumbnailCropOf(entry);
            expect(crop.width, entry.id).toBeGreaterThan(0);
            expect(crop.height, entry.id).toBeGreaterThan(0);
            expect(crop.x, entry.id).toBeGreaterThanOrEqual(0);
            expect(crop.y, entry.id).toBeGreaterThanOrEqual(0);
            expect(crop.x + crop.width, entry.id).toBeLessThanOrEqual(entry.screenWidth);
            expect(crop.y + crop.height, entry.id).toBeLessThanOrEqual(entry.screenHeight);
        }
    });

    it('finds an entry by id', () => {
        expect(findEntry('crumb-chase')?.name).toBe('Crumb Chase');
        expect(findEntry('no-such-entry')).toBeUndefined();
    });
});

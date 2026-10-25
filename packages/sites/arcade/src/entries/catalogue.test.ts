import { describe, expect, it } from 'vitest';
import { GAMES } from '../highscores';
import { ENTRY_KINDS, ERAS, GENRES, thumbnailCropOf } from '../entry-types';
import { CATALOGUE, findEntry } from './catalogue';

/** Every entry directory's barrel, as `./crumb-chase/index.ts` and so on. */
const ENTRY_BARRELS = Object.keys(import.meta.glob('./*/index.ts'));
/** Every texture an entry packs, as `./fuel-run/assets/jet.png` and so on. */
const TEXTURE_FILES = Object.keys(import.meta.glob('./*/assets/*.png'));

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

    it('describes each entry, in long text it loads apart from its card', async () => {
        for (const entry of CATALOGUE) {
            const details = await entry.loadDetails();
            expect(details.description.trim(), entry.id).toBeTruthy();
            if (details.implementation !== undefined) expect(details.implementation.trim(), entry.id).toBeTruthy();
            for (const technique of details.techniques ?? []) expect(technique.trim(), entry.id).toBeTruthy();
        }
    });

    it('tells how to play each game, its controls among it, for the How to Play tab of its info panel', async () => {
        for (const entry of CATALOGUE) {
            if (entry.tags.kind !== 'game') continue;
            const details = await entry.loadDetails();
            expect(details.howToPlay?.controls?.length, entry.id).toBeGreaterThan(0);
        }
    });

    it('gives every How to Play something to show, and every control an action and an input', async () => {
        for (const entry of CATALOGUE) {
            const { howToPlay } = await entry.loadDetails();
            if (howToPlay === undefined) continue;
            const { intro, controls = [], notes = [] } = howToPlay;
            expect(intro !== undefined || controls.length > 0 || notes.length > 0, entry.id).toBe(true);
            for (const row of controls) {
                expect(row.action.trim(), entry.id).toBeTruthy();
                expect(row.inputs.length, `${entry.id}: ${row.action}`).toBeGreaterThan(0);
            }
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

    it('keeps highscores for exactly the games the highscores Worker has tables for', () => {
        const withTables = CATALOGUE.filter((entry) => entry.hasHighscores === true);
        expect(withTables.map((entry) => entry.id).sort()).toEqual(Object.keys(GAMES).sort());
        for (const entry of withTables) expect(entry.tags.kind, entry.id).toBe('game');
    });

    // Pixi keeps every loaded texture in one cache, by name, so a name two
    // entries share makes Pixi warn, and one entry may draw the other's.
    it('gives no two entries a texture of the same name', () => {
        const owners = new Map<string, string>();
        for (const path of TEXTURE_FILES) {
            const [, entryId, , file] = path.split('/');
            const name = file.slice(0, -'.png'.length);
            expect(owners.get(name), `${entryId} and ${owners.get(name)} both have a texture named '${name}'`).toBeUndefined();
            owners.set(name, entryId);
        }
        expect(owners.size).toBeGreaterThan(0);
    });

    it('finds an entry by id', () => {
        expect(findEntry('crumb-chase')?.name).toBe('Crumb Chase');
        expect(findEntry('no-such-entry')).toBeUndefined();
    });
});

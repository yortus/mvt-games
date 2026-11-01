import { describe, expect, it } from 'vitest';
import { PIXEL_FONT, type SiteConfig } from '../arcade';
import { type EntryTag, ERAS, GENRES, thumbnailCropOf } from '../entry-types';
import { GAMES } from '../highscores';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DescribeCatalogueOptions {
    /** The site whose catalogue is checked. */
    readonly site: SiteConfig;
    /** Every entry directory's barrel, beside the catalogue: `Object.keys(import.meta.glob('./*\/index.ts'))`. */
    readonly entryBarrels: readonly string[];
    /** Every texture an entry packs, beside the catalogue: `Object.keys(import.meta.glob('./*\/assets/*.png'))`. */
    readonly textureFiles: readonly string[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Declares the tests every site's catalogue must pass: each entry listed
 * once, named for its directory, tagged with known values, described, and
 * shown as its card shows it. A site's `catalogue.test.ts` calls it, with
 * the globs only a file beside its entries can make.
 */
export function describeCatalogue(options: DescribeCatalogueOptions): void {
    const { site, entryBarrels, textureFiles } = options;
    const catalogue = site.catalogue;

    describe(`the ${site.id} catalogue`, () => {
        it('lists each entry once', () => {
            const ids = catalogue.map((e) => e.id);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('names each entry for its directory', () => {
            for (const entry of catalogue) {
                const barrel = entryBarrels.find((path) => path.endsWith(`/${entry.id}/index.ts`));
                expect(barrel, entry.id).toBeDefined();
            }
        });

        it('lists every entry directory', () => {
            expect(entryBarrels.length).toBe(catalogue.length);
        });

        it('tags each entry with known values, each once, and an era at most', () => {
            for (const entry of catalogue) {
                for (const tag of entry.tags) expect(KNOWN_TAGS, entry.id).toContain(tag);
                expect(new Set(entry.tags).size, entry.id).toBe(entry.tags.length);
                expect(entry.tags.filter((tag) => (ERAS as readonly string[]).includes(tag)).length, entry.id).toBeLessThanOrEqual(1);
            }
        });

        it('describes each entry, in long text it loads apart from its card', async () => {
            for (const entry of catalogue) {
                const details = await entry.loadDetails();
                expect(details.description.trim(), entry.id).toBeTruthy();
                if (details.implementation !== undefined) expect(details.implementation.trim(), entry.id).toBeTruthy();
                for (const technique of details.techniques ?? []) expect(technique.trim(), entry.id).toBeTruthy();
            }
        });

        it('tells how to play each game, its controls among it, for the How to Play tab of its info panel', async () => {
            for (const entry of catalogue) {
                if (site.entryKind !== 'game') continue;
                const details = await entry.loadDetails();
                expect(details.howToPlay?.controls?.length, entry.id).toBeGreaterThan(0);
            }
        });

        it('tells how to play each game on a desktop, and on a touch screen, which each show only their own controls', async () => {
            for (const entry of catalogue) {
                if (site.entryKind !== 'game') continue;
                const controls = (await entry.loadDetails()).howToPlay?.controls ?? [];
                // Any of a row's inputs works on a desktop. Only a click and the wheel need a mouse
                const hasDesktopControls = controls.some((row) => (row.inputs ?? []).length > 0);
                const hasTouchControls = controls.some((row) => (row.touchInputs ?? []).length > 0
                    || (row.inputs ?? []).some((input) => typeof input === 'string' && TOUCH_GESTURES.has(input)));
                expect(hasDesktopControls, entry.id).toBe(true);
                expect(hasTouchControls, entry.id).toBe(true);
            }
        });

        it('gives every How to Play something to show, and every control an action and an input', async () => {
            for (const entry of catalogue) {
                const { howToPlay } = await entry.loadDetails();
                if (howToPlay === undefined) continue;
                const { intro, controls = [], notes = [] } = howToPlay;
                expect(intro !== undefined || controls.length > 0 || notes.length > 0, entry.id).toBe(true);
                for (const row of controls) {
                    expect(row.action.trim(), entry.id).toBeTruthy();
                    const inputCount = (row.inputs ?? []).length + (row.touchInputs ?? []).length;
                    expect(inputCount, `${entry.id}: ${row.action}`).toBeGreaterThan(0);
                }
            }
        });

        it('gives each entry a play area', () => {
            for (const entry of catalogue) {
                expect(entry.screenWidth, entry.id).toBeGreaterThan(0);
                expect(entry.screenHeight, entry.id).toBeGreaterThan(0);
            }
        });

        it('crops each thumbnail to a rectangle inside the play area', () => {
            for (const entry of catalogue) {
                const crop = thumbnailCropOf(entry);
                expect(crop.width, entry.id).toBeGreaterThan(0);
                expect(crop.height, entry.id).toBeGreaterThan(0);
                expect(crop.x, entry.id).toBeGreaterThanOrEqual(0);
                expect(crop.y, entry.id).toBeGreaterThanOrEqual(0);
                expect(crop.x + crop.width, entry.id).toBeLessThanOrEqual(entry.screenWidth);
                expect(crop.y + crop.height, entry.id).toBeLessThanOrEqual(entry.screenHeight);
            }
        });

        it('keeps highscores only for games the highscores Worker has tables for', () => {
            for (const entry of catalogue) {
                if (entry.hasHighscores !== true) continue;
                expect(Object.keys(GAMES), entry.id).toContain(entry.id);
                expect(site.entryKind, entry.id).toBe('game');
            }
        });

        // Pixi keeps every loaded texture in one cache, by name, so a name two
        // entries share makes Pixi warn, and one entry may draw the other's.
        it('gives no two entries a texture of the same name', () => {
            const owners = new Map<string, string>();
            for (const path of textureFiles) {
                const [, entryId, , file] = path.split('/');
                const name = file.slice(0, -'.png'.length);
                expect(owners.get(name), `${entryId} and ${owners.get(name)} both have a texture named '${name}'`).toBeUndefined();
                owners.set(name, entryId);
            }
        });

        // The cards' titles, and the site's marquee, are drawn in the pixel font
        it('has every character of every entry\'s name, and of the site\'s marquee, in the pixel font', () => {
            for (const entry of catalogue) {
                for (const char of entry.name.toUpperCase().replaceAll(' ', '')) expect(PIXEL_FONT[char], `${entry.id}: ${char}`).toBeDefined();
            }
            for (const char of site.wordmark.replaceAll(' ', '')) expect(PIXEL_FONT[char], `${site.id}: ${char}`).toBeDefined();
        });
    });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Every tag an entry may have. */
const KNOWN_TAGS: readonly EntryTag[] = [...ERAS, ...GENRES];

/** The gestures a finger can make, as a control row's `inputs` give them for the mouse and touch both. */
const TOUCH_GESTURES: ReadonlySet<string> = new Set(['tap', 'double-tap', 'hold', 'drag', 'pinch', 'swipe']);

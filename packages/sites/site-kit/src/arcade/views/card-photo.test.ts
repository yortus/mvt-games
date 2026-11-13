import { describe, expect, it } from 'vitest';
import type { ArcadeEntry, ThumbnailCrop } from '../../entry-types';
import { CARD_DESIGN_SIDE, cardLookFor, cardPhotoIn, cropStyleFor, cropToAspect, frameForCrop, MAX_TILT, MIN_TILT, POLAROID_BORDER, POLAROID_MARGIN } from './card-photo';
import type { Rect } from './rect';

describe('card photos', () => {
    it('frames the photo evenly all round, as large as fits inside the space kept round it, at any size', () => {
        const entries = [
            entryOf('wide', 400, 200, undefined),
            entryOf('tall', 200, 400, undefined),
            entryOf('cropped', 400, 200, { x: 50, y: 0, width: 100, height: 200 }),
        ];
        for (const entry of entries) {
            for (const scale of [0.5, 1, 1.5]) {
                const side = CARD_DESIGN_SIDE * scale;
                const area = { x: 10, y: 20, width: side, height: side };
                const margin = POLAROID_MARGIN * scale;
                const { polaroid, photo, crop, border } = cardPhotoIn(entry, area);

                expect(border).toBeCloseTo(POLAROID_BORDER * scale);
                expect(photo.x - polaroid.x).toBeCloseTo(border);
                expect(photo.y - polaroid.y).toBeCloseTo(border);
                expect(polaroid.x + polaroid.width - (photo.x + photo.width)).toBeCloseTo(border);
                expect(polaroid.y + polaroid.height - (photo.y + photo.height)).toBeCloseTo(border);
                expect(photo.width / photo.height).toBeCloseTo(crop.width / crop.height);
                expectInside(polaroid, { x: area.x + margin, y: area.y + margin, width: side - 2 * margin, height: side - 2 * margin });
                expect(Math.max(polaroid.width, polaroid.height)).toBeCloseTo(side - 2 * margin);
            }
        }
    });

    it('keeps a closer crop inside the entry\'s crop, at the shape asked for, wherever the focus is', () => {
        const crops = [{ x: 10, y: 20, width: 400, height: 100 }, { x: 10, y: 20, width: 100, height: 400 }];
        for (const crop of crops) {
            const centre = { x: crop.x + crop.width / 2, y: crop.y + crop.height / 2 };
            const focuses = [centre, { x: crop.x, y: crop.y }, { x: crop.x + crop.width, y: crop.y + crop.height }, { x: -1000, y: 1000 }];
            for (const aspect of [1, 2]) {
                for (const focus of focuses) {
                    const closer = cropToAspect(crop, aspect, focus);
                    expectInside(closer, crop);
                    expect(closer.width / closer.height).toBeCloseTo(aspect);
                    expect(closer.width === crop.width || closer.height === crop.height).toBe(true);
                }
                // With room all round, the focus is at the centre
                const centred = cropToAspect(crop, aspect, centre);
                expect(centred.x + centred.width / 2).toBeCloseTo(centre.x);
                expect(centred.y + centred.height / 2).toBeCloseTo(centre.y);
            }
        }
    });

    it('places the whole picture so the crop lines up with the photo, in the frame and in the style alike', () => {
        const crop = { x: 200, y: 50, width: 100, height: 50 };
        const entry = entryOf('frame', 400, 200, crop);
        const photo = { x: 10, y: 20, width: 50, height: 25 };
        const frame = frameForCrop(entry, photo);

        // The crop's part of the whole picture lands on the photo
        const across = frame.width / entry.screenWidth;
        const down = frame.height / entry.screenHeight;
        expect(frame.x + crop.x * across).toBeCloseTo(photo.x);
        expect(frame.y + crop.y * down).toBeCloseTo(photo.y);
        expect(crop.width * across).toBeCloseTo(photo.width);
        expect(crop.height * down).toBeCloseTo(photo.height);

        // The style places the picture where the frame does, in percentages of the photo
        const style = percentagesIn(cropStyleFor(entry));
        expect(style.left / 100 * photo.width).toBeCloseTo(frame.x - photo.x);
        expect(style.top / 100 * photo.height).toBeCloseTo(frame.y - photo.y);
        expect(style.width / 100 * photo.width).toBeCloseTo(frame.width);
        expect(style.height / 100 * photo.height).toBeCloseTo(frame.height);
    });
});

describe('card looks', () => {
    const ids = ['crumb-chase', 'galaxy-raiders', 'fruit-machine', 'boids', 'falling-sand', 'dojo-duel', 'astrovoid', 'fuel-run'];

    it('gives each entry the same look every time', () => {
        for (const id of ids) {
            expect(cardLookFor(entryOf(id, 100, 100, undefined))).toEqual(cardLookFor(entryOf(id, 100, 100, undefined)));
        }
    });

    it('tilts every polaroid noticeably, but not far, either way', () => {
        const tilts = ids.map((id) => cardLookFor(entryOf(id, 100, 100, undefined)).tilt);
        for (const tilt of tilts) {
            expect(Math.abs(tilt)).toBeGreaterThanOrEqual(MIN_TILT);
            expect(Math.abs(tilt)).toBeLessThanOrEqual(MAX_TILT);
        }
        expect(tilts.some((tilt) => tilt > 0)).toBe(true);
        expect(tilts.some((tilt) => tilt < 0)).toBe(true);
    });
});

/** Rounding allowed at the edges, since the sizes are fractional. */
const EPSILON = 1e-9;

function expectInside(inner: Rect, outer: Rect): void {
    expect(inner.x).toBeGreaterThanOrEqual(outer.x - EPSILON);
    expect(inner.y).toBeGreaterThanOrEqual(outer.y - EPSILON);
    expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width + EPSILON);
    expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height + EPSILON);
}

/** The four percentages in a style that `cropStyleFor` writes. */
function percentagesIn(style: string): { left: number; top: number; width: number; height: number } {
    const valueOf = (name: string): number => Number(new RegExp(`${name}: (-?[\\d.]+)%`).exec(style)![1]);
    return { left: valueOf('left'), top: valueOf('top'), width: valueOf('width'), height: valueOf('height') };
}

function entryOf(id: string, screenWidth: number, screenHeight: number, thumbnailCrop: ThumbnailCrop | undefined): ArcadeEntry {
    return {
        id,
        name: id,
        summary: '',
        loadDetails: () => Promise.reject(new Error('not loaded in these tests')),
        tags: ['ui'],
        screenWidth,
        screenHeight,
        thumbnail: '',
        thumbnailCrop,
        load: () => Promise.reject(new Error('not loaded in these tests')),
    };
}

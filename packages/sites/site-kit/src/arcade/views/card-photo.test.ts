import { describe, expect, it } from 'vitest';
import { type ArcadeEntry, type ThumbnailCrop, CARD_COLORS } from '../../entry-types';
import {
    CARD_BAND_HEIGHT, CARD_BORDER, CARD_DESIGN_SIDE, cardHeightFor, cardLookFor, cardPhotoIn, cropStyleFor, cropToAspect,
    frameForCrop, fullWidthPhotoIn, LIFT_INSET, liftScaleFor, MAX_TILT, MIN_TILT, POLAROID_BORDER, POLAROID_MARGIN, tapeFor,
} from './card-photo';

describe('card photos', () => {
    it('fits a wide photo across the square, leaving space above and below', () => {
        const entry = entryOf('wide', 400, 200, undefined);
        const side = CARD_DESIGN_SIDE;
        const { polaroid, photo } = cardPhotoIn(entry, { x: 0, y: 0, width: side, height: side });
        const room = side - 2 * POLAROID_MARGIN - 2 * POLAROID_BORDER;
        expect(photo.width).toBe(room);
        expect(photo.height).toBe(room / 2);
        expect(polaroid.x).toBe(POLAROID_MARGIN);
        expect(polaroid.y).toBeGreaterThan(POLAROID_MARGIN);
    });

    it('fits a tall photo down the square, leaving space either side', () => {
        const entry = entryOf('tall', 200, 400, undefined);
        const side = CARD_DESIGN_SIDE;
        const { polaroid, photo } = cardPhotoIn(entry, { x: 10, y: 20, width: side, height: side });
        const room = side - 2 * POLAROID_MARGIN - 2 * POLAROID_BORDER;
        expect(photo.height).toBe(room);
        expect(photo.width).toBe(room / 2);
        expect(polaroid.y).toBe(20 + POLAROID_MARGIN);
        expect(polaroid.x - 10).toBeCloseTo(side - (polaroid.x - 10) - polaroid.width);
    });

    it('frames the photo evenly all round', () => {
        const entry = entryOf('even', 300, 200, undefined);
        const side = CARD_DESIGN_SIDE;
        const { polaroid, photo, border } = cardPhotoIn(entry, { x: 0, y: 0, width: side, height: side });
        expect(border).toBe(POLAROID_BORDER);
        expect(photo.x - polaroid.x).toBe(border);
        expect(photo.y - polaroid.y).toBe(border);
        expect(polaroid.x + polaroid.width - (photo.x + photo.width)).toBeCloseTo(border);
        expect(polaroid.y + polaroid.height - (photo.y + photo.height)).toBeCloseTo(border);
    });

    it('scales the frame with the square: the space round the polaroid, and its border', () => {
        const entry = entryOf('scaled', 300, 200, undefined);
        for (const scale of [0.5, 1.5]) {
            const side = CARD_DESIGN_SIDE * scale;
            const fitted = cardPhotoIn(entry, { x: 0, y: 0, width: side, height: side });
            expect(fitted.scale).toBe(scale);
            expect(fitted.border).toBe(POLAROID_BORDER * scale);
            expect(fitted.polaroid.x).toBe(POLAROID_MARGIN * scale);
            expect(fitted.photo.x - fitted.polaroid.x).toBe(fitted.border);
            expect(fitted.photo.width).toBeCloseTo(side - 2 * (POLAROID_MARGIN + POLAROID_BORDER) * scale);
        }
    });

    it('keeps every card one shape, its bands scaling with its square', () => {
        const innerAspect = (columnWidth: number): number => (cardHeightFor(columnWidth) - 2 * CARD_BORDER) / (columnWidth - 2 * CARD_BORDER);
        expect(cardHeightFor(CARD_DESIGN_SIDE + 2 * CARD_BORDER)).toBe(CARD_DESIGN_SIDE + 2 * CARD_BORDER + 2 * CARD_BAND_HEIGHT);
        expect(innerAspect(CARD_DESIGN_SIDE * 0.6)).toBeCloseTo(innerAspect(CARD_DESIGN_SIDE));
        expect(innerAspect(CARD_DESIGN_SIDE * 1.5)).toBeCloseTo(innerAspect(CARD_DESIGN_SIDE));
    });

    it('fits the crop, not the whole play area', () => {
        const entry = entryOf('crop', 400, 200, { x: 0, y: 0, width: 100, height: 200 });
        const { photo } = cardPhotoIn(entry, { x: 0, y: 0, width: 300, height: 300 });
        expect(photo.width / photo.height).toBeCloseTo(0.5);
    });

    it('places the whole picture so the crop fills the photo', () => {
        // A 400x200 play area, cropped to the 100x50 rectangle at (200, 50)
        const entry = entryOf('frame', 400, 200, { x: 200, y: 50, width: 100, height: 50 });
        const frame = frameForCrop(entry, { x: 10, y: 20, width: 50, height: 25 });
        expect(frame).toEqual({ x: 10 - 100, y: 20 - 25, width: 200, height: 100 });
    });

    it('styles the picture in percentages of the photo', () => {
        const entry = entryOf('style', 400, 200, { x: 200, y: 50, width: 100, height: 50 });
        expect(cropStyleFor(entry)).toBe('left: -200.000%; top: -100.000%; width: 400.000%; height: 400.000%');
    });
});

describe('full-width card photos', () => {
    it('fills a square across the foot of the inside of the card, edge to edge, in no border', () => {
        for (const scale of [0.6, 1, 1.5]) {
            const side = CARD_DESIGN_SIDE * scale;
            const inside = cardHeightFor(side + 2 * CARD_BORDER) - 2 * CARD_BORDER;
            const fitted = fullWidthPhotoIn(entryOf('wide', 400, 200, undefined), side);
            expect(fitted.photo.x).toBe(0);
            expect(fitted.photo.width).toBe(side);
            expect(fitted.photo.height).toBe(side);
            expect(fitted.photo.y + fitted.photo.height).toBeCloseTo(inside);
            expect(fitted.polaroid).toEqual(fitted.photo);
            expect(fitted.border).toBe(0);
            expect(fitted.scale).toBeCloseTo(scale);
        }
    });

    it('shows a square of the crop, centred on the entry\'s focus', () => {
        const entry = { ...entryOf('tall', 200, 400, { x: 0, y: 100, width: 200, height: 300 }), thumbnailFocus: { x: 100, y: 220 } };
        const { crop } = fullWidthPhotoIn(entry, CARD_DESIGN_SIDE);
        expect(crop).toEqual({ x: 0, y: 120, width: 200, height: 200 });
    });

    it('centres on the crop\'s centre for an entry with no focus', () => {
        const { crop } = fullWidthPhotoIn(entryOf('tall', 200, 400, { x: 0, y: 100, width: 200, height: 300 }), CARD_DESIGN_SIDE);
        expect(crop).toEqual({ x: 0, y: 150, width: 200, height: 200 });
    });

    it('keeps the closer crop inside the entry\'s crop, however near its edge the focus is', () => {
        const crop = { x: 10, y: 20, width: 400, height: 100 };
        expect(cropToAspect(crop, 2, { x: 210, y: 70 })).toEqual({ x: 110, y: 20, width: 200, height: 100 });
        expect(cropToAspect(crop, 2, { x: 15, y: 0 })).toEqual({ x: 10, y: 20, width: 200, height: 100 });
        expect(cropToAspect(crop, 2, { x: 400, y: 120 })).toEqual({ x: 210, y: 20, width: 200, height: 100 });
        expect(cropToAspect({ x: 10, y: 20, width: 100, height: 400 }, 2, { x: 60, y: 220 })).toEqual({ x: 10, y: 195, width: 100, height: 50 });
    });

    it('places the whole picture so the crop shown fills the photo', () => {
        const entry = entryOf('frame', 400, 200, undefined);
        const crop = { x: 100, y: 0, width: 200, height: 100 };
        const frame = frameForCrop(entry, { x: 0, y: 0, width: 100, height: 50 }, crop);
        expect(frame).toEqual({ x: -50, y: 0, width: 200, height: 100 });
        expect(cropStyleFor(entry, crop)).toBe('left: -50.000%; top: 0.000%; width: 200.000%; height: 200.000%');
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

    it('tapes two different corners', () => {
        for (const id of ids) {
            const [first, second] = cardLookFor(entryOf(id, 100, 100, undefined)).tapedCorners;
            expect(first).not.toBe(second);
        }
    });

    it('lays the tape across the tip of each taped corner of the tilted polaroid', () => {
        const polaroid = { x: 0, y: 0, width: 200, height: 100 };
        const [topLeft, bottomRight] = tapeFor(polaroid, { tilt: 0, tapedCorners: ['top-left', 'bottom-right'] });
        expect(topLeft).toEqual({ x: 0, y: 0, angle: -45 });
        expect(bottomRight).toEqual({ x: 200, y: 100, angle: -45 });
        // Tilted a quarter turn clockwise about the centre, the top left corner swings round to the top right
        const [turned] = tapeFor(polaroid, { tilt: 90, tapedCorners: ['top-left', 'bottom-right'] });
        expect(turned.x).toBeCloseTo(150);
        expect(turned.y).toBeCloseTo(-50);
        expect(turned.angle).toBe(45);
    });

    it('colours each title from the palette, unless the entry chooses', () => {
        for (const id of ids) {
            expect(CARD_COLORS).toContain(cardLookFor(entryOf(id, 100, 100, undefined)).color);
        }
        const chosen = { ...entryOf('crumb-chase', 100, 100, undefined), cardColor: 'mint' as const };
        expect(cardLookFor(chosen).color).toBe('mint');
    });

    it('grows the polaroid, as it comes closer, until it is just narrower than the card', () => {
        const side = 300;
        const scale = liftScaleFor({ x: 0, y: 0, width: 250, height: 180 }, side);
        expect(250 * scale).toBe(side + 2 * CARD_BORDER - 2 * LIFT_INSET);
        // A tall polaroid grows until its height does
        const tallScale = liftScaleFor({ x: 0, y: 0, width: 150, height: 250 }, side);
        expect(250 * tallScale).toBe(side + 2 * CARD_BORDER - 2 * LIFT_INSET);
    });
});

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

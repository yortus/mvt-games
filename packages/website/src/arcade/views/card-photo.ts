import { type ArcadeEntry, type CardColor, CARD_COLORS, thumbnailCropOf } from '../../entry-types';
import type { Rect } from './rect';

// An entry's card shows its thumbnail as a photo in a polaroid, fitted inside
// a square at the centre of the card, tilted a little and taped down across
// two corners. The photo is the part of the thumbnail the entry names
// (`thumbnailCrop`), of whatever shape; the thumbnail itself pictures the
// whole play area. The photo is a window on the whole picture, placed so the
// crop fills it, so a transition can show the window and the whole picture
// behind it without changing picture.

/** Where a card's polaroid and photo sit, untilted, in the coordinates of the square they are fitted in. */
export interface CardPhoto {
    readonly polaroid: Rect;
    readonly photo: Rect;
}

/**
 * Where a card's photo is drawn, as the card shows it now: tilted at rest, or
 * straight and closer while selected.
 */
export interface PhotoPose {
    /** The photo, in the viewport, as if untilted: it turns about its centre. */
    readonly window: Rect;
    /** Degrees, clockwise. */
    readonly tilt: number;
    /** The polaroid's white border round the photo, in CSS pixels, at the size it is drawn. */
    readonly border: number;
}

/** How a card looks: its polaroid's tilt, the corners taped down, and its colour. The same for an entry every time. */
export interface CardLook {
    /** Degrees, clockwise. */
    readonly tilt: number;
    readonly tapedCorners: readonly [CornerKind, CornerKind];
    readonly color: CardColor;
}

/** A corner of a polaroid. */
export type CornerKind = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';

/** A strip of tape across a corner: its centre, in the square's coordinates, and its angle in degrees. */
export interface TapePiece {
    readonly x: number;
    readonly y: number;
    readonly angle: number;
}

/** A card's border. Must match `.card`'s in `arcade.css`. */
export const CARD_BORDER = 1;
/**
 * The bands above and below a card's square: its title above, its tags and
 * info button below. The same height, so the polaroid's centre is the card's.
 * Must match `.card-name` and `.card-foot` in `arcade.css`.
 */
export const CARD_BAND_HEIGHT = 40;

/** The candy palette, as CSS colours: each card's background, light enough for its dark title. */
export const CARD_COLOR_VALUES: Readonly<Record<CardColor, string>> = {
    bubblegum: '#ff9ecb',
    peach: '#ffb3a1',
    apricot: '#ffcf8f',
    lemon: '#fff09a',
    mint: '#b5f5a3',
    seafoam: '#99eedc',
    sky: '#9fd4ff',
    lavender: '#c4b5ff',
    orchid: '#efaaff',
};

/** Space kept clear around the polaroid, inside the square: room for its tilt, and its tape. */
export const POLAROID_MARGIN = 24;
/** The polaroid's white border, even all round. Must match `.card-polaroid`'s padding in `arcade.css`. */
export const POLAROID_BORDER = 8;
/** How far short of the card's sides the polaroid's longer side stops when it comes closer, on the selected card. */
export const LIFT_INSET = 6;
/** The tilt's range, in degrees either way: enough to see, never so much it looks dropped. */
export const MIN_TILT = 1.5;
export const MAX_TILT = 4;

/**
 * A card's height, border included, when its column is `columnWidth` wide:
 * every card is the same, a square as wide as the column between its title
 * and its foot.
 */
export function cardHeightFor(columnWidth: number): number {
    return columnWidth + 2 * CARD_BAND_HEIGHT;
}

/**
 * Fits `entry`'s photo, in its polaroid, inside the square `area`, centred:
 * a wide photo leaves space above and below, a tall one either side.
 */
export function cardPhotoIn(entry: ArcadeEntry, area: Rect): CardPhoto {
    const crop = thumbnailCropOf(entry);
    const aspect = crop.width / crop.height;
    const room = area.width - 2 * POLAROID_MARGIN - 2 * POLAROID_BORDER;
    const roomHeight = area.height - 2 * POLAROID_MARGIN - 2 * POLAROID_BORDER;
    const photoWidth = Math.max(0, Math.min(room, roomHeight * aspect));
    const photoHeight = photoWidth / aspect;
    const polaroidWidth = photoWidth + 2 * POLAROID_BORDER;
    const polaroidHeight = photoHeight + 2 * POLAROID_BORDER;
    const polaroid: Rect = {
        x: area.x + (area.width - polaroidWidth) / 2,
        y: area.y + (area.height - polaroidHeight) / 2,
        width: polaroidWidth,
        height: polaroidHeight,
    };
    return {
        polaroid,
        photo: { x: polaroid.x + POLAROID_BORDER, y: polaroid.y + POLAROID_BORDER, width: photoWidth, height: photoHeight },
    };
}

/**
 * How `entry`'s card looks, from its id: pseudo-random, but the same every
 * time. Its colour is the entry's own choice, where it makes one.
 */
export function cardLookFor(entry: ArcadeEntry): CardLook {
    const hash = hashOf(entry.id);
    const sign = hash & 1 ? 1 : -1;
    const tilt = sign * (MIN_TILT + ((hash >>> 1) % 1000) / 1000 * (MAX_TILT - MIN_TILT));
    return {
        tilt,
        tapedCorners: CORNER_PAIRS[(hash >>> 11) % CORNER_PAIRS.length],
        color: entry.cardColor ?? CARD_COLORS[(hash >>> 16) % CARD_COLORS.length],
    };
}

/**
 * How much the polaroid grows when it comes closer: until its longer side is
 * just short of the width of a card whose square is `side` wide.
 */
export function liftScaleFor(polaroid: Rect, side: number): number {
    const longer = Math.max(polaroid.width, polaroid.height);
    return longer > 0 ? (side + 2 * CARD_BORDER - 2 * LIFT_INSET) / longer : 1;
}

/**
 * Where the tape goes on a polaroid lying as `look` says: across the tip of
 * each taped corner of the tilted polaroid, at right angles to the line from
 * its centre.
 */
export function tapeFor(polaroid: Rect, look: Pick<CardLook, 'tilt' | 'tapedCorners'>): readonly [TapePiece, TapePiece] {
    return [tapeAt(polaroid, look.tilt, look.tapedCorners[0]), tapeAt(polaroid, look.tilt, look.tapedCorners[1])];
}

/**
 * Where the whole play area lies when `entry`'s crop fills `photo`: larger
 * than the photo, and offset so the crop lines up with it.
 */
export function frameForCrop(entry: ArcadeEntry, photo: Rect): Rect {
    const crop = thumbnailCropOf(entry);
    const scale = photo.width / crop.width;
    return {
        x: photo.x - crop.x * scale,
        y: photo.y - crop.y * scale,
        width: entry.screenWidth * scale,
        height: entry.screenHeight * scale,
    };
}

/**
 * The style that places `entry`'s thumbnail inside its photo so the crop
 * fills the photo: in percentages of the photo, so it holds at any size.
 */
export function cropStyleFor(entry: ArcadeEntry): string {
    const crop = thumbnailCropOf(entry);
    const across = (value: number): string => `${(value / crop.width * 100).toFixed(3)}%`;
    const down = (value: number): string => `${(value / crop.height * 100).toFixed(3)}%`;
    return `left: ${across(-crop.x)}; top: ${down(-crop.y)}; `
        + `width: ${across(entry.screenWidth)}; height: ${down(entry.screenHeight)}`;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Every pair of distinct corners: across a diagonal, or along a side. */
const CORNER_PAIRS: readonly (readonly [CornerKind, CornerKind])[] = [
    ['top-left', 'bottom-right'],
    ['top-right', 'bottom-left'],
    ['top-left', 'top-right'],
    ['bottom-left', 'bottom-right'],
    ['top-left', 'bottom-left'],
    ['top-right', 'bottom-right'],
];

/** Each corner's direction from the centre, and the angle of tape laid across it. */
const CORNERS: Readonly<Record<CornerKind, { readonly dx: number; readonly dy: number; readonly angle: number }>> = {
    'top-left': { dx: -1, dy: -1, angle: -45 },
    'top-right': { dx: 1, dy: -1, angle: 45 },
    'bottom-right': { dx: 1, dy: 1, angle: -45 },
    'bottom-left': { dx: -1, dy: 1, angle: 45 },
};

function tapeAt(polaroid: Rect, tilt: number, corner: CornerKind): TapePiece {
    const { dx, dy, angle } = CORNERS[corner];
    const radians = tilt * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const offsetX = dx * polaroid.width / 2;
    const offsetY = dy * polaroid.height / 2;
    return {
        x: polaroid.x + polaroid.width / 2 + offsetX * cos - offsetY * sin,
        y: polaroid.y + polaroid.height / 2 + offsetX * sin + offsetY * cos,
        angle: angle + tilt,
    };
}

/** FNV-1a: a small, well-spread hash of a string, as an unsigned 32-bit number. */
function hashOf(text: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash;
}

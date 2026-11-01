import { type ArcadeEntry, type CardColor, CARD_COLORS, thumbnailCropOf, thumbnailFocusOf, type ThumbnailFocus } from '../../entry-types';
import type { Rect } from './rect';

// An entry's card shows its thumbnail as a photo, in one of two ways, as the
// theme says. In a polaroid, it is fitted inside a square at the centre of
// the card, tilted a little and taped down across two corners, and shows the
// part of the thumbnail the entry names (`thumbnailCrop`), of whatever shape.
// Full width, it fills a square across the foot of the card, edge to edge,
// and shows as much of that crop as fits a square, centred on the entry's
// focus (`thumbnailFocus`) as nearly as the crop allows. Either way the thumbnail
// itself pictures the whole play area, and the photo is a window on it,
// placed so the crop it shows fills it, so a transition can show the window
// and the whole picture behind it without changing picture.

/** How a card shows its photo: in a polaroid, tilted and taped, or in a square across the card's foot, edge to edge. */
export type CardPhotoKind = 'polaroid' | 'full-width';

/**
 * Where a card's polaroid and photo sit, untilted: in the coordinates of the
 * square they are fitted in, or, full width, of the inside of the card. A
 * full-width photo's polaroid is the photo, with no border.
 */
export interface CardPhoto {
    readonly polaroid: Rect;
    readonly photo: Rect;
    /** The part of the play area the photo shows, in the entry's screen pixels. */
    readonly crop: Rect;
    /** The card's scale, from its square (`cardScaleFor`): what every size on it is multiplied by. */
    readonly scale: number;
    /** The polaroid's white border round the photo, at that scale. */
    readonly border: number;
}

/**
 * Where a photo is drawn, and the whole picture behind its window. On a card,
 * as the card shows it now: tilted at rest, or straight and closer while
 * selected, the window showing part of the picture, in a border. At the play
 * area, window and picture are one, straight, with no border.
 */
export interface PhotoPose {
    /** The photo, in the viewport, as if untilted: it turns about its centre. */
    readonly window: Rect;
    /** The whole picture, behind the window, as if untilted. */
    readonly frame: Rect;
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

/**
 * The side of the square a card is designed at: a card in the narrowest
 * column of a wide wall (260 pixels, less its border). Every size on a card
 * is given at this side, here and in `arcade.css` (its bands, title, tags and
 * info button, the polaroid's margin, border and tape, the etching), and a
 * card of any other width is the same card scaled (`cardScaleFor`), so every
 * card has one shape.
 */
export const CARD_DESIGN_SIDE = 258;
/** A card's border, which does not scale. Must match `.card`'s in `arcade.css`. */
export const CARD_BORDER = 1;
/**
 * The bands above and below a card's square, at the design side: its title
 * above, its tags and info button below. The same height, so the polaroid's
 * centre is the card's. Must match `.card-name` and `.card-foot` in `arcade.css`.
 */
export const CARD_BAND_HEIGHT = 40;

/** Space kept clear around the polaroid, inside the square, at the design side: room for its tilt, and its tape. */
export const POLAROID_MARGIN = 24;
/** The polaroid's white border, even all round, at the design side. Must match `.card-polaroid`'s padding in `arcade.css`. */
export const POLAROID_BORDER = 8;
/** How far short of the card's sides the polaroid's longer side stops when it comes closer, on the selected card. */
export const LIFT_INSET = 6;
/** The tilt's range, in degrees either way: enough to see, never so much it looks dropped. */
export const MIN_TILT = 1.5;
export const MAX_TILT = 4;

/** How much larger, or smaller, than the design a card whose square is `side` wide is drawn. */
export function cardScaleFor(side: number): number {
    return side / CARD_DESIGN_SIDE;
}

/**
 * A card's height, border included, when its column is `columnWidth` wide:
 * every card is the same shape, a square as wide as the column between its
 * title and its foot, whose bands scale with it.
 */
export function cardHeightFor(columnWidth: number): number {
    const side = columnWidth - 2 * CARD_BORDER;
    return columnWidth + 2 * CARD_BAND_HEIGHT * cardScaleFor(side);
}

/**
 * Fits `entry`'s photo, in its polaroid, inside the square `area`, centred:
 * a wide photo leaves space above and below, a tall one either side.
 */
export function cardPhotoIn(entry: ArcadeEntry, area: Rect): CardPhoto {
    const crop = thumbnailCropOf(entry);
    const aspect = crop.width / crop.height;
    const scale = cardScaleFor(Math.min(area.width, area.height));
    const margin = POLAROID_MARGIN * scale;
    const border = POLAROID_BORDER * scale;
    const room = area.width - 2 * margin - 2 * border;
    const roomHeight = area.height - 2 * margin - 2 * border;
    const photoWidth = Math.max(0, Math.min(room, roomHeight * aspect));
    const photoHeight = photoWidth / aspect;
    const polaroidWidth = photoWidth + 2 * border;
    const polaroidHeight = photoHeight + 2 * border;
    const polaroid: Rect = {
        x: area.x + (area.width - polaroidWidth) / 2,
        y: area.y + (area.height - polaroidHeight) / 2,
        width: polaroidWidth,
        height: polaroidHeight,
    };
    return {
        polaroid,
        photo: { x: polaroid.x + border, y: polaroid.y + border, width: photoWidth, height: photoHeight },
        crop,
        scale,
        border,
    };
}

/**
 * Fits `entry`'s photo in a square `side` wide across the foot of a card
 * whose square is `side` wide, in the coordinates of the inside of the
 * card: edge to edge, in no border, under both its bands' height, showing
 * as much of the entry's crop as fills it, centred on its focus.
 */
export function fullWidthPhotoIn(entry: ArcadeEntry, side: number): CardPhoto {
    const scale = cardScaleFor(side);
    const photo: Rect = { x: 0, y: 2 * CARD_BAND_HEIGHT * scale, width: side, height: side };
    const crop = cropToAspect(thumbnailCropOf(entry), 1, thumbnailFocusOf(entry));
    return { polaroid: photo, photo, crop, scale, border: 0 };
}

/**
 * As much of `crop` as fits at `aspect` (width over height): its full height
 * where it is wider than that, its full width where it is taller. It is
 * centred on `focus`, as nearly as it can be without leaving `crop`.
 */
export function cropToAspect(crop: Rect, aspect: number, focus: ThumbnailFocus): Rect {
    const isWider = crop.width / crop.height > aspect;
    const width = isWider ? crop.height * aspect : crop.width;
    const height = isWider ? crop.height : crop.width / aspect;
    return {
        x: clamp(focus.x - width / 2, crop.x, crop.x + crop.width - width),
        y: clamp(focus.y - height / 2, crop.y, crop.y + crop.height - height),
        width,
        height,
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
 * Where the whole play area lies when `crop`, the entry's own unless given,
 * fills `photo`: larger than the photo, and offset so the crop lines up with
 * it.
 */
export function frameForCrop(entry: ArcadeEntry, photo: Rect, crop: Rect = thumbnailCropOf(entry)): Rect {
    const scale = photo.width / crop.width;
    return {
        x: photo.x - crop.x * scale,
        y: photo.y - crop.y * scale,
        width: entry.screenWidth * scale,
        height: entry.screenHeight * scale,
    };
}

/**
 * The style that places `entry`'s thumbnail inside its photo so `crop`, the
 * entry's own unless given, fills the photo: in percentages of the photo, so
 * it holds at any size.
 */
export function cropStyleFor(entry: ArcadeEntry, crop: Rect = thumbnailCropOf(entry)): string {
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

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
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

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The card wall's layout: cards of one width in as many columns as fit, each
 * placed in the shortest column so far, in the order shown. A view model,
 * owned by the wall view: it holds where each card is drawn, eases cards to
 * new places when the order or the width changes, and fades cards in and out
 * as they are shown and hidden. Cards are addressed by a fixed index (their
 * place in the catalogue), whatever order they are shown in.
 */
export interface CardWallLayout {
    /** How many columns the wall has: as many as fit, up to the most allowed. */
    readonly columnCount: number;
    /** The width of every card, in CSS pixels. */
    readonly columnWidth: number;
    /** The wall's height: its longest column's. */
    readonly height: number;
    /** Where card `index` is drawn, from the wall's top left corner, in CSS pixels. */
    readonly xAt: (index: number) => number;
    readonly yAt: (index: number) => number;
    /** 0 hidden, 1 shown; in between while fading. */
    readonly opacityAt: (index: number) => number;
    /** Whether card `index` is drawn at all: shown, or still fading out. */
    readonly isVisibleAt: (index: number) => boolean;
    /** The wall's width, as it is laid out. */
    readonly setWidth: (width: number) => void;
    /** A card's height, as it is laid out at the column width. A hidden card's 0 is ignored: it keeps the height it had. */
    readonly setCardHeightAt: (index: number, height: number) => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CardWallLayoutOptions {
    /** How many cards there are, shown or not. */
    readonly count: number;
    /** Space between columns, and between cards in a column, in CSS pixels. */
    readonly gap: number;
    /** The narrowest a column may be; the wall has as many columns as fit. */
    readonly minColumnWidth: number;
    /** The most columns the wall has, however wide. */
    readonly maxColumnCount: number;
    /** How many cards are shown, and which, in order. */
    readonly shownCount: () => number;
    readonly shownIndexAt: (position: number) => number;
    /** A card's height for a column width, before it has been measured. */
    readonly estimatedHeightAt: (index: number, columnWidth: number) => number;
    /** Whether the visitor has asked for less motion: cards then jump to their places, though they still fade. */
    readonly isMotionReduced?: () => boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCardWallLayout(options: CardWallLayoutOptions): CardWallLayout {
    const { count, gap, minColumnWidth, maxColumnCount } = options;

    let width = 0;
    let columnCount = 1;
    let columnWidth = 0;
    let height = 0;

    // Per card: as drawn, and where it is heading
    const x = new Float64Array(count);
    const y = new Float64Array(count);
    const targetX = new Float64Array(count);
    const targetY = new Float64Array(count);
    const opacity = new Float64Array(count);
    const isShown = new Uint8Array(count);
    const isPlaced = new Uint8Array(count);
    /** How long a card shown again waits before fading in, in milliseconds. */
    const fadeDelay = new Float64Array(count);
    /** Measured heights, 0 until measured. */
    const measured = new Float64Array(count);

    // What the targets were worked out from, so they are worked out again only when it changes
    let laidOutWidth = -1;
    let isLayoutStale = true;
    /** Set when a card's first measure is off its estimate: the wall settles without sliding. */
    let isFirstMeasure = false;
    const laidOutOrder: number[] = [];
    const columnHeights: number[] = [];

    const layout: CardWallLayout = {
        get columnCount() {
            return columnCount;
        },
        get columnWidth() {
            return columnWidth;
        },
        get height() {
            return height;
        },
        xAt: (index) => x[index],
        yAt: (index) => y[index],
        opacityAt: (index) => opacity[index],
        isVisibleAt: (index) => isPlaced[index] === 1 && (isShown[index] === 1 || opacity[index] > 0),
        setWidth(value) {
            if (value === width) return;
            width = value;
            isLayoutStale = true;
        },
        setCardHeightAt(index, value) {
            // A hidden card measures 0; were that taken, showing it again would
            // look like a first measure, and snap the wall rather than slide it
            if (value <= 0 || value === measured[index]) return;
            if (measured[index] === 0 && Math.abs(value - options.estimatedHeightAt(index, columnWidth)) > ESTIMATE_TOLERANCE) {
                isFirstMeasure = true;
            }
            measured[index] = value;
            isLayoutStale = true;
        },
        update(deltaMs) {
            if (isLayoutStale || hasOrderChanged()) layOut();
            const follow = options.isMotionReduced?.() === true ? 1 : 1 - Math.exp(-deltaMs / EASE_MS);
            const fadeOut = 1 - Math.exp(-deltaMs / FADE_OUT_MS);
            const fadeIn = 1 - Math.exp(-deltaMs / FADE_IN_MS);
            for (let i = 0; i < count; i++) {
                x[i] = approach(x[i], targetX[i], follow);
                y[i] = approach(y[i], targetY[i], follow);
                if (isShown[i] === 0) opacity[i] = approach(opacity[i], 0, fadeOut);
                else if (fadeDelay[i] > 0) fadeDelay[i] = Math.max(0, fadeDelay[i] - deltaMs);
                else opacity[i] = approach(opacity[i], 1, fadeIn);
            }
        },
    };

    // Valid from construction, for a first refresh before the first update
    layOut();
    return layout;

    function hasOrderChanged(): boolean {
        const shownCount = options.shownCount();
        if (shownCount !== laidOutOrder.length) return true;
        for (let p = 0; p < shownCount; p++) {
            if (options.shownIndexAt(p) !== laidOutOrder[p]) return true;
        }
        return false;
    }

    function layOut(): void {
        isLayoutStale = false;
        columnCount = Math.max(1, Math.min(maxColumnCount, Math.floor((width + gap) / (minColumnWidth + gap))));
        columnWidth = Math.max(0, (width - gap * (columnCount - 1)) / columnCount);
        // A new width moves every card at once, and a first measure corrects an
        // estimate: snap, rather than slide them all
        const isSnap = width !== laidOutWidth || isFirstMeasure;
        laidOutWidth = width;
        isFirstMeasure = false;

        isShown.fill(0);
        laidOutOrder.length = 0;
        columnHeights.length = columnCount;
        columnHeights.fill(0);
        const shownCount = options.shownCount();
        for (let p = 0; p < shownCount; p++) {
            const index = options.shownIndexAt(p);
            laidOutOrder.push(index);
            isShown[index] = 1;
            let column = 0;
            for (let c = 1; c < columnCount; c++) {
                if (columnHeights[c] < columnHeights[column]) column = c;
            }
            targetX[index] = column * (columnWidth + gap);
            targetY[index] = columnHeights[column];
            const cardHeight = measured[index] > 0 ? measured[index] : options.estimatedHeightAt(index, columnWidth);
            columnHeights[column] += cardHeight + gap;
            if (width > 0 && (isPlaced[index] === 0 || isSnap || opacity[index] === 0)) {
                // A card shown for the first time, or again once it has faded
                // out, appears where it belongs, and fades in: when the wall
                // reflows, once the cards sliding off its place have cleared it
                x[index] = targetX[index];
                y[index] = targetY[index];
                isPlaced[index] = 1;
                fadeDelay[index] = isSnap ? 0 : FADE_IN_DELAY_MS;
            }
        }
        height = 0;
        for (let c = 0; c < columnCount; c++) height = Math.max(height, columnHeights[c] - gap);
        height = Math.max(0, height);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How quickly cards move to their places: most of the way in this time, and all of it in about three times it. */
const EASE_MS = 90;

/** A card leaving fades faster than cards move, so it is gone before others land on its place. */
const FADE_OUT_MS = 60;

/**
 * A card arriving fades in more slowly, to be seen arriving; and, when the
 * wall reflows, only after the cards sliding off its place have mostly gone.
 */
const FADE_IN_MS = 120;
const FADE_IN_DELAY_MS = 120;

/** How far, in CSS pixels, a card's first measure may be off its estimate and still slide the wall, not snap it. */
const ESTIMATE_TOLERANCE = 1;

/** Close enough to land. */
const LANDED = 0.01;

function approach(current: number, target: number, fraction: number): number {
    const next = current + (target - current) * Math.min(1, fraction);
    return Math.abs(target - next) < LANDED ? target : next;
}

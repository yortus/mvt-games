import { createRandom, type Random } from '@mvtjs/site-kit/random';
import {
    BOTTOM_MARGIN, COLUMN_COUNT, DATELINE_HEIGHT, FIRST_EDITION_DAY, GUTTER, HEADLINES, LEAD_HEADLINES, MASTHEAD_HEIGHT, PAGE_HEIGHT, PAGE_WIDTH,
    PUZZLE_COLUMNS, PUZZLE_TITLE_HEIGHT, SIDE_MARGIN, TOP_MARGIN,
} from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The front page, with the masthead, an inside page, or the back page. */
export type PageKind = 'front' | 'inside' | 'back';

/**
 * What a block on a page holds. A story is a headline over columns of text,
 * maybe with a photo. An advert is a box of its own. A puzzle is a puzzle's
 * name over its box. The front page has an index of the puzzles inside, and
 * the back page has the weather.
 */
export type BlockKind = 'story' | 'advert' | 'puzzle' | 'index' | 'weather';

/** How big a story's headline is set. A lead is the front page's own. */
export type HeadlineSize = 'lead' | 'large' | 'small';

/** A rectangle on a page, as fractions of the page: across from its left edge, and down from its top. */
export interface PageRect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/** One block on a page. */
export interface PageBlock extends PageRect {
    readonly kind: BlockKind;
    /** A story's headline, if it's one a reader can read. A story without one has a headline too small to read. */
    readonly headline: string | undefined;
    readonly headlineSize: HeadlineSize;
    /** Whether a story has a photo, under its headline. */
    readonly hasPhoto: boolean;
    /** A number of its own, which decides how its text runs and what its photo shows. */
    readonly seed: number;
    /** For a puzzle's block, which puzzle it is, by its index in the paper's list of puzzles. */
    readonly puzzleIndex: number | undefined;
}

export interface PageLayout {
    readonly kind: PageKind;
    /** Its number in the paper, from 1 for the front page. */
    readonly number: number;
    readonly blocks: readonly PageBlock[];
}

/**
 * One spread: the two pages that lie open side by side. The first spread is
 * the front page alone, as the paper lies closed, and the last is the back
 * page alone. Each spread between holds one puzzle.
 */
export interface SpreadLayout {
    /** Its puzzle, by its index in the paper's list of puzzles, if it has one. */
    readonly puzzleIndex: number | undefined;
    /** The page its puzzle is on, by its index in `pages`. */
    readonly puzzlePage: number | undefined;
    /** Where the puzzle's box is on that page. The box is the shape of the puzzle's play area. */
    readonly puzzleBox: PageRect | undefined;
}

/**
 * A day's paper, laid out. It's worked out from the day alone, so the paper
 * is the same all day, for everyone, and different the next.
 */
export interface PaperLayout {
    readonly day: number;
    /** Its edition, counted from the paper's first. */
    readonly edition: number;
    /** Every page, in order, from the front page to the back. Each spread between shows two: `pages[2s - 1]` on the left and `pages[2s]` on the right. */
    readonly pages: readonly PageLayout[];
    readonly spreads: readonly SpreadLayout[];
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PaperLayoutOptions {
    /** The day of the paper, as a day number. */
    readonly day: number;
    /** Each puzzle's play area, width over height, by its index in the paper's list. A puzzle's box is the same shape. */
    readonly puzzleAspects: readonly number[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Lays out the day's paper: the front page, a spread for each puzzle, in an
 * order of the day's own, and the back page. Each puzzle sits at the top or
 * the foot of one of its spread's pages, and stories fill the rest. A few
 * of the stories have headlines a reader can read, drawn from the paper's
 * own, no two the same.
 */
export function createPaperLayout({ day, puzzleAspects }: PaperLayoutOptions): PaperLayout {
    const random = createRandom({ seed: day * DAY_SEED_STEP + DAY_SEED_OFFSET });
    const headlines = shuffled(HEADLINES, random);
    let nextHeadline = 0;
    const pickHeadline = (): string => headlines[nextHeadline++ % headlines.length];
    const pickSeed = (): number => random.nextIndex(SEED_RANGE);
    const order = shuffled(puzzleAspects.map((_, index) => index), random);

    const pages: PageLayout[] = [{ kind: 'front', number: 1, blocks: layOutFront() }];
    const spreads: SpreadLayout[] = [{ puzzleIndex: undefined, puzzlePage: undefined, puzzleBox: undefined }];
    for (let s = 0; s < order.length; s++) {
        const puzzleIndex = order[s];
        const isOnLeft = random.next() < 0.5;
        const puzzlePage = isOnLeft ? pages.length : pages.length + 1;
        const puzzle = layOutPuzzlePage(puzzleIndex, puzzleAspects[puzzleIndex]);
        const other = layOutStoryPage();
        pages.push(
            { kind: 'inside', number: pages.length + 1, blocks: isOnLeft ? puzzle.blocks : other },
            { kind: 'inside', number: pages.length + 2, blocks: isOnLeft ? other : puzzle.blocks },
        );
        spreads.push({ puzzleIndex, puzzlePage, puzzleBox: puzzle.box });
    }
    pages.push({ kind: 'back', number: pages.length + 1, blocks: layOutBack() });
    spreads.push({ puzzleIndex: undefined, puzzlePage: undefined, puzzleBox: undefined });
    return { day, edition: day - FIRST_EDITION_DAY + 1, pages, spreads };

    /** The front page, under its masthead: the lead story, the index of puzzles, and two stories. */
    function layOutFront(): PageBlock[] {
        const top = MASTHEAD_HEIGHT + DATELINE_HEIGHT + V_GAP;
        const leadHeight = (BODY_BOTTOM - top) * 0.5;
        const lowerTop = top + leadHeight + V_GAP;
        const lowerHeight = BODY_BOTTOM - lowerTop;
        const blocks: PageBlock[] = [
            story(columnX(0), top, spanWidth(6), leadHeight, LEAD_HEADLINES[random.nextIndex(LEAD_HEADLINES.length)], 'lead', true),
            block('index', columnX(0), lowerTop, spanWidth(2), lowerHeight),
            story(columnX(2), lowerTop, spanWidth(2), lowerHeight, pickHeadline(), 'small', true),
        ];
        stack(blocks, columnX(4), lowerTop, spanWidth(2), lowerHeight, 2, false);
        return blocks;
    }

    /** The back page: a story with a photo, the weather, a row of stories, and a row of adverts along its foot. */
    function layOutBack(): PageBlock[] {
        const bodyHeight = BODY_BOTTOM - TOP_MARGIN;
        const topHeight = bodyHeight * 0.4;
        const advertHeight = bodyHeight * 0.17;
        const middleTop = TOP_MARGIN + topHeight + V_GAP;
        const middleHeight = bodyHeight - topHeight - advertHeight - V_GAP * 2;
        const advertTop = BODY_BOTTOM - advertHeight;
        const blocks: PageBlock[] = [
            story(columnX(0), TOP_MARGIN, spanWidth(4), topHeight, pickHeadline(), 'large', true),
            block('weather', columnX(4), TOP_MARGIN, spanWidth(2), topHeight),
        ];
        for (let c = 0; c < COLUMN_COUNT; c += 2) blocks.push(story(columnX(c), middleTop, spanWidth(2), middleHeight, undefined, 'small', c === 2));
        for (let c = 0; c < COLUMN_COUNT; c += 2) blocks.push(block('advert', columnX(c), advertTop, spanWidth(2), advertHeight));
        return blocks;
    }

    /**
     * A page with a puzzle on it. The puzzle spans four columns, at the top
     * or the foot, at the left or the right. Stories stack in the two columns
     * beside it, and fill the band across the page above or below it.
     */
    function layOutPuzzlePage(puzzleIndex: number, aspect: number): { blocks: PageBlock[]; box: PageRect } {
        const boxWidth = spanWidth(PUZZLE_COLUMNS);
        // The box is the puzzle's shape in metres, and a page is taller than it is wide
        const boxHeight = (boxWidth * PAGE_WIDTH) / PAGE_HEIGHT / aspect;
        const blockHeight = PUZZLE_TITLE_HEIGHT + boxHeight;
        const firstColumn = random.next() < 0.5 ? 0 : COLUMN_COUNT - PUZZLE_COLUMNS;
        const isAtTop = random.next() < 0.5;
        const x = columnX(firstColumn);
        const y = isAtTop ? TOP_MARGIN : BODY_BOTTOM - blockHeight;
        const blocks: PageBlock[] = [{ ...block('puzzle', x, y, boxWidth, blockHeight), puzzleIndex }];
        stack(blocks, columnX(firstColumn === 0 ? PUZZLE_COLUMNS : 0), y, spanWidth(COLUMN_COUNT - PUZZLE_COLUMNS), blockHeight, 2 + random.nextIndex(2), false);
        const bandTop = isAtTop ? y + blockHeight + V_GAP : TOP_MARGIN;
        const bandHeight = BODY_BOTTOM - TOP_MARGIN - blockHeight - V_GAP;
        fillBand(blocks, bandTop, bandHeight, pickHeadline());
        return { blocks, box: { x, y: y + PUZZLE_TITLE_HEIGHT, width: boxWidth, height: boxHeight } };
    }

    /** A page of stories alone, in one of a few arrangements. Its main story has a headline a reader can read. */
    function layOutStoryPage(): PageBlock[] {
        const bodyHeight = BODY_BOTTOM - TOP_MARGIN;
        const blocks: PageBlock[] = [];
        switch (random.nextIndex(3)) {
            // A wide story with a photo across the top, and three stories under it
            case 0: {
                const topHeight = bodyHeight * 0.45;
                blocks.push(story(columnX(0), TOP_MARGIN, spanWidth(6), topHeight, pickHeadline(), 'large', true));
                const lowerTop = TOP_MARGIN + topHeight + V_GAP;
                const photoColumn = random.nextIndex(3) * 2;
                for (let c = 0; c < COLUMN_COUNT; c += 2) {
                    blocks.push(story(columnX(c), lowerTop, spanWidth(2), BODY_BOTTOM - lowerTop, c === 0 ? pickHeadline() : undefined, 'small', c === photoColumn));
                }
                break;
            }
            // A story with a photo, four columns wide, two stories beside it, and a band along the foot
            case 1: {
                const topHeight = bodyHeight * 0.6;
                blocks.push(story(columnX(0), TOP_MARGIN, spanWidth(4), topHeight, pickHeadline(), 'large', true));
                stack(blocks, columnX(4), TOP_MARGIN, spanWidth(2), topHeight, 2, true);
                fillBand(blocks, TOP_MARGIN + topHeight + V_GAP, bodyHeight - topHeight - V_GAP, undefined);
                break;
            }
            // Three stacks of two columns, side by side
            default: {
                blocks.push(story(columnX(0), TOP_MARGIN, spanWidth(2), bodyHeight * 0.62, pickHeadline(), 'large', true));
                stack(blocks, columnX(0), TOP_MARGIN + bodyHeight * 0.62 + V_GAP, spanWidth(2), bodyHeight * 0.38 - V_GAP, 1, false);
                stack(blocks, columnX(2), TOP_MARGIN, spanWidth(2), bodyHeight, 2, true);
                stack(blocks, columnX(4), TOP_MARGIN, spanWidth(2), bodyHeight, 3, false);
            }
        }
        return blocks;
    }

    /** Fills a band across the page with stories, or a story and an advert. The first story has `headline`, if one is given. */
    function fillBand(blocks: PageBlock[], top: number, height: number, headline: string | undefined): void {
        switch (random.nextIndex(3)) {
            case 0:
                blocks.push(story(columnX(0), top, spanWidth(4), height, headline, 'large', true));
                blocks.push(block('advert', columnX(4), top, spanWidth(2), height));
                break;
            case 1:
                blocks.push(story(columnX(0), top, spanWidth(6), height, headline, 'large', random.next() < 0.5));
                break;
            default:
                for (let c = 0; c < COLUMN_COUNT; c += 2) blocks.push(story(columnX(c), top, spanWidth(2), height, c === 0 ? headline : undefined, 'small', c === 2));
        }
    }

    /** Stacks `count` blocks in a column, one above the next. Now and then one is an advert. */
    function stack(blocks: PageBlock[], x: number, top: number, width: number, height: number, count: number, isFirstWithPhoto: boolean): void {
        const each = (height - V_GAP * (count - 1)) / count;
        for (let i = 0; i < count; i++) {
            const y = top + i * (each + V_GAP);
            if (i > 0 && random.next() < ADVERT_SHARE) blocks.push(block('advert', x, y, width, each));
            else blocks.push(story(x, y, width, each, undefined, 'small', i === 0 && isFirstWithPhoto));
        }
    }

    function story(x: number, y: number, width: number, height: number, headline: string | undefined, headlineSize: HeadlineSize, hasPhoto: boolean): PageBlock {
        return { kind: 'story', x, y, width, height, headline, headlineSize, hasPhoto, seed: pickSeed(), puzzleIndex: undefined };
    }

    function block(kind: BlockKind, x: number, y: number, width: number, height: number): PageBlock {
        return { kind, x, y, width, height, headline: undefined, headlineSize: 'small', hasPhoto: false, seed: pickSeed(), puzzleIndex: undefined };
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How a day's number becomes its seed, spread out so neighbouring days differ. */
const DAY_SEED_STEP = 7919;
const DAY_SEED_OFFSET = 104_729;
/** Each block's own seed is below this. */
const SEED_RANGE = 1_000_000;
/** How often a block in a stack is an advert. */
const ADVERT_SHARE = 0.3;
const COLUMN_WIDTH = (1 - SIDE_MARGIN * 2 - GUTTER * (COLUMN_COUNT - 1)) / COLUMN_COUNT;
/** The gap between blocks one above the other, as long as a gutter on the page, as a fraction of the page's height. */
const V_GAP = (GUTTER * PAGE_WIDTH) / PAGE_HEIGHT;
const BODY_BOTTOM = 1 - BOTTOM_MARGIN;

function columnX(column: number): number {
    return SIDE_MARGIN + column * (COLUMN_WIDTH + GUTTER);
}

function spanWidth(columns: number): number {
    return columns * COLUMN_WIDTH + (columns - 1) * GUTTER;
}

/** A copy of `items`, shuffled by `random`. */
function shuffled<T>(items: readonly T[], random: Random): T[] {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = random.nextIndex(i + 1);
        const swap = copy[i];
        copy[i] = copy[j];
        copy[j] = swap;
    }
    return copy;
}

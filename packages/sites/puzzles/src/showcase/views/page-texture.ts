import { CanvasSource, Texture } from 'pixi.js';
import { createRandom, type Random } from '@mvtjs/site-kit/random';
import { writeDate } from '../../shared';
import { DATELINE_HEIGHT, GUTTER, MASTHEAD_HEIGHT, PAPER_NAME, PUZZLE_TITLE_HEIGHT, TOP_MARGIN } from '../data';
import type { PageBlock, PageLayout, PaperLayout } from '../models';
import { drawNewsPhoto } from './news-photo';
import { GREY_TEXT_COLOR, INK_COLOR, NEWSPRINT_COLOR, PAGE_TEXTURE_HEIGHT, PAGE_TEXTURE_WIDTH, SERIF_FONT } from './view-constants';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PageTextureOptions {
    /** The day's paper, for its date, its edition and the index of its puzzles. */
    readonly layout: PaperLayout;
    /** The page to print, one of the layout's. */
    readonly page: PageLayout;
    /** Each puzzle's name and picture, by its index in the paper's list. */
    readonly puzzleNames: readonly string[];
    readonly puzzlePictures: readonly Texture[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Prints a page of the paper onto a canvas, and returns it as a texture.
 * Most of it is too small to read. Its stories are grey lines of text under
 * dark bars of headline, and its photos are made-up scenes. Only a few
 * headlines, the masthead, the running heads and the puzzles' names are
 * set in type a reader can read. A puzzle's box shows its picture, as if
 * printed. The page darkens a little toward the spine, where it curves down
 * into the fold.
 */
export function createPageTexture({ layout, page, puzzleNames, puzzlePictures }: PageTextureOptions): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_TEXTURE_WIDTH;
    canvas.height = PAGE_TEXTURE_HEIGHT;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('newspaper: a page needs a 2D canvas');
    // Pages with even numbers lie left of the spine, and those with odd numbers right of it
    const isOnLeft = page.number % 2 === 0;
    const random = createRandom({ seed: layout.day * 31 + page.number });

    context.fillStyle = NEWSPRINT_COLOR;
    context.fillRect(0, 0, W, H);
    if (page.kind === 'front') printMasthead(context, layout);
    else printRunningHead(context, layout, page.number, isOnLeft);
    const bodyTop = page.kind === 'front' ? MASTHEAD_HEIGHT + DATELINE_HEIGHT + 0.02 : TOP_MARGIN + 0.001;
    for (const block of page.blocks) {
        const x = block.x * W;
        const y = block.y * H;
        const width = block.width * W;
        const height = block.height * H;
        // A hairline over each block, but those at the top of the page
        if (block.y > bodyTop) {
            context.fillStyle = INK_COLOR;
            context.fillRect(x, y - GAP_PX / 2 - 1, width, 1.5);
        }
        switch (block.kind) {
            case 'story':
                printStory(context, random, block, x, y, width, height);
                break;
            case 'advert':
                printAdvert(context, random, x, y, width, height);
                break;
            case 'puzzle':
                printPuzzle(context, block, x, y, width, height, puzzleNames, puzzlePictures);
                break;
            case 'index':
                printIndex(context, layout, puzzleNames, x, y, width, height);
                break;
            case 'weather':
                printWeather(context, random, x, y, width, height);
                break;
        }
    }
    shadeTowardSpine(context, isOnLeft);
    const source = new CanvasSource({ resource: canvas, autoGenerateMipmaps: true });
    return new Texture({ source });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const W = PAGE_TEXTURE_WIDTH;
const H = PAGE_TEXTURE_HEIGHT;
/** The gap between blocks, in pixels. */
const GAP_PX = GUTTER * W;
/** A column of text, in pixels, about as wide as one of the page's six. */
const COLUMN_PX = 150;
/** The lines of text too small to read: how far apart, and how thick. */
const LINE_PITCH = 11;
const LINE_THICKNESS = 5;
const HEADLINE_SIZES = { lead: 76, large: 46, small: 30 } as const;
/** Words a few adverts shout, big enough to read from across a room. */
const ADVERT_WORDS: readonly string[] = ['SALE', 'NOW OPEN', 'HALF PRICE', 'FREE TEA', 'BIG SALE', 'NEW'];
const WEATHER_DAYS: readonly string[] = ['Today', 'Tomorrow', 'Next day'];

function font(size: number, weight = 'bold', style = ''): string {
    return `${style} ${weight} ${size}px ${SERIF_FONT}`.trim();
}

/** The paper's name across the top of the front page, between rules, and the line under it with the edition and the date. */
function printMasthead(context: CanvasRenderingContext2D, layout: PaperLayout): void {
    const top = 0.02 * H;
    const nameBottom = MASTHEAD_HEIGHT * H;
    const left = 0.05 * W;
    const right = 0.95 * W;
    context.fillStyle = INK_COLOR;
    context.fillRect(left, top, right - left, 4);
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    context.font = font(22, 'normal', 'italic');
    context.fillText('Folded fresh every morning', W / 2, top + 36);
    fitText(context, PAPER_NAME, W / 2, nameBottom - 34, right - left, 124, 'bold', 'italic');
    // The dateline, between a thick rule and a thin one
    const lineTop = nameBottom;
    const lineBottom = (MASTHEAD_HEIGHT + DATELINE_HEIGHT) * H;
    context.fillRect(left, lineTop - 6, right - left, 4);
    context.fillRect(left, lineBottom, right - left, 1.5);
    context.font = font(22, 'normal');
    const middle = (lineTop + lineBottom) / 2 + 8;
    context.textAlign = 'left';
    context.fillText(`No. ${layout.edition}`, left, middle);
    context.textAlign = 'center';
    context.fillText(writeDate(layout.day), W / 2, middle);
    context.textAlign = 'right';
    context.fillText(`${layout.spreads.length - 2} puzzles inside`, right, middle);
}

/** The line across the top of an inside page: its number at the outer edge, the paper's name, and the date at the inner. */
function printRunningHead(context: CanvasRenderingContext2D, layout: PaperLayout, pageNumber: number, isOnLeft: boolean): void {
    const left = 0.05 * W;
    const right = 0.95 * W;
    const baseline = TOP_MARGIN * H - 26;
    context.fillStyle = INK_COLOR;
    context.textBaseline = 'alphabetic';
    context.font = font(22, 'bold');
    context.textAlign = isOnLeft ? 'left' : 'right';
    context.fillText(String(pageNumber), isOnLeft ? left : right, baseline);
    context.textAlign = 'center';
    context.font = font(22, 'bold', 'italic');
    context.fillText(PAPER_NAME, W / 2, baseline);
    context.font = font(20, 'normal');
    context.textAlign = isOnLeft ? 'right' : 'left';
    context.fillText(writeDate(layout.day), isOnLeft ? right : left, baseline);
    context.fillRect(left, baseline + 12, right - left, 2.5);
}

/** A story: its headline, its photo if it has one, then columns of text down to its foot. */
function printStory(context: CanvasRenderingContext2D, random: Random, block: PageBlock, x: number, y: number, width: number, height: number): void {
    let cursor = y;
    if (block.headline !== undefined) {
        const size = HEADLINE_SIZES[block.headlineSize];
        context.fillStyle = INK_COLOR;
        context.font = font(size);
        context.textAlign = block.headlineSize === 'lead' ? 'center' : 'left';
        context.textBaseline = 'top';
        const lines = wrapText(context, block.headline, width);
        for (const line of lines) {
            context.fillText(line, block.headlineSize === 'lead' ? x + width / 2 : x, cursor);
            cursor += size * 1.12;
        }
        cursor += size * 0.25;
    }
    else {
        // A headline too small to read, as a dark bar or two
        context.fillStyle = INK_COLOR;
        const barCount = width > COLUMN_PX * 2.5 ? 1 : 1 + random.nextIndex(2);
        for (let i = 0; i < barCount; i++) {
            context.fillRect(x, cursor, width * random.between(0.55, i === barCount - 1 ? 0.8 : 0.97), 15);
            cursor += 22;
        }
        cursor += 6;
    }
    if (block.hasPhoto) {
        const photoHeight = Math.min(width * 0.62, (y + height - cursor) * 0.6);
        drawNewsPhoto(context, x, cursor, width, photoHeight, block.seed);
        cursor += photoHeight + 6;
        // Its caption
        context.fillStyle = GREY_TEXT_COLOR;
        context.fillRect(x, cursor, width * random.between(0.4, 0.8), 4);
        cursor += 14;
    }
    printColumns(context, random, x, cursor, width, y + height - cursor);
}

/** Columns of text too small to read, as grey lines, in paragraphs. */
function printColumns(context: CanvasRenderingContext2D, random: Random, x: number, y: number, width: number, height: number): void {
    const columns = Math.max(1, Math.round(width / COLUMN_PX));
    const columnWidth = (width - GAP_PX * (columns - 1)) / columns;
    context.fillStyle = GREY_TEXT_COLOR;
    for (let c = 0; c < columns; c++) {
        const left = x + c * (columnWidth + GAP_PX);
        let isIndented = true;
        for (let lineY = y; lineY + LINE_THICKNESS <= y + height; lineY += LINE_PITCH) {
            const endsParagraph = random.next() < 0.1;
            const indent = isIndented ? 12 : 0;
            const length = endsParagraph ? columnWidth * random.between(0.25, 0.8) : columnWidth;
            context.fillRect(left + indent, lineY, length - indent, LINE_THICKNESS);
            isIndented = endsParagraph;
        }
    }
}

/** An advert in a ruled box, now and then in white on black, with a word in big type, or a picture, over a few lines. */
function printAdvert(context: CanvasRenderingContext2D, random: Random, x: number, y: number, width: number, height: number): void {
    const isDark = random.next() < 0.3;
    const ink = isDark ? NEWSPRINT_COLOR : INK_COLOR;
    if (isDark) {
        context.fillStyle = INK_COLOR;
        context.fillRect(x, y, width, height);
    }
    context.strokeStyle = INK_COLOR;
    context.lineWidth = 4;
    context.strokeRect(x + 2, y + 2, width - 4, height - 4);
    context.fillStyle = ink;
    const inset = 16;
    const word = ADVERT_WORDS[random.nextIndex(ADVERT_WORDS.length)];
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    fitText(context, word, x + width / 2, y + height * 0.32, width - inset * 2, Math.min(64, height * 0.3), 'bold', '');
    context.fillStyle = ink;
    for (let lineY = y + height * 0.55; lineY < y + height - inset; lineY += 16) {
        const length = (width - inset * 2) * random.between(0.5, 0.9);
        context.fillRect(x + (width - length) / 2, lineY, length, 7);
    }
}

/** A puzzle: its name over its box, and its picture in the box, as if printed. */
function printPuzzle(
    context: CanvasRenderingContext2D, block: PageBlock, x: number, y: number, width: number, height: number, names: readonly string[], pictures: readonly Texture[],
): void {
    const index = block.puzzleIndex ?? 0;
    const titleHeight = PUZZLE_TITLE_HEIGHT * H;
    context.fillStyle = INK_COLOR;
    context.textBaseline = 'alphabetic';
    context.textAlign = 'left';
    context.font = font(36);
    context.fillText(names[index].toUpperCase(), x, y + titleHeight - 16);
    context.textAlign = 'right';
    context.font = font(20, 'normal', 'italic');
    context.fillText('Today\'s puzzle', x + width, y + titleHeight - 18);
    const boxY = y + titleHeight;
    const boxHeight = height - titleHeight;
    const source = pictures[index].source.resource as CanvasImageSource | undefined;
    if (source !== undefined) context.drawImage(source, x, boxY, width, boxHeight);
    context.strokeStyle = INK_COLOR;
    context.lineWidth = 3;
    context.strokeRect(x, boxY, width, boxHeight);
}

/** The front page's index: each puzzle inside, and the page it's on. */
function printIndex(context: CanvasRenderingContext2D, layout: PaperLayout, names: readonly string[], x: number, y: number, width: number, height: number): void {
    context.fillStyle = INK_COLOR;
    context.fillRect(x, y, width, 6);
    context.textBaseline = 'alphabetic';
    context.textAlign = 'left';
    context.font = font(30);
    context.fillText('INSIDE TODAY', x, y + 46);
    context.fillRect(x, y + 60, width, 1.5);
    let rowY = y + 104;
    context.font = font(26, 'normal');
    for (const spread of layout.spreads) {
        if (spread.puzzleIndex === undefined || spread.puzzlePage === undefined || rowY > y + height - 10) continue;
        const name = names[spread.puzzleIndex];
        const pageText = String(spread.puzzlePage + 1);
        context.textAlign = 'left';
        context.fillText(name, x, rowY);
        context.textAlign = 'right';
        context.fillText(pageText, x + width, rowY);
        // A dotted leader from the name to the page
        const from = x + context.measureText(name).width + 10;
        const to = x + width - context.measureText(pageText).width - 10;
        for (let dotX = from; dotX < to; dotX += 9) context.fillRect(dotX, rowY - 4, 3, 3);
        rowY += 46;
    }
    context.fillStyle = GREY_TEXT_COLOR;
    for (let lineY = rowY + 10; lineY + LINE_THICKNESS <= y + height; lineY += LINE_PITCH) context.fillRect(x, lineY, width * 0.9, LINE_THICKNESS);
}

/** The back page's weather: three days, each a little picture and its warmest. */
function printWeather(context: CanvasRenderingContext2D, random: Random, x: number, y: number, width: number, height: number): void {
    context.fillStyle = INK_COLOR;
    context.fillRect(x, y, width, 6);
    context.textBaseline = 'alphabetic';
    context.textAlign = 'left';
    context.font = font(30);
    context.fillText('WEATHER', x, y + 46);
    const rowHeight = (height - 80) / WEATHER_DAYS.length;
    for (let i = 0; i < WEATHER_DAYS.length; i++) {
        const rowY = y + 80 + i * rowHeight;
        const iconX = x + rowHeight * 0.45;
        const iconY = rowY + rowHeight * 0.45;
        const size = rowHeight * 0.28;
        const isSunny = random.next() < 0.5;
        context.fillStyle = isSunny ? '#6a655d' : '#8e897f';
        context.beginPath();
        if (isSunny) context.arc(iconX, iconY, size, 0, Math.PI * 2);
        else {
            context.arc(iconX - size * 0.6, iconY + size * 0.2, size * 0.7, 0, Math.PI * 2);
            context.arc(iconX + size * 0.3, iconY - size * 0.1, size * 0.9, 0, Math.PI * 2);
            context.arc(iconX + size * 1.1, iconY + size * 0.3, size * 0.6, 0, Math.PI * 2);
        }
        context.fill();
        context.fillStyle = INK_COLOR;
        context.font = font(24, 'normal');
        context.fillText(WEATHER_DAYS[i], x + rowHeight * 1.1, iconY - 4);
        context.font = font(34);
        context.fillText(`${8 + random.nextIndex(14)}°`, x + rowHeight * 1.1, iconY + 34);
    }
}

/** Darkens the page a little toward the spine, where the paper curves down into the fold. */
function shadeTowardSpine(context: CanvasRenderingContext2D, isOnLeft: boolean): void {
    const spineX = isOnLeft ? W : 0;
    const reach = W * 0.07;
    const shade = context.createLinearGradient(spineX, 0, isOnLeft ? spineX - reach : spineX + reach, 0);
    shade.addColorStop(0, 'rgba(40, 30, 15, 0.22)');
    shade.addColorStop(1, 'rgba(40, 30, 15, 0)');
    context.fillStyle = shade;
    context.fillRect(isOnLeft ? W - reach : 0, 0, reach, H);
}

/** Breaks `text` into lines that fit `width`, in the context's font. */
function wrapText(context: CanvasRenderingContext2D, text: string, width: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
        const next = line === '' ? word : `${line} ${word}`;
        if (line !== '' && context.measureText(next).width > width) {
            lines.push(line);
            line = word;
        }
        else line = next;
    }
    if (line !== '') lines.push(line);
    return lines;
}

/** Writes `text` centred at `x`, in the largest size up to `maxSize` that fits `width`. */
function fitText(context: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, maxSize: number, weight: string, style: string): void {
    context.font = font(maxSize, weight, style);
    const measured = context.measureText(text).width;
    const size = measured > width ? Math.floor((maxSize * width) / measured) : maxSize;
    context.font = font(size, weight, style);
    context.textAlign = 'center';
    context.fillText(text, x, y);
}

import { Container, Graphics, GraphicsContext, Sprite, Text, type TextStyleOptions, Texture } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { watch } from '@mvtjs/utils';
import { CELL_COUNT, type CellKind, COLUMN_OF, type DigMark, ROW_OF, type ShuffleKind } from '../models';
import { DigitTrialView } from './digit-trial-view';
import {
    BOX_LINE_COLOR, CELL_COLOR, CELL_SIZE, DUG_COLOR, DUG_FLASH_COLOR, FOCUS_COLOR, GIVEN_COLOR, GRID_SIZE, HELD_COLOR,
    HIGHLIGHT_COLOR, LOGIC_COLOR, MARK_COLOR, NEEDED_COLOR, NEEDED_PULSE_COLOR, PEER_COLOR, RUBBED_OUT_COLOR, SEARCH_COLOR, TEST_COLOR,
    THIN_LINE_COLOR,
} from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/**
 * The grid's cells, what is in them, and the moments to flash. Cells are
 * numbered across each row from the top left, 0 to 80. A set of digits is a
 * mask with bit `d` set for each digit `d` in it.
 */
export interface GridViewBindings {
    /** The digit in `cell`, or 0. */
    digitAt: (cell: number) => number;
    /** Where the digit in `cell` came from, which sets its colour. */
    cellKindAt: (cell: number) => CellKind;
    digMarkAt: (cell: number) => DigMark;
    /** Whether to tint each cell by what digging made of it. */
    areDigMarksShown: () => boolean;
    /** The pencil marks of `cell`: the digits that could still go there. */
    candidatesAt: (cell: number) => number;
    /** The pencil marks just rubbed out of `cell`, shown in red. */
    eliminatedAt: (cell: number) => number;
    /** Whether `cell` is one the last step of reasoning rests on. */
    isHighlightedAt: (cell: number) => boolean;
    /** Whether `cell` holds a different digit in a second solution on show than in the full grid. Such cells are outlined. */
    isDifferentAt: (cell: number) => boolean;
    /** The digit the full grid holds in `cell`, shown small in the corner of a cell that differs. */
    fullGridDigitAt: (cell: number) => number;
    /** The cell being dug, outlined with its row and column lit, or -1. */
    focusCell: () => number;
    /** The cell whose rival digits are being tried, shown 3 by 3 in place of its digit, or -1. */
    testedCell: () => number;
    /** The tested cell's own digit, its rivals, those ruled out, and the one being tried. See `DigitTrialView`. */
    ownDigit: () => number;
    rivalDigits: () => number;
    ruledOutDigits: () => number;
    testDigit: () => number;
    /** Dead ends the search has met. The cell of each flashes red. */
    deadEnds: () => number;
    deadEndCell: () => number;
    /** Cells found needed, as another digit gave a second solution. Each pulses teal. */
    cellsNeeded: () => number;
    neededCell: () => number;
    /** Cells dug out. Each flashes gold as its digit fades. */
    cellsDug: () => number;
    dugCell: () => number;
    dugDigit: () => number;
    /** Seeds placed, and digits the grader placed. Each digit pops in. */
    seedsPlaced: () => number;
    seedCell: () => number;
    placements: () => number;
    placedCell: () => number;
    /** The last shuffle, and what it swapped: two digits, two columns, or two stacks. */
    shuffleKind: () => ShuffleKind | undefined;
    shuffleFirst: () => number;
    shuffleSecond: () => number;
    /** How far the last shuffle has moved, from 0 to 1. 1 when no shuffle is moving. */
    shuffleProgress: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The 9 by 9 grid. Each cell shows its digit, coloured by where it came
 * from, or its pencil marks while the puzzle is graded. The cell being dug
 * is outlined, and as the digits that could take its digit's place are
 * tried, it shows its digits 3 by 3, crossing each out as it leads nowhere.
 * A dead end flashes red, with a cross in the cell the search
 * emptied, and shakes the grid. A dug cell flashes gold as its digit fades,
 * and a new digit pops in. While a second solution shows, the cells where it
 * differs from the full grid are outlined, with the full grid's digit small
 * in a corner, and the cell found needed pulses teal. While the grid is shuffled, the columns
 * that swap slide past each other, the digits that swap pulse, and a turn
 * turns the whole grid, shrinking it to fit as it tilts, its digits staying
 * upright. Its origin is the grid's top left corner.
 */
export function GridView(bindings: GridViewBindings): Container {
    const view = new Container();
    view.label = 'grid';
    // The board turns about its middle during a turn
    const board = new Container();
    board.pivot.set(GRID_SIZE / 2, GRID_SIZE / 2);
    board.position.set(GRID_SIZE / 2, GRID_SIZE / 2);
    view.addChild(board);

    const backgroundLayer = new Container();
    const contentLayer = new Container();
    const lines = new Graphics();
    drawLines(lines);
    const focus = new Graphics().rect(1.5, 1.5, CELL_SIZE - 3, CELL_SIZE - 3).stroke({ color: FOCUS_COLOR, width: 3 });
    const trial = DigitTrialView({
        ownDigit: bindings.ownDigit,
        rivalDigits: bindings.rivalDigits,
        ruledOutDigits: bindings.ruledOutDigits,
        testDigit: bindings.testDigit,
    });
    board.addChild(backgroundLayer, lines, contentLayer, trial, focus);

    const backgrounds: Sprite[] = [];
    const contents: Container[] = [];
    const digits: Text[] = [];
    const marks: Text[] = [];
    const crosses: Graphics[] = [];
    // Every cell's cross shares one drawing, released with the view
    const crossDrawing = new GraphicsContext()
        .moveTo(-CROSS_SIZE, -CROSS_SIZE).lineTo(CROSS_SIZE, CROSS_SIZE)
        .moveTo(CROSS_SIZE, -CROSS_SIZE).lineTo(-CROSS_SIZE, CROSS_SIZE)
        .stroke({ color: RUBBED_OUT_COLOR, width: 3, cap: 'round' });
    const differenceDrawing = new GraphicsContext()
        .rect(-CELL_SIZE / 2 + 2.5, -CELL_SIZE / 2 + 2.5, CELL_SIZE - 5, CELL_SIZE - 5)
        .stroke({ color: TEST_COLOR, width: 2 });
    const differences: Graphics[] = [];
    const fullGridDigits: Text[] = [];
    view.on('destroyed', () => {
        crossDrawing.destroy();
        differenceDrawing.destroy();
    });
    for (let cell = 0; cell < CELL_COUNT; cell++) createCell(cell);

    // Presentation state: each cell's flashes, from 1 as they start to 0 as they end, and the digit fading from a dug cell
    const deadEndFlashes = new Float32Array(CELL_COUNT);
    const digFlashes = new Float32Array(CELL_COUNT);
    const pops = new Float32Array(CELL_COUNT);
    const neededPulses = new Float32Array(CELL_COUNT);
    const fadingDigits = new Uint8Array(CELL_COUNT);
    // Presentation state: the grid's shake, how long it has left and how long it has run, and the time since one began
    let shakeLeftMs = 0;
    let shakeAgeMs = 0;
    let msSinceShake = SHAKE_GAP_MS;
    const watcher = watch({
        deadEnds: bindings.deadEnds,
        cellsDug: bindings.cellsDug,
        cellsNeeded: bindings.cellsNeeded,
        seedsPlaced: bindings.seedsPlaced,
        placements: bindings.placements,
    });

    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function update(deltaMs: number): void {
        const fade = deltaMs / FLASH_MS;
        for (let cell = 0; cell < CELL_COUNT; cell++) {
            deadEndFlashes[cell] = Math.max(0, deadEndFlashes[cell] - fade);
            digFlashes[cell] = Math.max(0, digFlashes[cell] - fade);
            pops[cell] = Math.max(0, pops[cell] - fade);
            neededPulses[cell] = Math.max(0, neededPulses[cell] - deltaMs / NEEDED_PULSE_MS);
        }
        shakeLeftMs = Math.max(0, shakeLeftMs - deltaMs);
        shakeAgeMs += deltaMs;
        msSinceShake += deltaMs;
        const w = watcher.poll();
        if (w.deadEnds.increased) {
            deadEndFlashes[bindings.deadEndCell()] = 1;
            // The search can meet many dead ends a second, so a shake starts only once the last has had its time
            if (msSinceShake >= SHAKE_GAP_MS) {
                shakeLeftMs = SHAKE_MS;
                shakeAgeMs = 0;
                msSinceShake = 0;
            }
        }
        if (w.cellsDug.increased) {
            const cell = bindings.dugCell();
            digFlashes[cell] = 1;
            fadingDigits[cell] = bindings.dugDigit();
        }
        if (w.cellsNeeded.increased) neededPulses[bindings.neededCell()] = 1;
        if (w.seedsPlaced.increased) pops[bindings.seedCell()] = 1;
        if (w.placements.increased && bindings.placedCell() >= 0) pops[bindings.placedCell()] = 1;
    }

    function refresh(): void {
        const focusCell = bindings.focusCell();
        const areDigMarksShown = bindings.areDigMarksShown();
        focus.visible = focusCell >= 0;
        if (focusCell >= 0) focus.position.set(xOf(focusCell), yOf(focusCell));
        const testedCell = bindings.testedCell();
        trial.visible = testedCell >= 0;
        if (testedCell >= 0) trial.position.set(xOf(testedCell) + CELL_SIZE / 2, yOf(testedCell) + CELL_SIZE / 2);

        // The shuffle: how far the cells still have to go, eased so they set off and arrive gently
        const shuffleKind = bindings.shuffleKind();
        const progress = bindings.shuffleProgress();
        const left = progress >= 1 ? 0 : 1 - easeInOut(progress);
        const first = bindings.shuffleFirst();
        const second = bindings.shuffleSecond();
        const pulse = progress >= 1 ? 0 : Math.sin(progress * Math.PI);
        // A turning grid shrinks as it tilts, so its corners stay inside its own square
        const angle = shuffleKind === 'turn' ? left * Math.PI / 2 : 0;
        board.rotation = -angle;
        board.scale.set(1 / (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle))));
        // The shake: a wobble that dies away, the same each time
        const shake = SHAKE_PX * shakeLeftMs / SHAKE_MS;
        board.position.set(GRID_SIZE / 2 + shake * Math.sin(shakeAgeMs * 0.11), GRID_SIZE / 2 + shake * Math.cos(shakeAgeMs * 0.17));

        for (let cell = 0; cell < CELL_COUNT; cell++) {
            const digit = bindings.digitAt(cell);

            // Where the cell is drawn: its place, less the way a sliding column still has to go
            let slide = 0;
            if (left > 0 && shuffleKind === 'columns') slide = computeSlide(COLUMN_OF[cell], first, second, 1) * left;
            if (left > 0 && shuffleKind === 'stacks') slide = computeSlide(Math.floor(COLUMN_OF[cell] / 3), first, second, 3) * left;
            const x = xOf(cell) + slide;
            backgrounds[cell].x = x + 1;
            contents[cell].x = x + CELL_SIZE / 2;
            contents[cell].rotation = -board.rotation;
            // Of two columns crossing, one passes in front, growing, and the other behind, shrinking and fading
            const depth = Math.sign(slide) * pulse;
            contents[cell].scale.set(1 + depth * (depth > 0 ? FRONT_GROWTH : BACK_SHRINK));
            contents[cell].alpha = depth < 0 ? 1 + depth * BACK_FADE : 1;

            // The background: what digging made of it, lit by the reasoning or the cell being dug, and flashing
            let color = CELL_COLOR;
            const mark = areDigMarksShown ? bindings.digMarkAt(cell) : 'none';
            if (mark === 'dug') color = DUG_COLOR;
            else if (mark === 'needed') color = NEEDED_COLOR;
            else if (mark === 'held') color = HELD_COLOR;
            else if (focusCell >= 0 && (ROW_OF[cell] === ROW_OF[focusCell] || COLUMN_OF[cell] === COLUMN_OF[focusCell])) color = PEER_COLOR;
            if (bindings.isHighlightedAt(cell)) color = HIGHLIGHT_COLOR;
            color = mixColors(color, NEEDED_PULSE_COLOR, neededPulses[cell] * 0.8);
            color = mixColors(color, DUG_FLASH_COLOR, digFlashes[cell] * 0.5);
            color = mixColors(color, RUBBED_OUT_COLOR, deadEndFlashes[cell] * 0.6);
            backgrounds[cell].tint = color;

            // A dead end's cross, while the cell it emptied stays empty
            const cross = crosses[cell];
            cross.visible = deadEndFlashes[cell] > 0 && digit === 0;
            cross.alpha = deadEndFlashes[cell];
            cross.scale.set(0.7 + deadEndFlashes[cell] * 0.3);

            // A cell where a second solution differs from the full grid: outlined, with the full grid's digit in its corner
            const isDifferent = digit !== 0 && bindings.isDifferentAt(cell);
            const isTested = cell === testedCell;
            differences[cell].visible = isDifferent;
            fullGridDigits[cell].visible = isDifferent && !isTested;
            if (isDifferent) fullGridDigits[cell].text = DIGIT_TEXTS[bindings.fullGridDigitAt(cell)];

            // The digit, or the digit fading from a cell just dug
            const text = digits[cell];
            const isSwapping = shuffleKind === 'digits' && (digit === first || digit === second);
            if (isTested) {
                // The tested cell shows its digits 3 by 3 instead
                text.text = '';
            }
            else if (digit !== 0) {
                text.text = DIGIT_TEXTS[digit];
                const kindColor = isDifferent ? TEST_COLOR : DIGIT_COLORS[bindings.cellKindAt(cell)];
                text.tint = mixColors(kindColor, DUG_FLASH_COLOR, isSwapping ? pulse : 0);
                text.alpha = 1;
                text.scale.set(1 + pops[cell] * 0.5 + (isSwapping ? pulse * 0.3 : 0));
            }
            else if (digFlashes[cell] > 0) {
                text.text = DIGIT_TEXTS[fadingDigits[cell]];
                text.tint = DUG_FLASH_COLOR;
                text.alpha = digFlashes[cell];
                text.scale.set(1 + (1 - digFlashes[cell]) * 0.4);
            }
            else {
                text.text = '';
            }

            // The pencil marks, of an empty cell only
            const candidates = digit === 0 ? bindings.candidatesAt(cell) : 0;
            const eliminated = digit === 0 ? bindings.eliminatedAt(cell) : 0;
            for (let d = 1; d <= 9; d++) {
                const pencilMark = marks[cell * 9 + d - 1];
                const bit = 1 << d;
                pencilMark.visible = ((candidates | eliminated) & bit) !== 0;
                pencilMark.tint = (eliminated & bit) !== 0 ? RUBBED_OUT_COLOR : MARK_COLOR;
            }
        }
    }

    function createCell(cell: number): void {
        const background = new Sprite({ texture: Texture.WHITE, width: CELL_SIZE - 1, height: CELL_SIZE - 1, tint: CELL_COLOR });
        background.position.set(xOf(cell) + 1, yOf(cell) + 1);
        backgroundLayer.addChild(background);
        backgrounds.push(background);

        // The content sits on the cell's middle, so it can turn and grow about it
        const content = new Container();
        content.position.set(xOf(cell) + CELL_SIZE / 2, yOf(cell) + CELL_SIZE / 2);
        const cross = new Graphics(crossDrawing);
        cross.visible = false;
        content.addChild(cross);
        crosses.push(cross);
        const difference = new Graphics(differenceDrawing);
        difference.visible = false;
        content.addChild(difference);
        differences.push(difference);
        const fullGridDigit = new Text({ text: '', style: MARK_STYLE, anchor: 0.5, visible: false, tint: GIVEN_COLOR });
        fullGridDigit.position.set(-CELL_SIZE / 2 + 8, -CELL_SIZE / 2 + 9);
        content.addChild(fullGridDigit);
        fullGridDigits.push(fullGridDigit);
        const digit = new Text({ text: '', style: DIGIT_STYLE, anchor: 0.5 });
        content.addChild(digit);
        digits.push(digit);
        for (let d = 1; d <= 9; d++) {
            const pencilMark = new Text({ text: DIGIT_TEXTS[d], style: MARK_STYLE, anchor: 0.5, visible: false });
            pencilMark.position.set((((d - 1) % 3) - 1) * MARK_SPACING, (Math.floor((d - 1) / 3) - 1) * MARK_SPACING);
            content.addChild(pencilMark);
            marks.push(pencilMark);
        }
        contentLayer.addChild(content);
        contents.push(content);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How long a flash or a pop lasts, and the pulse of a cell found needed, in ms. */
const FLASH_MS = 450;
const NEEDED_PULSE_MS = 700;
/** How far a dead end's cross reaches from the cell's middle, each way, in pixels. */
const CROSS_SIZE = 9;
/** A dead end's shake: how far the grid moves at first, in pixels, how long it lasts, and the least time between two, in ms. */
const SHAKE_PX = 3;
const SHAKE_MS = 220;
const SHAKE_GAP_MS = 350;
/** How far apart the pencil marks are, in pixels. */
const MARK_SPACING = 13;
/** As two columns cross, how much the front one's digits grow, and the back one's shrink and fade, at the crossing. */
const FRONT_GROWTH = 0.15;
const BACK_SHRINK = 0.3;
const BACK_FADE = 0.75;

const DIGIT_STYLE: TextStyleOptions = { fontFamily: 'monospace', fontSize: 26, fontWeight: 'bold', fill: 0xffffff };
const MARK_STYLE: TextStyleOptions = { fontFamily: 'monospace', fontSize: 11, fill: 0xffffff };
const DIGIT_TEXTS: readonly string[] = ['', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const DIGIT_COLORS: Readonly<Record<CellKind, number>> = {
    empty: GIVEN_COLOR,
    given: GIVEN_COLOR,
    search: SEARCH_COLOR,
    test: TEST_COLOR,
    logic: LOGIC_COLOR,
};

function xOf(cell: number): number {
    return COLUMN_OF[cell] * CELL_SIZE;
}

function yOf(cell: number): number {
    return ROW_OF[cell] * CELL_SIZE;
}

/**
 * How far a column, or a stack of `width` columns, is from where it was
 * before the shuffle, in pixels. The two that swapped each came from the
 * other's place.
 */
function computeSlide(place: number, first: number, second: number, width: number): number {
    if (place === first) return (second - first) * width * CELL_SIZE;
    if (place === second) return (first - second) * width * CELL_SIZE;
    return 0;
}

/** Eases `t`, from 0 to 1, so it starts and ends slowly. */
function easeInOut(t: number): number {
    return t * t * (3 - 2 * t);
}

/** `from` moved towards `to` by `amount`, from 0 to 1, a channel at a time. */
function mixColors(from: number, to: number, amount: number): number {
    if (amount <= 0) return from;
    const r = ((from >> 16) & 0xff) + (((to >> 16) & 0xff) - ((from >> 16) & 0xff)) * amount;
    const g = ((from >> 8) & 0xff) + (((to >> 8) & 0xff) - ((from >> 8) & 0xff)) * amount;
    const b = (from & 0xff) + ((to & 0xff) - (from & 0xff)) * amount;
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

/** The thin lines between cells, and the thick ones round each box. */
function drawLines(g: Graphics): void {
    for (let i = 0; i <= 9; i++) {
        if (i % 3 === 0) continue;
        g.moveTo(i * CELL_SIZE, 0).lineTo(i * CELL_SIZE, GRID_SIZE);
        g.moveTo(0, i * CELL_SIZE).lineTo(GRID_SIZE, i * CELL_SIZE);
    }
    g.stroke({ color: THIN_LINE_COLOR, width: 1 });
    for (let i = 0; i <= 9; i += 3) {
        g.moveTo(i * CELL_SIZE, 0).lineTo(i * CELL_SIZE, GRID_SIZE);
        g.moveTo(0, i * CELL_SIZE).lineTo(GRID_SIZE, i * CELL_SIZE);
    }
    g.stroke({ color: BOX_LINE_COLOR, width: 2 });
}

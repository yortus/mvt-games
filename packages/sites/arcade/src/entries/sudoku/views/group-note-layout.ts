import { countDigits } from '#sudoku-digger';
import type { GroupNote } from '../models';
import { findGroupNoteLanes } from './find-group-note-lanes';
import { CELL_SIZE } from './view-constants';

// Where a group note's lines and label go. The board lays the notes out
// once each time they change, and both the view that draws them and the
// board, which finds a label under a tap, read that layout. Positions are
// in cells, across and down the grid.

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Where a group note is drawn: its lines, and its label. */
export interface GroupNoteLayout {
    readonly note: GroupNote;
    readonly lines: readonly GroupNoteLine[];
    /** The middle of its label, in cells. */
    readonly labelX: number;
    readonly labelY: number;
    /** How wide its label is, in pixels. */
    readonly labelWidth: number;
}

/**
 * Returns where each of `notes` is drawn, in the same order. Notes that
 * share a cell take lanes of their own, so they never look like one. A
 * label covers no cell that `isFilledAt` says is filled.
 */
export function layOutGroupNotes(notes: readonly GroupNote[], isFilledAt: (cell: number) => boolean): readonly GroupNoteLayout[] {
    const lanes = findGroupNoteLanes(notes);
    const layouts: GroupNoteLayout[] = [];
    for (let n = 0; n < notes.length; n++) {
        const note = notes[n];
        const lines = findGroupNoteLines(note.cells, lanes[n]);
        const label = placeLabel(lines, note.digits, isFilledAt);
        layouts.push({ note, lines, labelX: label.x, labelY: label.y, labelWidth: measureGroupNoteLabel(note.digits) });
    }
    return layouts;
}

/** What `placeGroupNote` places a label for. */
export interface GroupNoteLabelPlacing {
    /** The note's cells, in order. */
    readonly cells: readonly number[];
    /** The note's lane, which shifts its lines and label to one side. */
    readonly lane: number;
    /** The note's digits, as a set, which set how wide its label is. */
    readonly digits: number;
    /** Whether `cell` is filled, given or filled in. A label never covers a filled cell's digit. */
    readonly isFilledAt: (cell: number) => boolean;
}

/**
 * Returns where a group note's label goes: half way along its lines, such
 * as on the edge two neighbours share, in the middle cell of three in a
 * line, or on the corner of an L. A note in a lane above 0 has it off to
 * one side, as its lines are. If that would cover a filled cell's digit, it
 * goes to the nearest place along the note's lines that covers none.
 */
export function placeGroupNote(placing: GroupNoteLabelPlacing): { x: number; y: number } {
    return placeLabel(findGroupNoteLines(placing.cells, placing.lane), placing.digits, placing.isFilledAt);
}

/** Where the label of a note with `lines` and `digits` goes. See `placeGroupNote`. */
function placeLabel(lines: readonly GroupNoteLine[], digits: number, isFilledAt: (cell: number) => boolean): { x: number; y: number } {
    const halfWidth = measureGroupNoteLabel(digits) / CELL_SIZE / 2;
    const halfHeight = GROUP_NOTE_LABEL_HEIGHT / CELL_SIZE / 2;
    const preferred = findHalfWay(lines);
    if (!coversFilledDigit(preferred.x, preferred.y, halfWidth, halfHeight, isFilledAt)) return preferred;

    let best = preferred;
    let bestDistance = Infinity;
    for (let i = 0; i < lines.length; i++) {
        const { fromX, fromY, toX, toY } = lines[i];
        const steps = Math.ceil(Math.hypot(toX - fromX, toY - fromY) / SPOT_STEP);
        for (let step = 0; step <= steps; step++) {
            const x = fromX + ((toX - fromX) * step) / steps;
            const y = fromY + ((toY - fromY) * step) / steps;
            const distance = Math.hypot(x - preferred.x, y - preferred.y);
            if (distance >= bestDistance || coversFilledDigit(x, y, halfWidth, halfHeight, isFilledAt)) continue;
            best = { x, y };
            bestDistance = distance;
        }
    }
    return best;
}

/** A straight line of a group note, from one point to another, in cells. */
export interface GroupNoteLine {
    readonly fromX: number;
    readonly fromY: number;
    readonly toX: number;
    readonly toY: number;
}

/**
 * Returns the lines a note in `lane` draws through its cells, one after
 * another, each starting where the last ends. The cells are joined as a
 * path, in the order with fewest steps to a cell that isn't side by side
 * with the last, then the shortest, so three cells in an L make an L. The
 * lines run between the cells' middles, shifted square to them, to one
 * side and then the other as the lanes rise. Where a path turns, its lines
 * meet where their shifted lines cross.
 */
export function findGroupNoteLines(cells: readonly number[], lane: number): readonly GroupNoteLine[] {
    const path = findPath(cells);
    const lines: GroupNoteLine[] = [];
    for (let i = 1; i < path.length; i++) {
        let line = findLine(path[i - 1], path[i], lane);
        if (i > 1) {
            const join = findJoin(lines[i - 2], line);
            lines[i - 2] = { ...lines[i - 2], toX: join.x, toY: join.y };
            line = { ...line, fromX: join.x, fromY: join.y };
        }
        lines.push(line);
    }
    return lines;
}

/** The line a note in `lane` draws from the middle of cell `from` to the middle of cell `to`, shifted for its lane. */
function findLine(from: number, to: number, lane: number): GroupNoteLine {
    const dx = (to % 9) - (from % 9);
    const dy = Math.floor(to / 9) - Math.floor(from / 9);
    const length = Math.hypot(dx, dy);
    const distance = lane <= 0 ? 0 : Math.ceil(lane / 2) * LANE_STEP * (lane % 2 === 1 ? 1 : -1);
    const shiftX = (-dy / length) * distance;
    const shiftY = (dx / length) * distance;
    const fromX = (from % 9) + 0.5 + shiftX;
    const fromY = Math.floor(from / 9) + 0.5 + shiftY;
    return { fromX, fromY, toX: fromX + dx, toY: fromY + dy };
}

/** Returns how wide the label of a note with `digits` is, in pixels: sized by its characters, so it is the same wherever it is drawn. */
export function measureGroupNoteLabel(digits: number): number {
    const count = countDigits(digits);
    return count * LABEL_DIGIT_WIDTH + Math.max(0, count - 1) * LABEL_DOT_WIDTH + LABEL_PADDING * 2;
}

/** How tall a label is, in pixels. */
export const GROUP_NOTE_LABEL_HEIGHT = 20;

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far apart the lanes of notes sharing a cell are, in cells. */
const LANE_STEP = 0.16;
/** How finely a note's lines are searched for a place for its label, in cells. */
const SPOT_STEP = 0.05;
/** How far a filled cell's digit reaches from the cell's middle, across and down, in cells. */
const DIGIT_HALF_WIDTH = 0.2;
const DIGIT_HALF_HEIGHT = 0.3;
/** About how wide a label's digits and dots are, and its padding, in pixels. */
const LABEL_DIGIT_WIDTH = 8.5;
const LABEL_DOT_WIDTH = 5;
const LABEL_PADDING = 6;

/** The most cells whose every order is tried for the best path. More keep their order, which no unit's worth of notes needs. */
const MOST_CELLS_ORDERED = 6;

/** The point half way along `lines`, which is where a label goes unless it covers a filled cell's digit there. */
function findHalfWay(lines: readonly GroupNoteLine[]): { x: number; y: number } {
    let total = 0;
    for (let i = 0; i < lines.length; i++) total += measureLine(lines[i]);
    let remaining = total / 2;
    for (let i = 0; i < lines.length; i++) {
        const { fromX, fromY, toX, toY } = lines[i];
        const length = measureLine(lines[i]);
        if (remaining <= length || i === lines.length - 1) {
            const along = length === 0 ? 0 : Math.min(1, remaining / length);
            return { x: fromX + (toX - fromX) * along, y: fromY + (toY - fromY) * along };
        }
        remaining -= length;
    }
    return { x: 0, y: 0 };
}

function measureLine(line: GroupNoteLine): number {
    return Math.hypot(line.toX - line.fromX, line.toY - line.fromY);
}

/** Where line `a` and the line after it, `b`, meet: where they cross, or where `a` ends if they run the same way. */
function findJoin(a: GroupNoteLine, b: GroupNoteLine): { x: number; y: number } {
    const ax = a.toX - a.fromX;
    const ay = a.toY - a.fromY;
    const bx = b.toX - b.fromX;
    const by = b.toY - b.fromY;
    const cross = ax * by - ay * bx;
    if (Math.abs(cross) < 1e-9) return { x: a.toX, y: a.toY };
    const t = ((b.fromX - a.fromX) * by - (b.fromY - a.fromY) * bx) / cross;
    return { x: a.fromX + ax * t, y: a.fromY + ay * t };
}

/** The order to join `cells` in: the one with fewest steps between cells that aren't side by side, then the shortest. */
function findPath(cells: readonly number[]): readonly number[] {
    if (cells.length <= 2 || cells.length > MOST_CELLS_ORDERED) return cells;
    let best = cells;
    let bestCost = Infinity;
    const order: number[] = [];
    const isUsed = cells.map(() => false);
    tryOrders();
    return best;

    function tryOrders(): void {
        if (order.length === cells.length) {
            const cost = measurePath(order);
            if (cost < bestCost) {
                best = order.slice();
                bestCost = cost;
            }
            return;
        }
        for (let i = 0; i < cells.length; i++) {
            if (isUsed[i]) continue;
            isUsed[i] = true;
            order.push(cells[i]);
            tryOrders();
            order.pop();
            isUsed[i] = false;
        }
    }
}

/** A path's cost: a step to a cell that isn't side by side counts far more than any length, so a path of neighbours wins. */
function measurePath(path: readonly number[]): number {
    let cost = 0;
    for (let i = 1; i < path.length; i++) {
        const dx = Math.abs((path[i] % 9) - (path[i - 1] % 9));
        const dy = Math.abs(Math.floor(path[i] / 9) - Math.floor(path[i - 1] / 9));
        cost += Math.hypot(dx, dy) + (dx + dy === 1 ? 0 : 100);
    }
    return cost;
}

/** Whether a box `halfWidth` by `halfHeight` either side of (`x`, `y`) overlaps a filled cell's digit. */
function coversFilledDigit(x: number, y: number, halfWidth: number, halfHeight: number, isFilledAt: (cell: number) => boolean): boolean {
    const firstColumn = Math.max(0, Math.floor(x - halfWidth - DIGIT_HALF_WIDTH));
    const lastColumn = Math.min(8, Math.floor(x + halfWidth + DIGIT_HALF_WIDTH));
    const firstRow = Math.max(0, Math.floor(y - halfHeight - DIGIT_HALF_HEIGHT));
    const lastRow = Math.min(8, Math.floor(y + halfHeight + DIGIT_HALF_HEIGHT));
    for (let row = firstRow; row <= lastRow; row++) {
        for (let column = firstColumn; column <= lastColumn; column++) {
            if (!isFilledAt(row * 9 + column)) continue;
            const isOver = Math.abs(x - (column + 0.5)) < halfWidth + DIGIT_HALF_WIDTH && Math.abs(y - (row + 0.5)) < halfHeight + DIGIT_HALF_HEIGHT;
            if (isOver) return true;
        }
    }
    return false;
}

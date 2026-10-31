import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { hasDigit } from '#sudoku-digger';
import { GROUP_NOTE_LABEL_HEIGHT, type GroupNoteLayout, type GroupNoteLine } from './group-note-layout';
import { CARD_COLOR, CELL_SIZE, FONT_FAMILY, GROUP_COLORS } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GroupNotesViewBindings {
    /** Where each group note goes. The list is replaced as the notes change, and the notes are drawn again only then. */
    layouts: () => readonly GroupNoteLayout[];
    /** The digit in `cell`, given or filled in, or 0. A note's lines arc over filled cells. */
    digitAt: (cell: number) => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The group notes over the grid. Each note's cells are joined by lines
 * from cell to cell, in its own colour, and it is labelled with its
 * digits, such as "2·8". The cells themselves are left as they are. A line
 * across filled cells rises in a gentle arc over them, to show it skips
 * them, and passes behind their digits, as the board draws them above the
 * notes. A label never covers a filled digit. Notes that share a cell are
 * kept apart, so they never look like one: each takes a lane, with its
 * lines and label off to one side in a higher lane, and its path of lines
 * stops short of the middles of the cells at its ends. An L of cells has
 * an unbroken L of a line. Its origin is the grid's top left corner.
 */
export function GroupNotesView(bindings: GroupNotesViewBindings): Container {
    const view = new Container();
    view.label = 'group-notes';
    const shapes = new Graphics();
    const labelLayer = new Container();
    view.addChild(shapes, labelLayer);
    // A label for each note: a pill and its text, made as more are needed, and kept
    const pills: Graphics[] = [];
    const texts: Text[] = [];
    // Scratch space as the notes are drawn: where a line arcs, as pairs of start and end along it
    const arcs: number[] = [];
    const isFilledAt = (cell: number): boolean => bindings.digitAt(cell) !== 0;
    // The layouts drawn last, which a new list replaces
    let drawn: readonly GroupNoteLayout[] | undefined;

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const layouts = bindings.layouts();
        if (layouts !== drawn) draw(layouts);
    }

    function draw(layouts: readonly GroupNoteLayout[]): void {
        drawn = layouts;
        shapes.clear();
        for (let n = 0; n < layouts.length; n++) {
            const { note, lines } = layouts[n];
            const color = GROUP_COLORS[note.id % GROUP_COLORS.length];
            for (let i = 0; i < lines.length; i++) drawLine(lines[i], i === 0, i === lines.length - 1);
            shapes.stroke({ color, width: 2, alpha: 0.6 });
            drawLabel(n, layouts[n], color);
        }
        for (let i = layouts.length; i < pills.length; i++) {
            pills[i].visible = false;
            texts[i].visible = false;
        }
    }

    /**
     * Adds one of a note's lines to its path, carrying on from the last. The
     * path stops a little short of the middles of the cells at its ends, so
     * where notes share a cell, their lines never meet there and look like
     * one. Over each run of filled cells a line crosses, it rises in one
     * gentle arc, up for a line across, and to the right for a line down.
     */
    function drawLine(line: GroupNoteLine, isFirst: boolean, isLast: boolean): void {
        const { fromX, fromY, toX, toY } = line;
        const dx = toX - fromX;
        const dy = toY - fromY;
        const length = Math.hypot(dx, dy);
        // The way an arc rises: square to the line
        const riseX = dy / length;
        const riseY = -dx / length;
        const steps = Math.ceil(length / LINE_STEP);

        // Where the line is over filled cells, from where it enters the first of a run to where it leaves the last
        arcs.length = 0;
        let arcStart = -1;
        for (let step = 0; step <= steps; step++) {
            const along = step / steps;
            const x = fromX + dx * along;
            const y = fromY + dy * along;
            const isOverFilled = x >= 0 && x < 9 && y >= 0 && y < 9 && isFilledAt(Math.floor(y) * 9 + Math.floor(x));
            if (isOverFilled && arcStart < 0) arcStart = along;
            if (!isOverFilled && arcStart >= 0) {
                arcs.push(arcStart, along);
                arcStart = -1;
            }
        }

        const start = isFirst ? MIDDLE_GAP / length : 0;
        const end = isLast ? 1 - MIDDLE_GAP / length : 1;
        for (let step = 0; step <= steps; step++) {
            const along = start + ((end - start) * step) / steps;
            const rise = findRise(along);
            const x = (fromX + dx * along + riseX * rise) * CELL_SIZE;
            const y = (fromY + dy * along + riseY * rise) * CELL_SIZE;
            if (step === 0 && isFirst) shapes.moveTo(x, y);
            else shapes.lineTo(x, y);
        }
    }

    /** How far the line rises at `along`, in cells: along a sine's hump over each arc. */
    function findRise(along: number): number {
        for (let i = 0; i < arcs.length; i += 2) {
            if (along > arcs[i] && along < arcs[i + 1]) return Math.sin(((along - arcs[i]) / (arcs[i + 1] - arcs[i])) * Math.PI) * ARC_HEIGHT;
        }
        return 0;
    }

    function drawLabel(index: number, layout: GroupNoteLayout, color: number): void {
        if (index === pills.length) {
            pills.push(new Graphics());
            texts.push(new Text({ text: '', style: LABEL_STYLE, anchor: 0.5 }));
            labelLayer.addChild(pills[index], texts[index]);
        }
        const pill = pills[index];
        const text = texts[index];
        const x = layout.labelX * CELL_SIZE;
        const y = layout.labelY * CELL_SIZE;
        text.text = writeDigits(layout.note.digits);
        text.tint = color;
        text.position.set(x, y);
        const width = layout.labelWidth;
        const height = GROUP_NOTE_LABEL_HEIGHT;
        pill.clear().roundRect(-width / 2, -height / 2, width, height, height / 2).fill(CARD_COLOR).stroke({ color, width: 1.5 });
        pill.position.set(x, y);
        pill.visible = true;
        text.visible = true;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far short of a cell's middle a note's line stops, how finely it is drawn, and how high it arcs over filled cells, in cells. */
const MIDDLE_GAP = 0.14;
const LINE_STEP = 0.02;
const ARC_HEIGHT = 0.2;

const LABEL_STYLE: TextStyleOptions = { fontFamily: FONT_FAMILY, fontSize: 14, fontWeight: '700', fill: 0xffffff };

/** The digits of a set, smallest first, with a dot between each: "2·8". */
function writeDigits(digits: number): string {
    const parts: string[] = [];
    for (let digit = 1; digit <= 9; digit++) if (hasDigit(digits, digit)) parts.push(String(digit));
    return parts.join('·');
}

import type { Graphics } from 'pixi.js';

// Small helpers for drawing the grid, which this demo and Sudoku, the game,
// each draw their own way. They import nothing from Pixi but its types, so
// a model can import the grid's rules without bringing a renderer with
// them, and the Arcade, which lists this entry, loads no renderer either.

/** Each digit's text, and nothing for 0, an empty cell. */
export const DIGIT_TEXTS: readonly string[] = ['', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** How a grid's lines are drawn: its cells' size, the thin lines between them, and the heavier ones round each box. */
export interface GridLineStyle {
    readonly cellSize: number;
    readonly thinColor: number;
    readonly boxColor: number;
    readonly boxWidth: number;
    /** Whether the heavy lines' ends are square, so the grid's corners are filled in, or stop short at the corners. */
    readonly boxEnds: 'square' | 'butt';
}

/** Draws a grid's lines into `g`: thin ones between the cells, and heavier ones round each box and the whole grid. */
export function drawGridLines(g: Graphics, style: GridLineStyle): Graphics {
    const { cellSize } = style;
    const size = cellSize * 9;
    for (let i = 1; i < 9; i++) {
        if (i % 3 === 0) continue;
        g.moveTo(i * cellSize, 0).lineTo(i * cellSize, size);
        g.moveTo(0, i * cellSize).lineTo(size, i * cellSize);
    }
    g.stroke({ color: style.thinColor, width: 1 });
    for (let i = 0; i <= 9; i += 3) {
        g.moveTo(i * cellSize, 0).lineTo(i * cellSize, size);
        g.moveTo(0, i * cellSize).lineTo(size, i * cellSize);
    }
    g.stroke({ color: style.boxColor, width: style.boxWidth, cap: style.boxEnds });
    return g;
}

/** Returns colour `from` moved towards colour `to` by `amount`, from 0 to 1, a channel at a time. */
export function mixColors(from: number, to: number, amount: number): number {
    if (amount <= 0) return from;
    const r = ((from >> 16) & 0xff) + (((to >> 16) & 0xff) - ((from >> 16) & 0xff)) * amount;
    const g = ((from >> 8) & 0xff) + (((to >> 8) & 0xff) - ((from >> 8) & 0xff)) * amount;
    const b = (from & 0xff) + ((to & 0xff) - (from & 0xff)) * amount;
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

/** Eases `t`, from 0 to 1, so it starts and ends slowly. */
export function easeInOut(t: number): number {
    return t * t * (3 - 2 * t);
}

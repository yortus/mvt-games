import type { Container, Graphics } from 'pixi.js';
import type { GlassWindow } from '../models';
import type { BoardShapes } from './board-shapes';
import { LEAD_COLOR, LEAD_HALF_WIDTH } from './view-constants';

// The drawing that more than one of the board's layers does.

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Draws a free piece's ring, round (`x`, `y`), over a faint dark band so it shows on pale glass too, at `alpha`. */
export function drawPieceRing(into: Graphics, x: number, y: number, radius: number, alpha: number): void {
    into.circle(x, y, radius).stroke({ color: LEAD_COLOR, width: RING_WIDTH + 2, alpha: RING_EDGE_ALPHA * alpha });
    into.circle(x, y, radius).stroke({ color: RING_COLOR, width: RING_WIDTH, alpha });
}

/** What `drawLoosePiece` draws. */
export interface LoosePieceOptions {
    /** A container of two graphics: the piece's shadow, then its pane. */
    readonly into: Container;
    readonly shapes: BoardShapes;
    readonly puzzle: GlassWindow;
    /** The tile whose shape the piece is drawn in, and the piece, whose colour it is. */
    readonly tile: number;
    readonly piece: number;
}

/**
 * Draws a piece off its tile, as it flies or is dragged: its shadow and its
 * pane, shaped as tile `tile`'s piece, about the tile's middle, with a free
 * piece's ring. A tile the frame trims has its whole rhombus drawn.
 */
export function drawLoosePiece(options: LoosePieceOptions): void {
    const { into, shapes, puzzle, tile, piece } = options;
    const { centreX, centreY, scale, pieceShapes, ringRadius } = shapes;
    const mx = centreX + puzzle.patch.middleXs[tile] * scale;
    const my = centreY + puzzle.patch.middleYs[tile] * scale;
    const about = shiftPolygon(pieceShapes[tile], mx, my);
    (into.children[0] as Graphics).clear().poly(about).fill({ color: 0x000000, alpha: SHADOW_ALPHA });
    const pane = (into.children[1] as Graphics).clear().poly(about).fill(puzzle.colours[piece]).stroke({ color: LEAD_COLOR, width: LEAD_HALF_WIDTH * 2, join: 'round' });
    drawPieceRing(pane, 0, 0, ringRadius, 1);
}

/** A polygon's corners, given as x, y pairs, moved so (`x`, `y`) is at the origin. */
export function shiftPolygon(points: readonly number[], x: number, y: number): number[] {
    const shifted: number[] = [];
    for (let i = 0; i < points.length; i += 2) shifted.push(points[i] - x, points[i + 1] - y);
    return shifted;
}

/** A colour partway from `a` to `b`, each 0xRRGGBB, mixed channel by channel. */
export function mixColours(a: number, b: number, t: number): number {
    if (t <= 0) return a;
    if (t >= 1) return b;
    const r = Math.round(((a >> 16) & 0xff) + (((b >> 16) & 0xff) - ((a >> 16) & 0xff)) * t);
    const g = Math.round(((a >> 8) & 0xff) + (((b >> 8) & 0xff) - ((a >> 8) & 0xff)) * t);
    const bl = Math.round((a & 0xff) + ((b & 0xff) - (a & 0xff)) * t);
    return (r << 16) | (g << 8) | bl;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The lead round a locked group, half as wide again as the lead between two
 * pieces. It is drawn along the glass's edge, so half of it lies over the
 * glass, adding half a lead's width inside.
 */
export const LOCK_LEAD_WIDTH = LEAD_HALF_WIDTH * 2;
/** A lifted piece's shadow: how far it falls, in pixels, and how dark it is. */
export const SHADOW_OFFSET = 4;
export const SHADOW_ALPHA = 0.28;

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A free piece's ring: its colour, its line's width, and how dark the faint band beneath it is. */
const RING_COLOR = 0xffffff;
const RING_WIDTH = 1.5;
const RING_EDGE_ALPHA = 0.3;

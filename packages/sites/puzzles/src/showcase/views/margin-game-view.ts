import { type Container3D, FlatMaterial, Mesh3D, PlaneGeometry } from '@pixi/3d';
import { CanvasSource, Texture } from 'pixi.js';
import { ownResources, setRefresh } from '@mvtjs/pixi-3d';
import type { MarginGameModel } from '../models';
import { MARGIN_GRID_LEFT, MARGIN_GRID_SIDE, MARGIN_GRID_TOP } from './find-margin-cell';
import { LEAF_Y } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface MarginGameViewBindings {
    /** The game, whose marks this draws. */
    readonly game: MarginGameModel;
    /** Whether the back page lies open and still, so the grid shows on it. */
    readonly isShown: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The noughts and crosses in the back page's margin, in pencil: the grid,
 * the marks in it, and a line through a win. It's drawn on a canvas, which
 * lies on the page over the newsprint, and is drawn again only when a mark
 * is made, a game ends or a game is rubbed out. Each stroke wobbles a
 * little, as a hand's would, by the same amount each time it's drawn, so
 * drawing it again doesn't move anything.
 *
 * It's on the page only while the page lies still. A turning page is
 * printed once, and its pencil marks would stay behind as it turned.
 */
export function MarginGameView({ game, isShown }: MarginGameViewBindings): Container3D {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('newspaper: the margin game needs a 2D canvas');
    const texture = new Texture({ source: new CanvasSource({ resource: canvas }) });
    const width = MARGIN_GRID_SIDE;
    const height = MARGIN_GRID_SIDE;
    const plane = new PlaneGeometry({ width, height, flipV: true });
    const material = new FlatMaterial({ baseColorTexture: texture, alphaMode: 'blend' });
    const sheet = new Mesh3D({
        geometry: plane,
        material,
        x: MARGIN_GRID_LEFT + width / 2,
        // Just over the page, under a page as it turns
        y: LEAF_Y + 0.0005,
        z: MARGIN_GRID_TOP + height / 2,
    });
    // A plane faces +z. Laid back to face up, its top points to the tops of the pages
    sheet.rotation.set(-Math.PI / 2, 0, 0);
    ownResources(sheet, [plane, material, texture]);
    // What was drawn last, so the canvas is drawn again only when the game changes
    let drawnMarks = -1;
    let drawnGames = -1;
    let drawnOutcome = '';

    setRefresh(sheet, () => {
        const isSheetShown = isShown();
        sheet.visible = isSheetShown;
        if (!isSheetShown) return;
        if (game.marksMade === drawnMarks && game.gamesRubbedOut === drawnGames && game.outcome === drawnOutcome) return;
        drawnMarks = game.marksMade;
        drawnGames = game.gamesRubbedOut;
        drawnOutcome = game.outcome;
        draw(context);
        texture.source.update();
    });
    return sheet;

    function draw(c: CanvasRenderingContext2D): void {
        c.clearRect(0, 0, canvas.width, canvas.height);
        c.strokeStyle = PENCIL;
        c.lineWidth = LINE_WIDTH;
        c.lineCap = 'round';
        c.lineJoin = 'round';
        // A fresh grid for each game, drawn a little differently
        const grid = game.gamesRubbedOut * 101;
        const cell = CANVAS_SIZE / 3;
        for (let i = 1; i <= 2; i++) {
            stroke(c, i * cell, INSET, i * cell, CANVAS_SIZE - INSET, grid + i);
            stroke(c, INSET, i * cell, CANVAS_SIZE - INSET, i * cell, grid + i + 2);
        }
        for (let i = 0; i < 9; i++) {
            const mark = game.markAt(i);
            const cx = (i % 3 + 0.5) * cell;
            const cy = (Math.floor(i / 3) + 0.5) * cell;
            const seed = grid + 10 + i * 7;
            if (mark === 'cross') drawCross(c, cx, cy, seed);
            else if (mark === 'nought') drawNought(c, cx, cy, seed);
        }
        const line = game.winningLine;
        if (line !== undefined) {
            const [ax, ay] = cellMiddle(line[0]);
            const [bx, by] = cellMiddle(line[2]);
            // Run on past the end squares a little, as a pencil does
            const dx = (bx - ax) * 0.18;
            const dy = (by - ay) * 0.18;
            stroke(c, ax - dx, ay - dy, bx + dx, by + dy, grid + 99);
        }
    }

    function cellMiddle(index: number): [number, number] {
        const cell = CANVAS_SIZE / 3;
        return [(index % 3 + 0.5) * cell, (Math.floor(index / 3) + 0.5) * cell];
    }

    function drawCross(c: CanvasRenderingContext2D, cx: number, cy: number, seed: number): void {
        const r = MARK_RADIUS;
        stroke(c, cx - r, cy - r, cx + r, cy + r, seed);
        stroke(c, cx + r, cy - r, cx - r, cy + r, seed + 1);
    }

    /** A nought, drawn round once and a little past where it began, slightly squashed and tilted. */
    function drawNought(c: CanvasRenderingContext2D, cx: number, cy: number, seed: number): void {
        const start = wobble(seed) * Math.PI;
        const tilt = wobble(seed + 1) * 0.4;
        c.beginPath();
        for (let step = 0; step <= NOUGHT_STEPS; step++) {
            const angle = start + (step / NOUGHT_STEPS) * Math.PI * 2.15;
            const r = MARK_RADIUS * (1 + wobble(seed + step) * 0.06);
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r * 0.86;
            const px = cx + x * Math.cos(tilt) - y * Math.sin(tilt);
            const py = cy + x * Math.sin(tilt) + y * Math.cos(tilt);
            if (step === 0) c.moveTo(px, py);
            else c.lineTo(px, py);
        }
        c.stroke();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The canvas's size, square, in pixels. */
const CANVAS_SIZE = 256;
/** How far the grid's lines stop short of its edges, and a mark's size from its middle, in pixels. */
const INSET = 10;
const MARK_RADIUS = 24;
/** The pencil: soft graphite grey, a little see-through, so the newsprint shows faintly under it. */
const PENCIL = 'rgba(50, 50, 58, 0.88)';
const LINE_WIDTH = 5;
/** How many short steps a nought is drawn in. */
const NOUGHT_STEPS = 28;
/** How far a stroke's middle strays from straight, in pixels, at most. */
const WOBBLE = 2.6;

/** Draws a pencil stroke from one point to another, its middle bowed a little to one side by `seed`. */
function stroke(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, seed: number): void {
    const length = Math.hypot(x1 - x0, y1 - y0) || 1;
    // Across the stroke, so the bow is sideways
    const nx = -(y1 - y0) / length;
    const ny = (x1 - x0) / length;
    const bow = wobble(seed) * WOBBLE;
    c.beginPath();
    c.moveTo(x0 + wobble(seed + 1) * 1.2, y0 + wobble(seed + 2) * 1.2);
    c.quadraticCurveTo((x0 + x1) / 2 + nx * bow * 2, (y0 + y1) / 2 + ny * bow * 2, x1, y1);
    c.stroke();
}

/** A number from -1 to 1 that depends only on `seed`, so a stroke wobbles the same way each time it's drawn. */
function wobble(seed: number): number {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1;
}

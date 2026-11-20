import type { Graphics } from 'pixi.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Where a hull goes, in pixels. */
export interface DrawHullOptions {
    /** Where the hull starts and ends along its line: across for a boat lying across, down for one lying down. */
    readonly from: number;
    readonly to: number;
    /** The middle of the hull, the other way. */
    readonly middle: number;
    /** How wide the hull is, the other way. */
    readonly beam: number;
    /** Whether the hull lies down, rather than across. */
    readonly isDown: boolean;
    /** Whether the hull ends at its start, with a rounded stern, rather than going on past the edge of what is drawn. */
    readonly hasStern: boolean;
    /** Whether the hull ends at its end, with a pointed bow, rather than going on. */
    readonly hasBow: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Adds a boat's hull, seen from above, to `graphics`, as one closed shape
 * for the caller to fill and stroke: a rounded stern at its start, a
 * pointed bow at its end, and straight sides between. An end that goes on
 * is cut square instead, so a printed piece of a longer boat looks like a
 * piece.
 */
export function drawHull(graphics: Graphics, options: DrawHullOptions): void {
    const { from, to, middle, beam, isDown, hasStern, hasBow } = options;
    const top = middle - beam / 2;
    const bottom = middle + beam / 2;
    const round = hasStern ? Math.min(beam * STERN_SHARE, (to - from) / 2) : 0;
    const bow = hasBow ? Math.min(beam * BOW_SHARE, (to - from) / 2) : 0;
    // Points are worked out along and across the hull, then turned for a hull lying down
    const moveTo = (along: number, across: number): void => {
        if (isDown) graphics.moveTo(across, along);
        else graphics.moveTo(along, across);
    };
    const lineTo = (along: number, across: number): void => {
        if (isDown) graphics.lineTo(across, along);
        else graphics.lineTo(along, across);
    };
    const curveTo = (controlAlong: number, controlAcross: number, along: number, across: number): void => {
        if (isDown) graphics.quadraticCurveTo(controlAcross, controlAlong, across, along);
        else graphics.quadraticCurveTo(controlAlong, controlAcross, along, across);
    };
    moveTo(from + round, top);
    lineTo(to - bow, top);
    if (hasBow) {
        curveTo(to - bow * BOW_CURVE, top, to, middle);
        curveTo(to - bow * BOW_CURVE, bottom, to - bow, bottom);
    }
    else {
        lineTo(to, top);
        lineTo(to, bottom);
    }
    lineTo(from + round, bottom);
    if (hasStern) {
        curveTo(from, bottom, from, bottom - round);
        lineTo(from, top + round);
        curveTo(from, top, from + round, top);
    }
    else {
        lineTo(from, bottom);
        lineTo(from, top);
    }
    graphics.closePath();
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How round the stern's corners are, and how long the bow's point is, as shares of the beam, and how far along the bow its curve's control points sit, as a share of the bow. */
const STERN_SHARE = 0.38;
const BOW_SHARE = 0.75;
const BOW_CURVE = 0.1;

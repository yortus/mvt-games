import type { Graphics } from 'pixi.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Where a hull goes, in pixels. */
export interface DrawHullOptions {
    /** Where the hull starts along its line: across for a boat lying across, down for one lying down. */
    readonly from: number;
    /** Where the hull ends along its line. */
    readonly to: number;
    /** The middle of the hull, the other way. */
    readonly middle: number;
    /** How wide the hull is, the other way. */
    readonly beam: number;
    /** Whether the hull lies down, rather than across. */
    readonly isDown: boolean;
    /** Whether the hull ends at `from` in a rounded stern, rather than being cut square there. */
    readonly hasStern: boolean;
    /** Whether the hull ends at `to` in a pointed bow, rather than being cut square there. */
    readonly hasBow: boolean;
    /**
     * How round the stern's corners are. Leave it out to fit them to this
     * hull. Pass a whole hull's when you draw a piece of it, so the piece's
     * stern matches.
     */
    readonly sternRound?: number;
    /**
     * How long the bow's point is. Leave it out to fit it to this hull. Pass
     * a whole hull's when you draw a piece of it, so the piece's bow matches.
     */
    readonly bowLength?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Adds a boat's hull, seen from above, to `graphics`, as one closed shape
 * for the caller to fill and stroke. It has a rounded stern at its start, a
 * pointed bow at its end, and straight sides between. An end that goes on
 * is cut square instead, so a printed piece of a longer boat looks like a
 * piece.
 */
export function drawHull(graphics: Graphics, options: DrawHullOptions): void {
    const { from, to, middle, beam, isDown, hasStern, hasBow } = options;
    const top = middle - beam / 2;
    const bottom = middle + beam / 2;
    const round = hasStern ? (options.sternRound ?? measureSternRound(beam, to - from)) : 0;
    const bow = hasBow ? (options.bowLength ?? measureBowLength(beam, to - from)) : 0;
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

/** Returns how round the stern's corners are on a hull `beam` wide and `length` long. */
export function measureSternRound(beam: number, length: number): number {
    return Math.min(beam * STERN_SHARE, length / 2);
}

/** Returns how long the bow's point is on a hull `beam` wide and `length` long. */
export function measureBowLength(beam: number, length: number): number {
    return Math.min(beam * BOW_SHARE, length / 2);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How round the stern's corners are, as a share of the beam. */
const STERN_SHARE = 0.38;

/** How long the bow's point is, as a share of the beam. */
const BOW_SHARE = 0.95;

/** How far along the bow its curve's control points sit, as a share of the bow. */
const BOW_CURVE = 0.55;

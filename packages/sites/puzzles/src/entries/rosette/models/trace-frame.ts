// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The outline of a window's frame. Each is convex, so a tile of the tiling
 * is cut by it simply, along straight sides.
 */
export type FrameKind =
    | 'rectangle' | 'round-arch' | 'pointed-arch' | 'rose' | 'octagon' | 'hexagon' | 'oval' | 'segmental-arch' | 'tudor-arch'
    | 'gable' | 'diamond' | 'rounded-rectangle';

/** Every frame there is, in the order the days take them. */
export const FRAME_KINDS: readonly FrameKind[] = [
    'rectangle', 'round-arch', 'hexagon', 'pointed-arch', 'oval', 'octagon', 'segmental-arch', 'rose', 'gable', 'tudor-arch',
    'diamond', 'rounded-rectangle',
];

/**
 * How wide every frame's box is, for each 1 high: the board's shape, so a
 * frame fills it.
 */
export const FRAME_ASPECT = 0.9;

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Traces a frame's outline, as x, y pairs round it, from its middle, with y
 * down. It fits a box from -FRAME_ASPECT to FRAME_ASPECT across and -1 to 1
 * down, and goes round the way that makes its signed area (the sum of x
 * times the next y, less the next x times y, halved) positive, as every
 * piece of glass does: up the left side first. A curve is many short
 * straight sides.
 */
export function traceFrame(kind: FrameKind): number[] {
    const a = FRAME_ASPECT;
    switch (kind) {
        case 'rectangle':
            return [-a, 1, -a, -1, a, -1, a, 1];
        case 'round-arch': {
            // Upright sides, and a half circle across the top
            const points = [-a, 1];
            traceArc(points, 0, -1 + a, a, Math.PI, 2 * Math.PI, ARC_STEPS * 2);
            points.push(a, 1);
            return points;
        }
        case 'pointed-arch':
            return tracePointedArch();
        case 'rose': {
            const points: number[] = [];
            traceArc(points, 0, 0, a, Math.PI, 3 * Math.PI, ARC_STEPS * 4);
            // The last point is the first again
            points.length -= 2;
            return points;
        }
        case 'octagon': {
            // Flat at the top and bottom, as wide as the box
            const radius = a / Math.cos(Math.PI / 8);
            const points: number[] = [];
            for (let k = 0; k < 8; k++) {
                const angle = Math.PI - Math.PI / 8 + (k * Math.PI) / 4;
                points.push(radius * Math.cos(angle), radius * Math.sin(angle));
            }
            return points;
        }
        case 'hexagon':
            // Pointed at the top and bottom, upright at the sides
            return [-a, 0.5, -a, -0.5, 0, -1, a, -0.5, a, 0.5, 0, 1];
        case 'oval': {
            const points: number[] = [];
            for (let i = 0; i < ARC_STEPS * 4; i++) {
                const angle = Math.PI + (2 * Math.PI * i) / (ARC_STEPS * 4);
                points.push(a * Math.cos(angle), Math.sin(angle));
            }
            return points;
        }
        case 'segmental-arch': {
            // Upright sides, and a shallow arc across the top, through its corners and the middle of the box's top
            const rise = SEGMENTAL_ARCH_RISE;
            const radius = (a * a + rise * rise) / (2 * rise);
            const centreY = -1 + radius;
            const points = [-a, 1];
            traceArc(points, 0, centreY, radius, Math.atan2(-1 + rise - centreY, -a), Math.atan2(-1 + rise - centreY, a), ARC_STEPS * 2);
            points.push(a, 1);
            return points;
        }
        case 'tudor-arch': {
            // Upright sides, a tight curve at each shoulder, and straight lines on from them, meeting at a low point
            const radius = a * TUDOR_SHOULDER;
            const turn = TUDOR_TURN;
            const reach = a - radius + radius * Math.cos(turn);
            const spring = -1 + radius * Math.sin(turn) + reach / Math.tan(turn);
            const points = [-a, 1];
            traceArc(points, -a + radius, spring, radius, Math.PI, Math.PI + turn, ARC_STEPS);
            points.push(0, -1);
            traceArc(points, a - radius, spring, radius, -turn, 0, ARC_STEPS);
            points.push(a, 1);
            return points;
        }
        case 'gable':
            // A house's end: upright sides, and a roof meeting at the top
            return [-a, 1, -a, -1 + GABLE_ROOF, 0, -1, a, -1 + GABLE_ROOF, a, 1];
        case 'diamond':
            return [-a, 0, 0, -1, a, 0, 0, 1];
        case 'rounded-rectangle': {
            const radius = a * ROUNDED_CORNER;
            const points: number[] = [];
            traceArc(points, -a + radius, -1 + radius, radius, Math.PI, 1.5 * Math.PI, ARC_STEPS);
            traceArc(points, a - radius, -1 + radius, radius, 1.5 * Math.PI, 2 * Math.PI, ARC_STEPS);
            traceArc(points, a - radius, 1 - radius, radius, 0, 0.5 * Math.PI, ARC_STEPS);
            traceArc(points, -a + radius, 1 - radius, radius, 0.5 * Math.PI, Math.PI, ARC_STEPS);
            return points;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many straight sides make a quarter of a circle. */
const ARC_STEPS = 12;

/** A pointed arch's arcs' radius, as a share of the window's width. Half would make a round arch, and 1 an equilateral one. */
const POINTED_ARCH_RADIUS = 0.8;
/** How far a segmental arch's top rises above its corners, in the box's half heights. */
const SEGMENTAL_ARCH_RISE = 0.3;
/** A Tudor arch's shoulders: their radius, as a share of half the width, and how far each turns, in radians, before its straight line. */
const TUDOR_SHOULDER = 0.4;
const TUDOR_TURN = (50 * Math.PI) / 180;
/** How far a gable's roof rises above its sides, in the box's half heights. */
const GABLE_ROOF = 0.6;
/** A rounded rectangle's corners' radius, as a share of half the width. */
const ROUNDED_CORNER = 0.3;

/** Two arcs meeting at a point at the top, each centred on the far side's springing line, on upright sides. */
function tracePointedArch(): number[] {
    const a = FRAME_ASPECT;
    const radius = 2 * a * POINTED_ARCH_RADIUS;
    const rise = Math.sqrt(radius * radius - (radius - a) * (radius - a));
    const spring = -1 + rise;
    const turn = Math.acos((radius - a) / radius);
    const points = [-a, 1];
    traceArc(points, -a + radius, spring, radius, Math.PI, Math.PI + turn, ARC_STEPS);
    const left = points.length;
    traceArc(points, a - radius, spring, radius, -turn, 0, ARC_STEPS);
    // The point is on both arcs, so it is kept once
    points.splice(left, 2);
    points.push(a, 1);
    return points;
}

/** Adds the points of an arc about (`x`, `y`), from angle `from` to `to`, in `steps` straight sides. */
function traceArc(points: number[], x: number, y: number, radius: number, from: number, to: number, steps: number): void {
    for (let i = 0; i <= steps; i++) {
        const angle = from + ((to - from) * i) / steps;
        points.push(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
    }
}

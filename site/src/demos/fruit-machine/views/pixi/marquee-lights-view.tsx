/** @jsxImportSource @mvtjs/pixi/jsx */
import type { Container, Graphics } from 'pixi.js';
import { ROW_COUNT } from '../../data';
import { BULB_OFF, BULB_ON, CELL_SIZE, FRAME_PADDING, WHITE, WINDOW_WIDTH, WINDOW_X, WINDOW_Y } from './pixi-layout';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** `'busy'` chases fast, `'party'` flashes, `'off'` is dark. */
export type LightsMode = 'idle' | 'busy' | 'party' | 'off';

export interface MarqueeLightsViewBindings {
    readonly mode: () => LightsMode;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A ring of bulbs round the window that chase slowly while the machine waits,
 * race while it spins, and flash while it celebrates. Which bulbs are lit is
 * the view's own business: a clock it keeps itself, advanced in `update`,
 * that the model knows nothing about.
 */
export function MarqueeLightsView(bindings: MarqueeLightsViewBindings): Container {
    let clockMs = 0;

    return (
        <container onUpdate={(deltaMs) => { clockMs += deltaMs; }}>
            {BULBS.map((bulb, i) => (
                <graphics x={bulb.x} y={bulb.y} ref={drawBulb} tint={() => (isLit(i) ? BULB_ON : BULB_OFF)} />
            ))}
        </container>
    );

    function isLit(bulb: number): boolean {
        switch (bindings.mode()) {
            case 'idle': return (bulb + Math.floor(clockMs / 220)) % 4 === 0;
            case 'busy': return (bulb + Math.floor(clockMs / 45)) % 4 < 2;
            case 'party': return (bulb % 2 === 0) === (Math.floor(clockMs / 140) % 2 === 0);
            default: return false;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BULB_RADIUS = 5;
const BULB_SPACING = 30;
/** How far outside the frame the ring of bulbs runs. */
const RING_OUTSET = 13;

/** Each bulb's centre, walking clockwise round the ring from its top left corner. */
const BULBS = ringPoints();

function ringPoints(): { x: number; y: number }[] {
    const left = WINDOW_X - FRAME_PADDING - RING_OUTSET;
    const top = WINDOW_Y - FRAME_PADDING - RING_OUTSET;
    const width = WINDOW_WIDTH + 2 * (FRAME_PADDING + RING_OUTSET);
    const height = ROW_COUNT * CELL_SIZE + 2 * (FRAME_PADDING + RING_OUTSET);
    const perimeter = 2 * (width + height);
    const count = Math.round(perimeter / BULB_SPACING);
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < count; i++) {
        let d = (i * perimeter) / count;
        if (d < width) {
            points.push({ x: left + d, y: top });
            continue;
        }
        d -= width;
        if (d < height) {
            points.push({ x: left + width, y: top + d });
            continue;
        }
        d -= height;
        if (d < width) {
            points.push({ x: left + width - d, y: top + height });
            continue;
        }
        points.push({ x: left, y: top + height - (d - width) });
    }
    return points;
}

/** Drawn white once, and tinted on or off. */
function drawBulb(g: Graphics): void {
    g.circle(0, 0, BULB_RADIUS).fill(WHITE);
}

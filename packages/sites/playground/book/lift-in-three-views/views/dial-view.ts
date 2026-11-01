import { Container, Graphics, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DialViewBindings {
    /** Where the lift is, in floors. */
    readonly floor: () => number;
    /** How many floors the dial shows. Read once. */
    readonly floorCount: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * An old-fashioned dial above the lift doors, with a needle that sweeps
 * from the ground floor on the left to the top floor on the right. It
 * fills a box 180 wide and 220 tall.
 */
export function DialView(bindings: DialViewBindings): Container {
    const { floorCount } = bindings;
    const view = new Container();

    // Drawn once: the dial's face, and a name for each floor round its edge
    const face = new Graphics();
    face.circle(CENTRE_X, CENTRE_Y, RADIUS + 12).fill(0x2a2118).stroke({ color: 0xb08d57, width: 3 });
    face.rect(CENTRE_X - RADIUS - 16, CENTRE_Y, 2 * RADIUS + 32, RADIUS + 16).fill(0x10141f);
    view.addChild(face);
    for (let i = 0; i < floorCount; i++) {
        const angle = angleOf(i, floorCount);
        const name = new Text({ text: i === 0 ? 'G' : String(i), style: { fontFamily: 'monospace', fontSize: 14, fill: 0xe8d5b0 } });
        name.anchor.set(0.5, 0.5);
        name.position.set(CENTRE_X + Math.cos(angle) * (RADIUS - 8), CENTRE_Y + Math.sin(angle) * (RADIUS - 8));
        view.addChild(name);
    }

    // Drawn once, pointing right. Each refresh turns it.
    const needle = new Graphics();
    needle.moveTo(0, 0).lineTo(RADIUS - 22, 0).stroke({ color: 0xff6655, width: 3 });
    needle.circle(0, 0, 5).fill(0xb08d57);
    needle.position.set(CENTRE_X, CENTRE_Y);
    view.addChild(needle);

    function refresh(): void {
        needle.rotation = angleOf(bindings.floor(), floorCount);
    }

    setRefresh(view, refresh);
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const CENTRE_X = 90;
const CENTRE_Y = 140;
const RADIUS = 70;

/** The needle's angle for a floor: half a turn, from the left, over the top, to the right. */
function angleOf(floor: number, floorCount: number): number {
    return Math.PI + (floor / (floorCount - 1)) * Math.PI;
}

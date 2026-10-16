import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { ClockModel } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ClockViewBindings {
    readonly model: ClockModel;
    /** The size of the play area, in pixels. The clock is centred in it. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A clock face with hour, minute and second hands. The model gives the time,
 * and the view turns it into the angle of each hand.
 */
export function ClockView({ model, width, height }: ClockViewBindings): Container {
    const view = new Container();
    view.position.set(width / 2, height / 2);

    const face = new Graphics();
    drawFace(face);

    // Each hand is drawn once, pointing to 12. Each refresh turns it.
    const hourHand = createHand({ length: RADIUS * 0.5, width: 4, color: 0xcccccc });
    const minuteHand = createHand({ length: RADIUS * 0.7, width: 3, color: 0xcccccc });
    const secondHand = createHand({ length: RADIUS * 0.9, width: 1, color: 0xff4444 });
    view.addChild(face, hourHand, minuteHand, secondHand);

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        hourHand.rotation = (model.hours / 12) * FULL_TURN;
        minuteHand.rotation = (model.minutes / 60) * FULL_TURN;
        secondHand.rotation = (model.seconds / 60) * FULL_TURN;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface HandOptions {
    /** In pixels. */
    readonly length: number;
    /** In pixels. */
    readonly width: number;
    readonly color: number;
}

/** The radius of the clock face, in pixels. */
const RADIUS = 80;
const FULL_TURN = Math.PI * 2;

/** Draws the face, centred on 0, 0, with a mark for each hour and a dot in the middle. */
function drawFace(g: Graphics): void {
    g.circle(0, 0, RADIUS).fill(0x1a1a2e).stroke({ color: 0x8888cc, width: 2 });

    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * FULL_TURN - Math.PI / 2;
        const inner = RADIUS - 8;
        g.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
        g.lineTo(Math.cos(angle) * RADIUS, Math.sin(angle) * RADIUS);
        g.stroke({ color: 0x8888cc, width: 2 });
    }

    g.circle(0, 0, 3).fill(0xff4444);
}

/** Creates a hand that turns about 0, 0, pointing up until it is turned. */
function createHand({ length, width, color }: HandOptions): Graphics {
    return new Graphics().moveTo(0, 0).lineTo(0, -length).stroke({ color, width });
}

import { Container, Graphics, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ShaftViewBindings {
    /** Where the lift is, in floors. */
    readonly floor: () => number;
    readonly areDoorsOpen: () => boolean;
    /** How many floors to draw. Read once. */
    readonly floorCount: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The lift shaft, from the side, with the car at its floor. The doors slide
 * open while it waits. It fills a box 180 wide and 220 tall.
 */
export function ShaftView(bindings: ShaftViewBindings): Container {
    const { floorCount } = bindings;
    const view = new Container();
    const floorHeight = SHAFT_HEIGHT / floorCount;

    // Drawn once: the shaft, and a line and a name for each floor
    const shaft = new Graphics();
    shaft.rect(SHAFT_LEFT, TOP, SHAFT_WIDTH, SHAFT_HEIGHT).fill(0x151b28).stroke({ color: 0x3a4660, width: 2 });
    view.addChild(shaft);
    for (let i = 0; i < floorCount; i++) {
        const y = TOP + SHAFT_HEIGHT - i * floorHeight;
        shaft.moveTo(SHAFT_LEFT - 8, y).lineTo(SHAFT_LEFT, y).stroke({ color: 0x3a4660, width: 2 });
        const name = new Text({ text: i === 0 ? 'G' : String(i), style: { fontFamily: 'monospace', fontSize: 13, fill: 0x8899bb } });
        name.anchor.set(1, 1);
        name.position.set(SHAFT_LEFT - 12, y - 2);
        view.addChild(name);
    }

    // The car, with two doors that shrink towards its sides as they open
    const car = new Container();
    const carWidth = SHAFT_WIDTH - 10;
    const carHeight = floorHeight - 6;
    const body = new Graphics().rect(0, 0, carWidth, carHeight).fill(0xffd166);
    const leftDoor = new Graphics().rect(0, 0, carWidth / 2 - 1, carHeight).fill(0x8a6d2b);
    const rightDoor = new Graphics().rect(-(carWidth / 2 - 1), 0, carWidth / 2 - 1, carHeight).fill(0x8a6d2b);
    rightDoor.x = carWidth;
    car.addChild(body, leftDoor, rightDoor);
    car.x = SHAFT_LEFT + 5;
    view.addChild(car);

    function refresh(): void {
        car.y = TOP + SHAFT_HEIGHT - (bindings.floor() + 1) * floorHeight + 3;
        const doorScale = bindings.areDoorsOpen() ? 0.2 : 1;
        leftDoor.scale.x = doorScale;
        rightDoor.scale.x = doorScale;
    }

    setRefresh(view, refresh);
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TOP = 10;
const SHAFT_LEFT = 70;
const SHAFT_WIDTH = 60;
const SHAFT_HEIGHT = 200;

import { Container, Graphics, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface LaneViewBindings {
    /** What this lane shows, written above it. */
    readonly title: string;
    /** The ball's centre, in world units along the lane. */
    readonly x: () => number;
    readonly radius: number;
    /** Where each wall's centre is, in world units along the lane. */
    readonly leftWall: number;
    readonly rightWall: number;
    readonly wallThickness: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A lane with a wall at each end, and the ball rolling along it. One world unit is drawn as one pixel. */
export function LaneView(bindings: LaneViewBindings): Container {
    const { radius, leftWall, rightWall, wallThickness } = bindings;
    const view = new Container();

    const title = new Text({
        text: bindings.title,
        style: { fontFamily: 'monospace', fontSize: 15, fill: 0x8899aa },
    });
    title.position.set(leftWall, 0);

    const laneY = 50;
    const lane = new Graphics()
        .moveTo(0, laneY + radius + 2).lineTo(WORLD_WIDTH, laneY + radius + 2).stroke({ color: 0x26324a, width: 2 })
        .rect(leftWall - wallThickness / 2, laneY - WALL_HEIGHT / 2, wallThickness, WALL_HEIGHT).fill(0xc8d2e0)
        .rect(rightWall - wallThickness / 2, laneY - WALL_HEIGHT / 2, wallThickness, WALL_HEIGHT).fill(0xc8d2e0);

    const ball = new Graphics().circle(0, 0, radius).fill(0x44aaff);
    ball.y = laneY;

    view.addChild(title, lane, ball);
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        ball.x = bindings.x();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far the lane's floor is drawn, past the walls on both sides. */
const WORLD_WIDTH = 640;
const WALL_HEIGHT = 44;

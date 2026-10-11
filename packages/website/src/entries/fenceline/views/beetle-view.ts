import { Container, Graphics } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import type { BeetlePhase, Direction } from '../models';
import { drawPixels, type PixelRects } from './drawing';
import { COLOURS } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BeetleViewBindings {
    /** Where it is, in grid steps. */
    row: () => number;
    col: () => number;
    /** A cell's size in pixels, read once. */
    cellSize: number;
    /** How many times its pixel art's size to draw the beetle, read once. Larger reads better on a small screen. */
    spriteScale: number;
    direction: () => Direction;
    phase: () => BeetlePhase;
    /** How far it has hatched, from 0 to 1. */
    hatchProgress: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A fence beetle, dark with a green sheen. Its legs scuttle as it crawls,
 * and it is turned the way it goes. While it hatches, it is an egg on the
 * fence that rocks harder and cracks as it is about to open.
 */
export function BeetleView(bindings: BeetleViewBindings): Container {
    const { cellSize, spriteScale } = bindings;
    const legsA = drawPixels(new Graphics(), LEGS_A);
    const legsB = drawPixels(new Graphics(), LEGS_B);
    const body = drawPixels(new Graphics(), BODY);
    const beetle = new Container();
    beetle.addChild(legsA, legsB, body);
    const crack = drawPixels(new Graphics(), CRACK);
    const egg = new Container();
    egg.addChild(drawPixels(new Graphics(), EGG), crack);
    const view = new Container();
    view.addChild(beetle, egg);
    view.scale.set(spriteScale);

    // Presentation state: time, for its legs and the egg's rocking
    let ageMs = 0;

    setUpdate(view, (deltaMs) => {
        ageMs += deltaMs;
    });
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        view.position.set(Math.round(bindings.col() * cellSize), Math.round(bindings.row() * cellSize));
        const isHatching = bindings.phase() === 'hatching';
        beetle.visible = !isHatching;
        egg.visible = isHatching;
        if (isHatching) {
            const progress = bindings.hatchProgress();
            egg.rotation = Math.sin(ageMs * 0.03) * 0.4 * progress;
            crack.visible = progress > 0.5;
            return;
        }
        beetle.rotation = ROTATIONS[bindings.direction()];
        const isStepA = Math.floor(ageMs / LEG_MS) % 2 === 0;
        legsA.visible = isStepA;
        legsB.visible = !isStepA;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const LEG_MS = 70;

/** Its turn for each way it goes. It is drawn heading up. */
const ROTATIONS: Readonly<Record<Direction, number>> = {
    up: 0,
    right: Math.PI / 2,
    down: Math.PI,
    left: -Math.PI / 2,
};

// Heading up, centred on the origin

const BODY: PixelRects = [
    [-1, -4, 3, 1, COLOURS.beetle],
    [-2, -3, 5, 6, COLOURS.beetle],
    [0, -3, 1, 6, COLOURS.post],
    [-1, -2, 1, 2, COLOURS.beetleShine],
    [1, -1, 1, 2, COLOURS.beetleShine],
];

const LEGS_A: PixelRects = [
    [-3, -3, 1, 1, COLOURS.beetle],
    [3, -2, 1, 1, COLOURS.beetle],
    [-3, 0, 1, 1, COLOURS.beetle],
    [3, 1, 1, 1, COLOURS.beetle],
];

const LEGS_B: PixelRects = [
    [-3, -2, 1, 1, COLOURS.beetle],
    [3, -3, 1, 1, COLOURS.beetle],
    [-3, 1, 1, 1, COLOURS.beetle],
    [3, 0, 1, 1, COLOURS.beetle],
];

const EGG: PixelRects = [
    [-1, -4, 3, 1, COLOURS.egg],
    [-2, -3, 5, 5, COLOURS.egg],
    [-1, 2, 3, 1, COLOURS.egg],
    [-2, 1, 1, 1, COLOURS.woolShade],
];

const CRACK: PixelRects = [
    [-1, -2, 1, 1, COLOURS.post],
    [0, -1, 1, 1, COLOURS.post],
    [1, -2, 1, 1, COLOURS.post],
];

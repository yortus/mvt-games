import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { ShipModel } from '../models';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** The keys that mean "thrust", as `KeyboardEvent.key` names them. Add `'w'` to thrust with W too. */
const THRUST_KEYS: readonly string[] = ['ArrowUp', ' '];

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ShipViewBindings {
    readonly model: ShipModel;
    /** The size of the arena, in world units, which are this view's pixels. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The ship, with a flame beneath it while it thrusts, the ground, and a line
 * that shows `isThrusting`. This view also says what each control means:
 * the up arrow, the space bar, and a press anywhere on the arena all mean
 * "thrust", so each one sets the model's `isThrusting`.
 */
export function ShipView({ model, width, height }: ShipViewBindings): Container {
    const view = new Container();

    const ground = new Graphics().rect(0, GROUND_TOP, width, height - GROUND_TOP).fill(0x2b3a2e);

    const flame = new Graphics()
        .poly([-9, 16, 9, 16, 0, 44]).fill(0xffaa33)
        .poly([-5, 16, 5, 16, 0, 32]).fill(0xffee88);

    const body = new Graphics()
        .moveTo(-12, -20).lineTo(12, -20).lineTo(18, 10).lineTo(-18, 10).closePath().fill(0xc8d2e0)
        .circle(0, -6, 6).fill(0x2a6fdb)
        .rect(-10, 10, 20, 6).fill(0x8a96a8)
        .moveTo(-14, 10).lineTo(-22, 26).stroke({ color: 0x8a96a8, width: 3 })
        .moveTo(14, 10).lineTo(22, 26).stroke({ color: 0x8a96a8, width: 3 });

    const ship = new Container();
    ship.addChild(flame, body);

    const state = new Text({
        text: '',
        style: { fontFamily: 'monospace', fontSize: 18, fill: 0xe0e8f0 },
    });
    state.position.set(16, 14);

    const hint = new Text({
        text: 'Hold the up arrow or space, or press and hold, to thrust',
        style: { fontFamily: 'monospace', fontSize: 13, fill: 0x8899aa },
    });
    hint.anchor.set(0.5, 0.5);
    hint.position.set(width / 2, (GROUND_TOP + height) / 2);

    view.addChild(ground, ship, state, hint);

    // Whether each control is held. Either one means the player is thrusting.
    let isKeyHeld = false;
    let isPointerHeld = false;

    view.eventMode = 'static';
    view.hitArea = new Rectangle(0, 0, width, height);
    view.on('pointerdown', () => {
        isPointerHeld = true;
        model.isThrusting = isKeyHeld || isPointerHeld;
    });
    view.on('pointerup', onPointerLifted);
    view.on('pointerupoutside', onPointerLifted);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    view.on('destroyed', () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
    });

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        ship.position.set(model.x, model.y);
        flame.visible = model.isThrusting;
        state.text = model.isThrusting ? 'isThrusting: true' : 'isThrusting: false';
    }

    function onPointerLifted(): void {
        isPointerHeld = false;
        model.isThrusting = isKeyHeld || isPointerHeld;
    }

    function onKeyDown(e: KeyboardEvent): void {
        if (!THRUST_KEYS.includes(e.key)) return;
        // Stops the keys scrolling the page
        e.preventDefault();
        isKeyHeld = true;
        model.isThrusting = isKeyHeld || isPointerHeld;
    }

    function onKeyUp(e: KeyboardEvent): void {
        if (!THRUST_KEYS.includes(e.key)) return;
        isKeyHeld = false;
        model.isThrusting = isKeyHeld || isPointerHeld;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Where the ground's surface is drawn: just below the ship's feet when it stands on the model's ground. */
const GROUND_TOP = 326;

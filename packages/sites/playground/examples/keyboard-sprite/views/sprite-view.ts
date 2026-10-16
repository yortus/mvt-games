import { Container, Graphics, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { SpriteModel } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SpriteViewBindings {
    readonly model: SpriteModel;
    /** The size of the play area, in world units, which are this view's pixels. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The sprite, drawn as an arrow pointing the way it faces, and a hint
 * below it. The arrow keys steer the sprite.
 */
export function SpriteView({ model, width, height }: SpriteViewBindings): Container {
    const view = new Container();

    // Drawn once, pointing right. Each refresh moves and turns it.
    const arrow = new Graphics();
    arrow.moveTo(15, 0).lineTo(-10, -10).lineTo(-5, 0).lineTo(-10, 10).closePath();
    arrow.fill(0x44ffaa).stroke({ color: 0x22cc88, width: 2 });

    const hint = new Text({
        text: 'Use arrow keys to move (diagonals work!)',
        style: { fontFamily: 'monospace', fontSize: 12, fill: 0x666666 },
    });
    hint.anchor.set(0.5, 0.5);
    hint.position.set(width / 2, height - 20);
    view.addChild(arrow, hint);

    // Which arrow keys are down. The view turns them into a direction to
    // steer, so the model knows nothing about keys.
    const heldKeys = new Set<string>();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    view.on('destroyed', () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
    });

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        arrow.position.set(model.x, model.y);
        arrow.rotation = model.angle;
    }

    function onKeyDown(e: KeyboardEvent): void {
        if (!ARROW_KEYS.includes(e.key)) return;
        // Stops the arrow keys scrolling the page
        e.preventDefault();
        heldKeys.add(e.key);
        steer();
    }

    function onKeyUp(e: KeyboardEvent): void {
        if (heldKeys.delete(e.key)) steer();
    }

    function steer(): void {
        const dx = (heldKeys.has('ArrowRight') ? 1 : 0) - (heldKeys.has('ArrowLeft') ? 1 : 0);
        const dy = (heldKeys.has('ArrowDown') ? 1 : 0) - (heldKeys.has('ArrowUp') ? 1 : 0);
        model.steer(dx, dy);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const ARROW_KEYS: readonly string[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

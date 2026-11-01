import { Container, Graphics, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ShieldViewBindings {
    readonly isRaised: () => boolean;
    /** Which shield this is, shown above it. */
    readonly label: string;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A little ship, with a bubble around it while its shield is raised, and
 * words below it that say whether the shield is up. The view's origin is
 * the ship's centre.
 */
export function ShieldView(bindings: ShieldViewBindings): Container {
    const view = new Container();

    const ship = new Graphics()
        .ellipse(0, 0, 22, 14).fill(0xc8d2e0)
        .circle(6, -3, 6).fill(0x2a6fdb)
        .rect(-18, 10, 8, 6).fill(0x8a96a8)
        .rect(10, 10, 8, 6).fill(0x8a96a8);

    const bubble = new Graphics()
        .circle(0, 0, BUBBLE_RADIUS).fill({ color: 0x66ddff, alpha: 0.15 })
        .circle(0, 0, BUBBLE_RADIUS).stroke({ color: 0x66ddff, width: 3 });

    const label = new Text({
        text: bindings.label,
        style: { fontFamily: 'monospace', fontSize: 16, fill: 0xe0e8f0 },
    });
    label.anchor.set(0.5, 1);
    label.position.set(0, -BUBBLE_RADIUS - 14);

    const status = new Text({
        text: '',
        style: { fontFamily: 'monospace', fontSize: 15, fill: 0xffffff },
    });
    status.anchor.set(0.5, 0);
    status.position.set(0, BUBBLE_RADIUS + 14);

    view.addChild(bubble, ship, label, status);
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const isRaised = bindings.isRaised();
        bubble.visible = isRaised;
        status.text = isRaised ? 'shield up' : 'shield down';
        status.tint = isRaised ? 0x66ddff : 0xff8866;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BUBBLE_RADIUS = 44;

import { Container, Graphics, Text } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import type { PopupPhase } from '../models';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long the popup takes to bob up, down and back to the middle, in ms. */
const BOB_PERIOD_MS = 1000;
/** How far the popup bobs above and below where it rests, in pixels. */
const BOB_HEIGHT = 12;
/** How long one pulse of the glow takes, in ms. */
const PULSE_PERIOD_MS = 3000;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PopupViewBindings {
    readonly phase: () => PopupPhase;
    readonly progress: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A "stage clear" popup, which grows and fades in as it opens, and shrinks
 * and fades out as it closes. While it's open, it bobs up and down, and its
 * glow pulses. The model keeps no clock while the popup is open, so the
 * view keeps its own timer, as presentation state. The popup's middle is at
 * the view's origin, across, and BASE_Y down.
 */
export function PopupView(bindings: PopupViewBindings): Container {
    const view = new Container();

    const popup = new Container();
    const glow = new Graphics().roundRect(-170, -70, 340, 140, 30).fill(0x44ffaa);
    glow.alpha = 0.3;
    const panel = new Graphics().roundRect(-150, -50, 300, 100, 16).fill(0x1c2a3a).stroke({ color: 0x44ffaa, width: 3 });
    const title = new Text({ text: 'STAGE CLEAR!', style: { fontFamily: 'monospace', fontSize: 34, fontWeight: 'bold', fill: 0xffffff } });
    title.anchor.set(0.5, 0.5);
    popup.addChild(glow, panel, title);
    view.addChild(popup);

    // Presentation state: how long the popup has been bobbing
    let bobMs = 0;

    function update(deltaMs: number): void {
        const phase = bindings.phase();
        if (phase === 'open' || phase === 'closing') bobMs += deltaMs;
        else bobMs = 0;
    }

    function refresh(): void {
        const phase = bindings.phase();
        const progress = bindings.progress();
        const bob = Math.sin((bobMs / BOB_PERIOD_MS) * Math.PI * 2) * BOB_HEIGHT;

        popup.visible = phase !== 'closed';
        if (phase === 'opening') {
            popup.alpha = progress;
            popup.scale.set(0.5 + 0.5 * progress);
            popup.y = BASE_Y;
        }
        else if (phase === 'open') {
            popup.alpha = 1;
            popup.scale.set(1);
            popup.y = BASE_Y + bob;
            const pulse = Math.sin((bobMs / PULSE_PERIOD_MS) * Math.PI * 2);
            glow.alpha = 0.3 + 0.2 * pulse;
        }
        else if (phase === 'closing') {
            popup.alpha = 1 - progress;
            popup.scale.set(1 - 0.5 * progress);
            popup.y = BASE_Y + bob;
        }
    }

    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Where the popup's middle rests, below the view's origin. */
const BASE_Y = 130;

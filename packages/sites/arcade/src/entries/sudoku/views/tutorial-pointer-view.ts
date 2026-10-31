import { Container, Graphics } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import type { TutorialDemoKind } from '../models';
import { createTutorialPointerViewModel } from './tutorial-pointer-view-model';
import { ACCENT_COLOR, INK_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface TutorialPointerViewBindings {
    /** What the pointer shows how to do, on which cells, with which digits. */
    demo: () => TutorialDemoKind;
    demoCells: () => readonly number[];
    demoDigits: () => readonly number[];
    /** A count that rises each time the demo changes, which starts the pointer's show over. */
    demosShown: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * An arrow that shows the tutorial's demo, over and over: it comes in, taps,
 * drags or double-taps on the grid or the keypad, and goes. Each touch
 * sends out a ripple, and a drag leaves a trail. It takes no input, so the
 * player can follow along beneath it. It is laid out in the screen's
 * pixels.
 */
export function TutorialPointerView(bindings: TutorialPointerViewBindings): Container {
    const view = new Container();
    view.eventMode = 'none';
    const ripple = new Graphics().circle(0, 0, RIPPLE_RADIUS).stroke({ color: ACCENT_COLOR, width: 3 });
    // A bar one pixel long, stretched from where a drag began to the pointer
    const trail = new Graphics().rect(0, -TRAIL_WIDTH / 2, 1, TRAIL_WIDTH).fill({ color: ACCENT_COLOR, alpha: 0.3 });
    const shadow = drawArrow(new Graphics(), { color: INK_COLOR, alpha: 0.25 }, false);
    const arrow = drawArrow(new Graphics(), { color: ACCENT_COLOR, alpha: 1 }, true);
    const body = new Container();
    body.addChild(shadow, arrow);
    view.addChild(trail, ripple, body);

    // Presentation state: the show, and how far through it the pointer is
    const show = createTutorialPointerViewModel(bindings);

    setUpdate(view, show.update);
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        view.visible = show.alpha > 0 || show.rippleProgress < 1;
        body.position.set(show.x, show.y);
        body.alpha = show.alpha;
        body.scale.set(show.isDown ? ARROW_SCALE * PRESSED_SCALE : ARROW_SCALE);
        shadow.position.set(show.isDown ? 1 : SHADOW_OFFSET, show.isDown ? 1 : SHADOW_OFFSET);
        ripple.visible = show.rippleProgress < 1;
        ripple.position.set(show.touchX, show.touchY);
        ripple.scale.set(0.3 + show.rippleProgress);
        ripple.alpha = 1 - show.rippleProgress;
        const trailLength = Math.hypot(show.x - show.touchX, show.y - show.touchY);
        trail.visible = show.isDown && trailLength > 0;
        trail.position.set(show.touchX, show.touchY);
        trail.rotation = Math.atan2(show.y - show.touchY, show.x - show.touchX);
        trail.scale.x = trailLength;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The arrow is drawn small, and shown at this scale. */
const ARROW_SCALE = 1.3;
const PRESSED_SCALE = 0.88;
const SHADOW_OFFSET = 4;
const RIPPLE_RADIUS = 20;
const TRAIL_WIDTH = 14;

/** A small arrow, its tip at (0, 0), pointing up and to the left, in `fill`, outlined in white if `isOutlined`. */
function drawArrow(g: Graphics, fill: { color: number; alpha: number }, isOutlined: boolean): Graphics {
    g.poly([...ARROW_POINTS]).fill(fill);
    if (isOutlined) g.stroke({ color: 0xffffff, width: 2.5, join: 'round' });
    return g;
}

/** The arrow's corners: down its left side, out to the tail and back, and up to the tip again. */
const ARROW_POINTS: readonly number[] = [0, 0, 0, 25, 6.5, 19.5, 11, 29, 15.5, 27, 11, 17.5, 19, 17.5];

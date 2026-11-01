import { Container, Graphics, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** How fast time runs for the model: at its usual speed, slowed down, or stopped. */
export type TimeSpeed = 'normal' | 'slow' | 'paused';

export interface TimeControlsViewBindings {
    /** The speed chosen now, which the view lights up. */
    readonly speed: () => TimeSpeed;
    /** Called when the player clicks a speed's button. */
    readonly onSpeedClicked?: (speed: TimeSpeed) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A heading and three buttons, one for each speed, stacked in a column
 * BUTTON_WIDTH wide. The view only reports which button was clicked.
 * Whoever wired it decides what that does to time.
 */
export function TimeControlsView(bindings: TimeControlsViewBindings): Container {
    const view = new Container();
    const heading = new Text({ text: "the model's time", style: { fontFamily: 'monospace', fontSize: 14, fill: 0x8899bb } });
    view.addChild(heading);

    // Drawn white once, and tinted to show which speed is chosen
    const backgrounds: Graphics[] = [];
    for (let i = 0; i < SPEEDS.length; i++) {
        const y = 28 + i * (BUTTON_HEIGHT + 10);
        const background = new Graphics().roundRect(0, y, BUTTON_WIDTH, BUTTON_HEIGHT, 6).fill(0xffffff);
        background.eventMode = 'static';
        background.cursor = 'pointer';
        background.on('pointertap', () => bindings.onSpeedClicked?.(SPEEDS[i]));
        const label = new Text({ text: LABELS[i], style: { fontFamily: 'monospace', fontSize: 14, fill: 0xffffff } });
        label.anchor.set(0.5, 0.5);
        label.position.set(BUTTON_WIDTH / 2, y + BUTTON_HEIGHT / 2);
        view.addChild(background, label);
        backgrounds.push(background);
    }

    function refresh(): void {
        const speed = bindings.speed();
        for (let i = 0; i < SPEEDS.length; i++) {
            backgrounds[i].tint = SPEEDS[i] === speed ? 0x2f6f5a : 0x262c3a;
        }
    }

    setRefresh(view, refresh);
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SPEEDS: readonly TimeSpeed[] = ['normal', 'slow', 'paused'];
const LABELS: readonly string[] = ['normal', 'slow motion', 'paused'];
const BUTTON_WIDTH = 130;
const BUTTON_HEIGHT = 34;

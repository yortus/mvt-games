import { Container, Graphics, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface StepPickerViewBindings {
    /** The step sizes to offer, in ms, one button each. Read once. */
    readonly steps: readonly number[];
    /** The step size picked now, in ms, which the view lights up. */
    readonly stepMs: () => number;
    /** Called when the player picks a step size, in ms. */
    readonly onStepPicked: (stepMs: number) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A row of buttons, one for each step size, with the one picked lit up.
 * The view only reports which button was pressed. Whoever wired it decides
 * what that does to time. The view's origin is the middle of its top edge.
 */
export function StepPickerView(bindings: StepPickerViewBindings): Container {
    const { steps } = bindings;
    const view = new Container();
    const left = -(HEADING_WIDTH + steps.length * BUTTON_WIDTH + (steps.length - 1) * GAP) / 2;
    const heading = new Text({
        text: 'step',
        style: { fontFamily: 'monospace', fontSize: 16, fill: 0x8899aa },
    });
    heading.anchor.set(0, 0.5);
    heading.position.set(left, BUTTON_HEIGHT / 2);
    view.addChild(heading);

    // Drawn white once, and tinted to show which step size is picked
    const backs: Graphics[] = [];
    for (let i = 0; i < steps.length; i++) {
        const x = left + HEADING_WIDTH + i * (BUTTON_WIDTH + GAP);
        const back = new Graphics().roundRect(x, 0, BUTTON_WIDTH, BUTTON_HEIGHT, 6).fill(0xffffff);
        back.eventMode = 'static';
        back.cursor = 'pointer';
        back.on('pointerdown', () => bindings.onStepPicked(steps[i]));
        const label = new Text({
            text: `${steps[i]} ms`,
            style: { fontFamily: 'monospace', fontSize: 15, fill: 0xe0e8f0 },
        });
        label.anchor.set(0.5, 0.5);
        label.position.set(x + BUTTON_WIDTH / 2, BUTTON_HEIGHT / 2);
        backs.push(back);
        view.addChild(back, label);
    }

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const stepMs = bindings.stepMs();
        for (let i = 0; i < steps.length; i++) {
            backs[i].tint = steps[i] === stepMs ? 0x2a6fdb : 0x24344d;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Room for the heading, to the left of the buttons, in pixels. */
const HEADING_WIDTH = 60;
const BUTTON_WIDTH = 100;
const BUTTON_HEIGHT = 34;
const GAP = 10;

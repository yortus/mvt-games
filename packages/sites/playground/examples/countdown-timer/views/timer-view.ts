import { Container, Graphics, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { memoiseLast } from '@mvtjs/utils';
import type { TimerModel } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface TimerViewBindings {
    readonly model: TimerModel;
    /** The width of the play area, in pixels. The view is centred in it. */
    readonly width: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The time left, in seconds, and a bar that fills as time passes. Both
 * turn from green to red as time runs out, and a message shows when it has.
 */
export function TimerView({ model, width }: TimerViewBindings): Container {
    const view = new Container();
    const barWidth = width - 2 * BAR_X;

    const barBack = new Graphics();
    barBack.roundRect(BAR_X, BAR_Y, barWidth, BAR_HEIGHT, BAR_CORNER).fill(0x333333);
    const barFill = new Graphics();

    const timeText = new Text({
        text: '',
        style: { fontFamily: 'monospace', fontSize: 40, fill: 0xffffff, fontWeight: 'bold' },
    });
    timeText.anchor.set(0.5, 0.5);
    timeText.position.set(width / 2, 55);

    const statusText = new Text({
        text: 'TIME UP!',
        style: { fontFamily: 'monospace', fontSize: 16, fill: 0xff4444 },
    });
    statusText.anchor.set(0.5, 0.5);
    statusText.position.set(width / 2, 155);

    view.addChild(barBack, barFill, timeText, statusText);

    // The text is made again only when the tenths of a second change, not every frame
    const timeLabel = memoiseLast((tenths: number) => (tenths / 10).toFixed(1));
    // Changing a Text's colour draws it again, so it is changed only when it differs
    let textColor = -1;

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        timeText.text = timeLabel(Math.round(model.remainingMs / 100));

        // Green at the start, red at the end
        const progress = model.progress;
        const red = Math.floor(255 * progress);
        const green = Math.floor(255 * (1 - progress));
        const color = (red << 16) | (green << 8) | 0x22;
        if (color !== textColor) {
            textColor = color;
            timeText.style.fill = color;
        }

        barFill.clear();
        const fillWidth = barWidth * progress;
        if (fillWidth > 0) barFill.roundRect(BAR_X, BAR_Y, fillWidth, BAR_HEIGHT, BAR_CORNER).fill(color);

        statusText.visible = model.phase === 'done';
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The bar's left edge, which is also its gap from the right edge. */
const BAR_X = 30;
const BAR_Y = 100;
const BAR_HEIGHT = 24;
const BAR_CORNER = 6;

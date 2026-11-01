import { Container, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createComputed } from '@mvtjs/utils';
import type { StopwatchModel } from '../models';
import { ButtonView } from './button-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface StopwatchViewBindings {
    readonly model: StopwatchModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The stopwatch's time, and two buttons. Both are the same ButtonView. The
 * wiring here gives each one its label, says when it's enabled, and decides
 * what its click means.
 */
export function StopwatchView({ model }: StopwatchViewBindings): Container {
    const view = new Container();

    const time = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 64, fill: 0xffffff } });
    time.anchor.set(0.5, 0.5);
    time.position.set(320, 110);

    const startStop = ButtonView({
        label: () => (model.isRunning ? 'Stop' : 'Start'),
        isEnabled: () => true,
        onClicked: () => (model.isRunning ? model.stop() : model.start()),
    });
    startStop.position.set(160, 200);

    const reset = ButtonView({
        label: () => 'Reset',
        isEnabled: () => !model.isRunning && model.elapsedMs > 0,
        onClicked: () => model.reset(),
    });
    reset.position.set(340, 200);

    view.addChild(time, startStop, reset);

    // The text is made again only when the tenths change
    const timeText = createComputed({ watch: () => Math.floor(model.elapsedMs / 100), compute: formatTenths });

    function refresh(): void {
        time.text = timeText();
    }

    setRefresh(view, refresh);
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Formats a count of tenths of a second as seconds, such as 12.3. */
function formatTenths(tenths: number): string {
    return (tenths / 10).toFixed(1);
}

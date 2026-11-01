import { Container, Text } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { createComputed } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ClockViewBindings {
    /** What the clock measures, shown before the time. */
    readonly label: string;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A clock that counts the time this view's update step is given, in
 * seconds. It shows whose time a part of the stage gets: the same view
 * counts the game's time in the game's layer, and real time in the menu's.
 */
export function ClockView(bindings: ClockViewBindings): Container {
    const view = new Container();
    const text = new Text({
        text: '',
        style: { fontFamily: 'monospace', fontSize: 16, fill: 0xe0e8f0 },
    });
    view.addChild(text);

    // Presentation state: the time counted so far
    let elapsedMs = 0;

    // The text is made again only when the tenths of a second change
    const label = createComputed({
        watch: () => Math.floor(elapsedMs / 100),
        compute: (tenths) => `${bindings.label} ${(tenths / 10).toFixed(1)} s`,
    });

    setUpdate(view, (deltaMs) => {
        elapsedMs += deltaMs;
    });
    setRefresh(view, () => {
        text.text = label();
    });
    return view;
}

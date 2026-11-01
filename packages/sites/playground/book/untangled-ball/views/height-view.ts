import { Container, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createComputed } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HeightViewBindings {
    /** How high the ball is above the floor, in world units. */
    readonly height: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The ball's height, as a number. It reads the same model as the ball's own view. */
export function HeightView(bindings: HeightViewBindings): Container {
    const view = new Container();
    const text = new Text({
        text: '',
        style: { fontFamily: 'monospace', fontSize: 16, fill: 0xe0e8f0 },
    });
    view.addChild(text);

    // The text is made again only when the whole number changes, not every frame
    const label = createComputed({ watch: () => Math.round(bindings.height()), compute: formatHeight });

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        text.text = label();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function formatHeight(height: number): string {
    return `height: ${height}`;
}

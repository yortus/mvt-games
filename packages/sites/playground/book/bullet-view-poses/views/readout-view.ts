import { Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createComputed } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ReadoutViewBindings {
    /** What the value is called in the test, such as `view.visible`. */
    readonly name: string;
    readonly value: () => boolean | number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A line that reads `name is value`. Its text is made again only when the value changes. */
export function ReadoutView({ name, value }: ReadoutViewBindings): Text {
    const view = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 11, fill: 0xffcc66 } });
    const label = createComputed({ watch: value, compute: (v) => `${name} is ${String(v)}` });

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        view.text = label();
    }
}

// The views that the speed benchmark draws, both ways. Each is a panel such
// as a game's HUD might have: a rounded box, a title, a meter and a row of
// lights, coloured and sized by its index, so that no two images are alike.

import { Container, Graphics, Text } from 'pixi.js';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PanelViewBindings {
    /** Which panel this is. It sets the panel's size, colours, title and meter. */
    readonly index: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** Returns a panel's view, drawn at its size, from its top-left corner. */
export function PanelView(bindings: PanelViewBindings): Container {
    const { index } = bindings;
    const { width, height } = measurePanel(index);
    const hue = (index * 47) % 360;
    const view = new Container();

    const box = new Graphics()
        .roundRect(4, 4, width - 8, height - 8, 12)
        .fill(toColour(hue, 0.35, 0.22))
        .stroke({ color: toColour(hue, 0.6, 0.6), width: 3 });
    view.addChild(box);

    const title = new Text({
        text: `Panel ${index}`,
        style: { fontFamily: 'Arial', fontSize: 18, fontWeight: 'bold', fill: 0xffffff },
    });
    title.position.set(16, 12);
    view.addChild(title);

    const meterWidth = width - 32;
    const fraction = ((index * 37) % 100) / 100;
    const meter = new Graphics()
        .roundRect(16, 44, meterWidth, 14, 7)
        .fill(0x101014)
        .roundRect(16, 44, Math.max(14, meterWidth * fraction), 14, 7)
        .fill(toColour((hue + 120) % 360, 0.7, 0.55));
    view.addChild(meter);

    const lights = new Graphics();
    const count = Math.floor((width - 32) / 24);
    for (let i = 0; i < count; i++) {
        const isOn = ((index >> (i % 8)) & 1) === 1;
        lights.circle(28 + i * 24, height - 24, 8).fill(isOn ? toColour((hue + 200) % 360, 0.9, 0.6) : 0x303038);
    }
    view.addChild(lights);

    return view;
}

/** Returns a panel's size in pixels. Sizes vary, as a project's views do. */
export function measurePanel(index: number): { readonly width: number; readonly height: number } {
    return { width: 160 + (index % 5) * 60, height: 100 + (index % 3) * 40 };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Returns an RGB colour as a number, from a hue in degrees and a saturation and lightness from 0 to 1. */
function toColour(hue: number, saturation: number, lightness: number): number {
    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const toChannel = (n: number): number => {
        const k = (n + hue / 30) % 12;
        const value = lightness - chroma / 2 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        return Math.round(value * 255);
    };
    return (toChannel(0) << 16) | (toChannel(8) << 8) | toChannel(4);
}

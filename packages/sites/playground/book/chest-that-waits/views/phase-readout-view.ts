import { Container, Graphics, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createComputed } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PhaseReadoutViewBindings<P extends string> {
    /** Every phase, in the order they run. Read once. */
    readonly phases: readonly P[];
    readonly phase: () => P;
    /** How far through the phase, from 0 to 1. */
    readonly progress: () => number;
    /** The readout's width, in pixels. */
    readonly width: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * What the model gives its views, shown as it is: a row of phases with the
 * current one lit, and a bar and a number for the progress through it.
 */
export function PhaseReadoutView<P extends string>(bindings: PhaseReadoutViewBindings<P>): Container {
    const { phases, width } = bindings;
    const view = new Container();

    // One box for each phase, drawn white and tinted each refresh
    const boxWidth = (width - GAP * (phases.length - 1)) / phases.length;
    const boxes: Graphics[] = [];
    const names: Text[] = [];
    for (let i = 0; i < phases.length; i++) {
        const x = i * (boxWidth + GAP);
        const box = new Graphics().roundRect(x, 0, boxWidth, BOX_HEIGHT, 6).fill(0xffffff);
        const name = new Text({
            text: phases[i],
            style: { fontFamily: 'monospace', fontSize: 15, fill: 0xffffff },
        });
        name.anchor.set(0.5, 0.5);
        name.position.set(x + boxWidth / 2, BOX_HEIGHT / 2);
        boxes.push(box);
        names.push(name);
        view.addChild(box, name);
    }

    const barY = BOX_HEIGHT + 14;
    const barBack = new Graphics().roundRect(0, barY, width, BAR_HEIGHT, 4).fill(0x26324a);
    // Drawn at full width, and scaled to the progress
    const barFill = new Graphics().roundRect(0, 0, width, BAR_HEIGHT, 4).fill(0x66ddff);
    barFill.position.set(0, barY);

    const progressText = new Text({
        text: '',
        style: { fontFamily: 'monospace', fontSize: 16, fill: 0xe0e8f0 },
    });
    progressText.position.set(0, barY + BAR_HEIGHT + 8);
    view.addChild(barBack, barFill, progressText);

    // The text is made again only when a hundredth changes, not every frame
    const progressLabel = createComputed({ watch: () => Math.round(bindings.progress() * 100), compute: formatProgress });

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const phase = bindings.phase();
        for (let i = 0; i < phases.length; i++) {
            const isCurrent = phases[i] === phase;
            boxes[i].tint = isCurrent ? 0x2a6fdb : 0x1a2436;
            names[i].tint = isCurrent ? 0xffffff : 0x6b7a90;
        }
        barFill.scale.x = bindings.progress();
        progressText.text = progressLabel();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const GAP = 8;
const BOX_HEIGHT = 32;
const BAR_HEIGHT = 10;

/** Hundredths as a progress, such as `progress 0.47`. */
function formatProgress(hundredths: number): string {
    return `progress ${(hundredths / 100).toFixed(2)}`;
}

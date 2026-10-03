import { Container, Graphics, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** Bindings for a togglable checkbox control. */
export interface CheckboxViewBindings {
    /** Display label shown next to the checkbox. */
    label: () => string;
    /** Whether the checkbox is currently checked. */
    isChecked: () => boolean;
    /** Called when the user clicks the checkbox. */
    onToggled?: (isChecked: boolean) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A checkbox with a label beside it. */
export function CheckboxView(bindings: CheckboxViewBindings): Container {
    const view = new Container();
    view.label = 'checkbox';

    // Persistent invisible hit area so clicks always register
    const hitArea = new Graphics();
    hitArea.rect(0, 0, HIT_WIDTH, BOX_SIZE);
    hitArea.fill({ color: 0x000000, alpha: 0.001 });
    hitArea.eventMode = 'static';
    hitArea.cursor = 'pointer';

    const box = new Graphics();
    const label = new Text({ text: '', resolution: TEXT_RESOLUTION, style: { fontFamily: 'monospace', fontSize: LABEL_SIZE, fill: 0xdddddd } });

    view.addChild(hitArea, box, label);

    let prevIsChecked: boolean | undefined;
    let prevLabel: string | undefined;

    hitArea.on('pointerdown', () => {
        bindings.onToggled?.(!bindings.isChecked());
    });

    setRefresh(view, refresh);
    return view;

    // ---- Refresh -----------------------------------------------------------

    function refresh(): void {
        const isChecked = bindings.isChecked();
        const labelText = bindings.label();

        if (isChecked === prevIsChecked && labelText === prevLabel) return;
        prevIsChecked = isChecked;
        prevLabel = labelText;

        box.clear();
        box.roundRect(0, 0, BOX_SIZE, BOX_SIZE, 2)
            .stroke({ color: 0x888888, width: 1.5 });

        if (isChecked) {
            box.roundRect(2, 2, BOX_SIZE - 4, BOX_SIZE - 4, 1)
                .fill({ color: 0x6688cc });
        }

        label.text = labelText;
        label.position.set(BOX_SIZE + BOX_LABEL_GAP, (BOX_SIZE - LABEL_SIZE) / 2);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TEXT_RESOLUTION = (typeof globalThis !== 'undefined' && 'devicePixelRatio' in globalThis)
    ? globalThis.devicePixelRatio
    : 1;

const BOX_SIZE = 16;
const BOX_LABEL_GAP = 8;
const HIT_WIDTH = 200;
const LABEL_SIZE = 12;

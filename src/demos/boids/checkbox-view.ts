import { Container, Graphics, Text } from 'pixi.js';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CheckboxViewBindings {
    getLabel(): string;
    getIsChecked(): boolean;
    onToggled?(isChecked: boolean): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCheckboxView(bindings: CheckboxViewBindings): Container {
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
        bindings.onToggled?.(!bindings.getIsChecked());
    });

    view.onRender = refresh;
    return view;

    // ---- Refresh -----------------------------------------------------------

    function refresh(): void {
        const isChecked = bindings.getIsChecked();
        const labelText = bindings.getLabel();

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

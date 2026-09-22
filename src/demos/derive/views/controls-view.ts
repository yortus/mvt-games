import { Container } from 'pixi.js';
import { createButtonView } from './button-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ControlsViewBindings {
    onSpawn(): void;
    onRemove(): void;
    onRetype(): void;
    onMove(): void;
    onToggleActive(): void;
    getAutoChurn(): boolean;
    onToggleChurn(): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ControlsViewOptions extends ControlsViewBindings {
    width: number;
    height: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createControlsView(options: ControlsViewOptions): Container {
    const { width, height, onSpawn, onRemove, onRetype, onMove, onToggleActive, getAutoChurn, onToggleChurn } = options;

    const view = new Container();

    const specs: { getLabel: () => string; onPress: () => void; getActive?: () => boolean }[] = [
        { getLabel: () => 'Spawn', onPress: onSpawn },
        { getLabel: () => 'Remove', onPress: onRemove },
        { getLabel: () => 'Retype', onPress: onRetype },
        { getLabel: () => 'Move', onPress: onMove },
        { getLabel: () => 'Toggle active', onPress: onToggleActive },
        { getLabel: () => (getAutoChurn() ? 'Churn: on' : 'Churn: off'), onPress: onToggleChurn, getActive: getAutoChurn },
    ];

    const gap = 8;
    const buttonH = Math.min(34, height);
    const buttonW = (width - gap * (specs.length - 1)) / specs.length;
    const y = (height - buttonH) / 2;

    for (let i = 0; i < specs.length; i++) {
        const button = createButtonView({
            width: buttonW,
            height: buttonH,
            getLabel: specs[i].getLabel,
            onPress: specs[i].onPress,
            getActive: specs[i].getActive,
        });
        button.position.set(i * (buttonW + gap), y);
        view.addChild(button);
    }

    return view;
}

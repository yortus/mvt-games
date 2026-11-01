import { Container, Graphics, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { LiftModel } from '../models';
import { DialView } from './dial-view';
import { PanelView } from './panel-view';
import { ShaftView } from './shaft-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface LiftWindowsViewBindings {
    readonly model: LiftModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Three windows onto one lift: the shaft, a dial and a panel. Press 1, 2 or
 * 3, or click a window's button, to close it or open it again. A closed
 * window's view is destroyed, and an opened one is made afresh, and shows
 * where the lift is on its first refresh.
 */
export function LiftWindowsView({ model }: LiftWindowsViewBindings): Container {
    const view = new Container();

    // Which windows are open. Nothing in the lift depends on it, so it's the view's to keep.
    const isOpen = [true, true, true];
    const shown: (Container | undefined)[] = [undefined, undefined, undefined];

    const slots: Container[] = [];
    const closedNotes: Text[] = [];
    const buttons: Graphics[] = [];
    for (let i = 0; i < WINDOWS.length; i++) {
        const x = MARGIN + i * (SLOT_WIDTH + GAP);

        const frame = new Graphics().roundRect(x, MARGIN, SLOT_WIDTH, SLOT_HEIGHT, 8).stroke({ color: 0x2a3348, width: 2 });
        const closedNote = makeText('closed', x + SLOT_WIDTH / 2, MARGIN + SLOT_HEIGHT / 2, 0x55607a);
        const slot = new Container();
        slot.position.set(x + (SLOT_WIDTH - 180) / 2, MARGIN + 6);

        // Drawn white once, and tinted to show whether its window is open
        const button = new Graphics().roundRect(x, BUTTON_Y, SLOT_WIDTH, 30, 6).fill(0xffffff);
        button.eventMode = 'static';
        button.cursor = 'pointer';
        button.on('pointertap', () => toggle(i));
        const label = makeText(`${i + 1}  ${WINDOWS[i]}`, x + SLOT_WIDTH / 2, BUTTON_Y + 15, 0xffffff);

        view.addChild(frame, closedNote, slot, button, label);
        slots.push(slot);
        closedNotes.push(closedNote);
        buttons.push(button);
    }

    window.addEventListener('keydown', onKeyDown);
    view.on('destroyed', () => window.removeEventListener('keydown', onKeyDown));

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        for (let i = 0; i < WINDOWS.length; i++) {
            // Opening and closing a window adds or removes a view, which is output, so it happens here
            const current = shown[i];
            if (isOpen[i] && current === undefined) {
                const made = makeWindow(i);
                slots[i].addChild(made);
                shown[i] = made;
            }
            else if (!isOpen[i] && current !== undefined) {
                current.destroy({ children: true });
                shown[i] = undefined;
            }
            closedNotes[i].visible = !isOpen[i];
            buttons[i].tint = isOpen[i] ? 0x2f6f5a : 0x2a3348;
        }
    }

    function makeWindow(index: number): Container {
        if (index === 0) {
            return ShaftView({
                floor: () => model.floor,
                areDoorsOpen: () => model.phase === 'waiting',
                floorCount: model.floorCount,
            });
        }
        if (index === 1) return DialView({ floor: () => model.floor, floorCount: model.floorCount });
        return PanelView({ floor: () => model.floor, direction: () => model.direction });
    }

    function toggle(index: number): void {
        isOpen[index] = !isOpen[index];
    }

    function onKeyDown(e: KeyboardEvent): void {
        const index = KEYS.indexOf(e.key);
        if (index >= 0) toggle(index);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const WINDOWS: readonly string[] = ['Shaft', 'Dial', 'Panel'];
const KEYS: readonly string[] = ['1', '2', '3'];
const MARGIN = 16;
const GAP = 16;
const SLOT_WIDTH = 192;
const SLOT_HEIGHT = 232;
const BUTTON_Y = MARGIN + SLOT_HEIGHT + 14;

function makeText(text: string, x: number, y: number, fill: number): Text {
    const label = new Text({ text, style: { fontFamily: 'monospace', fontSize: 14, fill } });
    label.anchor.set(0.5, 0.5);
    label.position.set(x, y);
    return label;
}

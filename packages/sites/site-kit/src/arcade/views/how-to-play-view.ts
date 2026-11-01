import { setRefresh } from '@mvtjs/html';
import type { DeviceKind } from '../../device';
import type { ControlButton, ControlGesture, ControlInput, ControlKey, ControlRow, HowToPlay } from '../../entry-types';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HowToPlayViewBindings {
    /** How to play the entry shown, or undefined for none. */
    readonly howToPlay: () => HowToPlay | undefined;
    /** The kind of device the page is on, whose controls it shows. Read once. */
    readonly deviceKind: DeviceKind;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Shows how to play an entry: what to aim for, then its controls as a table,
 * then anything else worth knowing. The table has a row for each action,
 * with its keys in one column, as key caps, and its gestures and on-screen
 * buttons in the next, each with an icon. It shows only the controls the
 * device has: the keyboard and the mouse on a desktop, touch on a phone or a
 * tablet, and all of them on a laptop with a touch screen. A row, or a
 * column, shows only where it has something in it.
 *
 * It builds its content as the entry shown changes, and only then.
 */
export function HowToPlayView(bindings: HowToPlayViewBindings): HTMLElement {
    const { deviceKind } = bindings;
    const root = document.createElement('div');
    root.className = 'how-to-play';
    let shown: HowToPlay | undefined;
    setRefresh(root, refresh);
    return root;

    function refresh(): void {
        const howToPlay = bindings.howToPlay();
        if (howToPlay === shown) return;
        shown = howToPlay;
        root.replaceChildren(...(howToPlay === undefined ? [] : contentOf(howToPlay, deviceKind)));
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The intro, the table of controls and the notes, each where there is one. */
function contentOf(howToPlay: HowToPlay, deviceKind: DeviceKind): HTMLElement[] {
    const content: HTMLElement[] = [];
    if (howToPlay.intro !== undefined) content.push(element('p', 'how-intro', howToPlay.intro));
    const rows = rowsShownOn(howToPlay.controls ?? [], deviceKind);
    if (rows.length > 0) content.push(controlsTable(rows, deviceKind));
    for (const note of howToPlay.notes ?? []) content.push(element('p', 'how-note', note));
    return content;
}

/** A row as the device shows it: its keys, its gestures and buttons, and its notes. */
interface ShownRow {
    readonly action: string;
    readonly keys: readonly ControlInput[];
    readonly pointer: readonly ControlInput[];
    readonly notes: readonly string[];
}

/** The rows with something to show on the device, with only the inputs and notes it has. */
function rowsShownOn(rows: readonly ControlRow[], deviceKind: DeviceKind): ShownRow[] {
    const hasKeyboard = deviceKind !== 'handheld';
    const hasMouse = deviceKind !== 'handheld';
    const hasTouch = deviceKind !== 'desktop';
    const shown: ShownRow[] = [];
    for (const row of rows) {
        const inputs = row.inputs ?? [];
        const keys = hasKeyboard ? inputs.filter(isKeyInput) : [];
        const pointer = inputs.filter((input) => !isKeyInput(input) && (hasMouse || !isMouseOnly(input)));
        if (hasTouch) pointer.push(...(row.touchInputs ?? []));
        const touchNote = hasTouch ? row.touchNote : undefined;
        if (keys.length === 0 && pointer.length === 0 && touchNote === undefined) continue;
        const notes: string[] = [];
        if (row.note !== undefined) notes.push(row.note);
        if (touchNote !== undefined) notes.push(touchNote);
        shown.push({ action: row.action, keys, pointer, notes });
    }
    return shown;
}

/** A table of the controls: the action, then its keys, then its gestures and buttons. */
function controlsTable(rows: readonly ShownRow[], deviceKind: DeviceKind): HTMLElement {
    const hasKeys = rows.some((row) => row.keys.length > 0);
    const hasPointer = rows.some((row) => row.pointer.length > 0);
    const needsMouse = rows.some((row) => row.pointer.some(isMouseOnly));

    const table = element('table', hasKeys && hasPointer ? 'how-controls' : 'how-controls how-controls-single');
    const head = element('thead');
    const headRow = element('tr');
    const corner = element('td');
    headRow.append(corner);
    if (hasKeys) headRow.append(headerCell('Keyboard'));
    if (hasPointer) headRow.append(headerCell(pointerHeading(deviceKind, needsMouse)));
    head.append(headRow);

    const body = element('tbody');
    for (const row of rows) {
        const tr = element('tr');
        const action = element('th');
        action.scope = 'row';
        action.append(element('span', 'how-action', row.action));
        for (const note of row.notes) action.append(element('span', 'how-action-note', note));
        tr.append(action);
        if (hasKeys) tr.append(inputsCell(row.keys));
        if (hasPointer) tr.append(inputsCell(row.pointer));
        body.append(tr);
    }
    table.append(head, body);
    return table;
}

/** The heading of the column of gestures and buttons: for the mouse, for touch, or for both where a row needs a mouse. */
function pointerHeading(deviceKind: DeviceKind, needsMouse: boolean): string {
    if (deviceKind === 'desktop') return 'Mouse';
    if (deviceKind === 'handheld') return 'Touch';
    return needsMouse ? 'Mouse / touch' : 'Touch';
}

function headerCell(text: string): HTMLElement {
    const cell = element('th', undefined, text);
    cell.scope = 'col';
    return cell;
}

/** A cell of inputs, any one of which does the action, with "or" between them. */
function inputsCell(inputs: readonly ControlInput[]): HTMLElement {
    const cell = element('td');
    const list = element('span', 'how-inputs');
    for (let i = 0; i < inputs.length; i++) {
        if (i > 0) list.append(element('span', 'how-or', 'or'));
        list.append(inputView(inputs[i]));
    }
    cell.append(list);
    return cell;
}

/** One input: key caps, keys (or a button and keys) pressed together with "+" between, a gesture with its icon, or an on-screen button. */
function inputView(input: ControlInput): HTMLElement {
    if (typeof input === 'string') return isKey(input) ? keyView(input) : gestureView(input);
    if ('button' in input) return buttonView(input);
    const combo = element('span', 'how-combo');
    for (let i = 0; i < input.length; i++) {
        if (i > 0) combo.append(element('span', 'how-plus', '+'));
        const part = input[i];
        combo.append(typeof part === 'string' ? keyView(part) : buttonView(part));
    }
    return combo;
}

/** An on-screen button, by its label, named for assistive technology. */
function buttonView(input: ControlButton): HTMLElement {
    const button = element('span', 'how-button', input.button);
    button.setAttribute('aria-label', `the ${input.button} button`);
    return button;
}

/** A key, or a set of keys, as key caps, named for assistive technology. */
function keyView(key: ControlKey): HTMLElement {
    const { caps, name } = KEYS[key];
    const group = element('span', 'how-keys');
    group.setAttribute('aria-label', name);
    for (const cap of caps) {
        const kbd = element('kbd', undefined, cap);
        kbd.setAttribute('aria-hidden', 'true');
        group.append(kbd);
    }
    return group;
}

/** A gesture, as its icon and its name. */
function gestureView(gesture: ControlGesture): HTMLElement {
    const chip = element('span', `how-gesture how-gesture-${gesture}`);
    chip.append(element('span', 'how-gesture-name', GESTURES[gesture]));
    return chip;
}

/** Whether an input is for the keyboard: a key, or keys pressed together with no button among them. */
function isKeyInput(input: ControlInput): boolean {
    if (typeof input === 'string') return isKey(input);
    if ('button' in input) return false;
    return input.every((part) => typeof part === 'string');
}

/** Whether an input needs a mouse: a click, or the wheel. */
function isMouseOnly(input: ControlInput): boolean {
    return input === 'click' || input === 'wheel';
}

function isKey(input: string): input is ControlKey {
    return input in KEYS;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    if (className !== undefined) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
}

/** An arrow as text, not an emoji. */
const textArrow = (arrow: string): string => `${arrow}︎`;
const LEFT = textArrow('←');
const UP = textArrow('↑');
const RIGHT = textArrow('→');
const DOWN = textArrow('↓');

/** Each key's caps, and its name for assistive technology. */
const KEYS: Readonly<Record<ControlKey, { readonly caps: readonly string[]; readonly name: string }>> = {
    'arrows': { caps: [LEFT, UP, DOWN, RIGHT], name: 'the arrow keys' },
    'wasd': { caps: ['W', 'A', 'S', 'D'], name: 'W A S D' },
    'left-right': { caps: [LEFT, RIGHT], name: 'Left and Right' },
    'a-d': { caps: ['A', 'D'], name: 'A and D' },
    'up-down': { caps: [UP, DOWN], name: 'Up and Down' },
    'up': { caps: [UP], name: 'Up' },
    'down': { caps: [DOWN], name: 'Down' },
    'left': { caps: [LEFT], name: 'Left' },
    'right': { caps: [RIGHT], name: 'Right' },
    'forward': { caps: ['Fwd'], name: 'Forward, toward the opponent' },
    'back': { caps: ['Back'], name: 'Back, away from the opponent' },
    'w': { caps: ['W'], name: 'W' },
    'space': { caps: ['Space'], name: 'Space' },
    'shift': { caps: ['Shift'], name: 'Shift' },
    'enter': { caps: ['Enter'], name: 'Enter' },
};

/** Each gesture's name, shown beside its icon. */
const GESTURES: Readonly<Record<ControlGesture, string>> = {
    'joystick': 'Joystick',
    'swipe': 'Swipe',
    'tap': 'Tap',
    'double-tap': 'Double tap',
    'hold': 'Hold',
    'drag': 'Drag',
    'pinch': 'Pinch',
    'click': 'Click',
    'wheel': 'Wheel',
};

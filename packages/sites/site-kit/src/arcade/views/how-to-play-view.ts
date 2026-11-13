import { setRefresh } from '@mvtjs/html';
import type { DeviceKind } from '../../device';
import type { ArcadeControlInput, ControlButton, ControlGesture, ControlInput, ControlKey, ControlRow, HowToPlay } from '../../entry-types';
import { ARCADE_CONTROL_KEYS, type ArcadeControl, describeKey } from '../../input';

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
 * Shows how to play an entry. It shows what to aim for, then the controls as
 * a table, then anything else worth knowing. The table has a row for each
 * action. Its keys are in one column, as key caps. Its gestures and
 * on-screen buttons are in the next, each with an icon. An arcade control
 * shows as the keys that the arcade controls' table has for it.
 *
 * It shows only the controls the device has. A desktop shows the keyboard
 * and the mouse, and a phone or tablet shows touch. A laptop with a touch
 * screen shows all of them. A row, or a column, shows only where it has
 * something in it.
 *
 * It builds its content when the entry shown changes, and only then.
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

/** A row as the device shows it. It has its keys, its gestures and buttons, and its notes. */
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

/** Returns a table of the controls. Each row has the action, then its keys, then its gestures and buttons. */
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

/**
 * Returns the heading of the column of gestures and buttons. It names the
 * mouse or touch. It names both where a row needs a mouse on a touch device.
 */
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

/**
 * A cell of inputs, with "or" between them, since any one of them does the
 * action. An arcade control with two keys shows as two inputs.
 */
function inputsCell(inputs: readonly ControlInput[]): HTMLElement {
    const views: HTMLElement[] = [];
    for (const input of inputs) {
        if (isArcadeControlInput(input)) {
            for (const caps of capsOfControl(input)) views.push(capsView(caps));
        }
        else {
            views.push(inputView(input));
        }
    }
    const cell = element('td');
    const list = element('span', 'how-inputs');
    for (let i = 0; i < views.length; i++) {
        if (i > 0) list.append(element('span', 'how-or', 'or'));
        list.append(views[i]);
    }
    cell.append(list);
    return cell;
}

/**
 * One input. A key shows as key caps, and a gesture as its icon. An
 * on-screen button shows as its label. Inputs pressed together show with
 * "+" between them, and an arcade control among them shows as its first
 * key.
 */
function inputView(input: Exclude<ControlInput, ArcadeControlInput>): HTMLElement {
    if (typeof input === 'string') return isKey(input) ? capsView(KEYS[input]) : gestureView(input);
    if ('button' in input) return buttonView(input);
    const combo = element('span', 'how-combo');
    for (let i = 0; i < input.length; i++) {
        if (i > 0) combo.append(element('span', 'how-plus', '+'));
        const part = input[i];
        if (typeof part === 'string') combo.append(capsView(KEYS[part]));
        else if ('button' in part) combo.append(buttonView(part));
        else combo.append(capsView(capsOfControl(part)[0]));
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
function capsView({ caps, name }: Caps): HTMLElement {
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

/**
 * Whether an input is for the keyboard. An arcade control and a key are.
 * So are inputs pressed together, unless a button is among them.
 */
function isKeyInput(input: ControlInput): boolean {
    if (typeof input === 'string') return isKey(input);
    if (!isCombo(input)) return !('button' in input);
    return input.every((part) => typeof part === 'string' || !('button' in part));
}

function isCombo(input: ControlInput): input is Extract<ControlInput, readonly unknown[]> {
    return Array.isArray(input);
}

function isArcadeControlInput(input: ControlInput): input is ArcadeControlInput {
    return typeof input === 'object' && !isCombo(input) && 'control' in input;
}

/**
 * An arcade control's keys, from the table. Each key it has makes one set of
 * key caps. Left shows as Left, then A. All four directions show as the
 * arrows, then W A S D.
 */
function capsOfControl({ control }: ArcadeControlInput): Caps[] {
    const controls = CONTROLS_OF[control];
    const sets: Caps[] = [];
    for (let i = 0; ; i++) {
        const keys: string[] = [];
        for (const each of controls) {
            const key = ARCADE_CONTROL_KEYS[each][i] as string | undefined;
            if (key !== undefined) keys.push(key);
        }
        if (keys.length === 0) return sets;
        sets.push({ caps: keys.map(capOf), name: listInWords(keys.map(describeKey)) });
    }
}

/** A key's cap. An arrow key shows its arrow, and any other key shows in words. */
function capOf(key: string): string {
    return ARROWS[key] ?? describeKey(key);
}

/** Joins names into a list in words, such as `'Left and Right'` or `'W, A, S and D'`. */
function listInWords(names: readonly string[]): string {
    if (names.length < 2) return names.join('');
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Whether an input needs a mouse. A click and the wheel do. */
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

/** The key caps for a key, or for keys used as one. The name is for assistive technology. */
interface Caps {
    readonly caps: readonly string[];
    readonly name: string;
}

/** The caps of the arrow keys. Each is listed under its `KeyboardEvent.key` name. */
const ARROWS: Readonly<Record<string, string | undefined>> = { ArrowLeft: LEFT, ArrowUp: UP, ArrowRight: RIGHT, ArrowDown: DOWN };

/**
 * The arcade controls in each control input, in the order their caps show.
 * The d-pad's directions are in reading order, as W A S D is.
 */
const CONTROLS_OF: Readonly<Record<ArcadeControlInput['control'], readonly ArcadeControl[]>> = {
    'dpad': ['up', 'left', 'down', 'right'],
    'left-right': ['left', 'right'],
    'up-down': ['up', 'down'],
    'left': ['left'],
    'right': ['right'],
    'up': ['up'],
    'down': ['down'],
    'primary': ['primary'],
    'secondary': ['secondary'],
    'restart': ['restart'],
};

/** Each key's caps, and its name for assistive technology. */
const KEYS: Readonly<Record<ControlKey, Caps>> = {
    'arrows': { caps: [LEFT, UP, DOWN, RIGHT], name: 'the arrow keys' },
    'wasd': { caps: ['W', 'A', 'S', 'D'], name: 'W A S D' },
    'up': { caps: [UP], name: 'Up' },
    'down': { caps: [DOWN], name: 'Down' },
    'forward': { caps: ['Fwd'], name: 'Forward, toward the opponent' },
    'back': { caps: ['Back'], name: 'Back, away from the opponent' },
    'space': { caps: ['Space'], name: 'Space' },
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

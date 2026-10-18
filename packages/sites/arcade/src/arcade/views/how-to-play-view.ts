import { setRefresh } from '@mvtjs/html';
import type { ControlGesture, ControlInput, ControlKey, ControlRow, HowToPlay } from '../../entry-types';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HowToPlayViewBindings {
    /** How to play the entry shown, or undefined for none. */
    readonly howToPlay: () => HowToPlay | undefined;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Shows how to play an entry: what to aim for, then its controls as a table,
 * then anything else worth knowing. The table has a row for each action,
 * with its keys in one column, as key caps, and its gestures and on-screen
 * buttons in the next, each with an icon. A column shows only where some
 * row has something in it. The touch column is headed "Mouse / touch" where
 * a row needs a mouse.
 *
 * It builds its content as the entry shown changes, and only then.
 */
export function HowToPlayView(bindings: HowToPlayViewBindings): HTMLElement {
    const root = document.createElement('div');
    root.className = 'how-to-play';
    let shown: HowToPlay | undefined;
    setRefresh(root, refresh);
    return root;

    function refresh(): void {
        const howToPlay = bindings.howToPlay();
        if (howToPlay === shown) return;
        shown = howToPlay;
        root.replaceChildren(...(howToPlay === undefined ? [] : contentOf(howToPlay)));
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The intro, the table of controls and the notes, each where there is one. */
function contentOf(howToPlay: HowToPlay): HTMLElement[] {
    const content: HTMLElement[] = [];
    if (howToPlay.intro !== undefined) content.push(element('p', 'how-intro', howToPlay.intro));
    const controls = howToPlay.controls ?? [];
    if (controls.length > 0) content.push(controlsTable(controls));
    for (const note of howToPlay.notes ?? []) content.push(element('p', 'how-note', note));
    return content;
}

/** A table of the controls: the action, then its keys, then its gestures and buttons. */
function controlsTable(rows: readonly ControlRow[]): HTMLElement {
    const hasKeys = rows.some((row) => row.inputs.some(isKeyInput));
    const hasPointer = rows.some((row) => row.inputs.some((input) => !isKeyInput(input)));
    const needsMouse = rows.some((row) => row.inputs.some((input) => input === 'click' || input === 'wheel'));

    const table = element('table', 'how-controls');
    const head = element('thead');
    const headRow = element('tr');
    const corner = element('td');
    headRow.append(corner);
    if (hasKeys) headRow.append(headerCell('Keyboard'));
    if (hasPointer) headRow.append(headerCell(needsMouse ? 'Mouse / touch' : 'Touch'));
    head.append(headRow);

    const body = element('tbody');
    for (const row of rows) {
        const tr = element('tr');
        const action = element('th');
        action.scope = 'row';
        action.append(element('span', 'how-action', row.action));
        if (row.note !== undefined) action.append(element('span', 'how-action-note', row.note));
        tr.append(action);
        if (hasKeys) tr.append(inputsCell(row.inputs.filter(isKeyInput)));
        if (hasPointer) tr.append(inputsCell(row.inputs.filter((input) => !isKeyInput(input))));
        body.append(tr);
    }
    table.append(head, body);
    return table;
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

/** One input: key caps, keys pressed together with "+" between, a gesture with its icon, or an on-screen button. */
function inputView(input: ControlInput): HTMLElement {
    if (typeof input === 'string') return isKey(input) ? keyView(input) : gestureView(input);
    if ('button' in input) {
        const button = element('span', 'how-button', input.button);
        button.setAttribute('aria-label', `the ${input.button} button`);
        return button;
    }
    const combo = element('span', 'how-combo');
    for (let i = 0; i < input.length; i++) {
        if (i > 0) combo.append(element('span', 'how-plus', '+'));
        combo.append(keyView(input[i]));
    }
    return combo;
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

function isKeyInput(input: ControlInput): boolean {
    if (typeof input === 'string') return isKey(input);
    return !('button' in input);
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
    'drag': 'Drag',
    'pinch': 'Pinch',
    'click': 'Click',
    'wheel': 'Wheel',
};

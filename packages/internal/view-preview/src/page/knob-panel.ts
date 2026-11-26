import type { KnobInfo, KnobValue, PoseInfo } from '../shared';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface KnobPanelOptions {
    readonly host: HTMLElement;
    /** The knobs of the pose being previewed, or `undefined` for a pose that wasn't written in place. */
    readonly pose: PoseInfo | undefined;
    /** The knobs you've changed, by index, which the panel changes as you move them. */
    readonly values: Map<number, KnobValue>;
    /** Called after each change to `values`. */
    readonly onChange: () => void;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/** Fills `host` with a control for each of a pose's knobs. Each is a slider, a colour, a checkbox or a text box. */
export function renderKnobPanel(options: KnobPanelOptions): void {
    const { host, pose, values, onChange } = options;
    host.replaceChildren(createElement('h2', { text: 'Knobs' }));
    if (pose === undefined) {
        host.append(createElement('p', { className: 'vp-note', text: 'This test\'s pose is a function defined elsewhere, so its literals can\'t be changed here.' }));
        return;
    }
    if (pose.knobs.length === 0) {
        host.append(createElement('p', { className: 'vp-note', text: 'This pose has only constants and expressions, which can\'t be changed here.' }));
        return;
    }
    const resetAll = createElement('button', { text: 'Reset all' });
    resetAll.disabled = values.size === 0;
    resetAll.addEventListener('click', () => {
        values.clear();
        onChange();
        renderKnobPanel(options);
    });
    host.append(resetAll);
    for (const knob of pose.knobs) {
        const reset = (): void => {
            values.delete(knob.index);
            onChange();
            renderKnobPanel(options);
        };
        const set = (value: KnobValue): void => {
            if (value === knob.value) values.delete(knob.index);
            else values.set(knob.index, value);
            row.classList.toggle('vp-changed', values.has(knob.index));
            resetAll.disabled = values.size === 0;
            onChange();
        };
        const row = createKnobRow({ knob, value: values.get(knob.index) ?? knob.value, set, reset });
        row.classList.toggle('vp-changed', values.has(knob.index));
        host.append(row);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function createKnobRow(options: { readonly knob: KnobInfo; readonly value: KnobValue; readonly set: (value: KnobValue) => void; readonly reset: () => void }): HTMLElement {
    const { knob, value, set, reset } = options;
    const row = createElement('div', { className: 'vp-knob' });
    const label = createElement('label', { className: 'vp-knob-label' });
    label.append(createElement('span', { text: knob.label }), createElement('span', { className: 'vp-line', text: `line ${knob.line}` }));
    const resetButton = createElement('button', { className: 'vp-reset', text: 'Reset' });
    resetButton.title = `Back to ${JSON.stringify(knob.value)}, as the test file has it`;
    resetButton.addEventListener('click', reset);
    label.append(resetButton);
    row.append(label, createControl({ knob, value, set }));
    return row;
}

function createControl(options: { readonly knob: KnobInfo; readonly value: KnobValue; readonly set: (value: KnobValue) => void }): HTMLElement {
    const { knob, value, set } = options;
    const controls = createElement('div', { className: 'vp-controls' });
    if (knob.kind === 'boolean') {
        const box = createInput('checkbox');
        box.checked = value === true;
        box.addEventListener('input', () => set(box.checked));
        controls.append(box, createElement('span', { text: String(value) }));
        box.addEventListener('input', () => {
            controls.lastChild!.textContent = String(box.checked);
        });
        return controls;
    }
    if (knob.kind === 'string') {
        const text = createInput('text');
        text.value = String(value);
        text.addEventListener('input', () => set(text.value));
        controls.append(text);
        return controls;
    }
    if (knob.kind === 'color') {
        const color = createInput('color');
        const hex = createElement('code', { text: '' });
        const show = (n: number): void => {
            color.value = `#${n.toString(16).padStart(6, '0')}`;
            hex.textContent = `0x${n.toString(16).padStart(6, '0')}`;
        };
        show(value as number);
        color.addEventListener('input', () => {
            const n = Number.parseInt(color.value.slice(1), 16);
            show(n);
            set(n);
        });
        controls.append(color, hex);
        return controls;
    }
    // A number gets a slider over a range guessed from the literal, and a box for any value
    const { min, max, step } = guessRange(knob.value as number);
    const slider = createInput('range');
    Object.assign(slider, { min: String(min), max: String(max), step: String(step) });
    slider.value = String(value);
    const box = createInput('number');
    box.step = 'any';
    box.value = String(value);
    slider.addEventListener('input', () => {
        box.value = slider.value;
        set(Number(slider.value));
    });
    box.addEventListener('input', () => {
        const n = Number(box.value);
        if (box.value === '' || !Number.isFinite(n)) return;
        slider.value = box.value;
        set(n);
    });
    controls.append(slider, box);
    return controls;
}

/**
 * Returns a slider's range for a number, guessed from the literal: 0 to 1
 * for a fraction, or else 0 to twice the literal, or to 10 if that's more.
 * A negative literal gets a range either side of 0.
 */
function guessRange(value: number): { readonly min: number; readonly max: number; readonly step: number } {
    if (!Number.isInteger(value) && value >= 0 && value <= 1) return { min: 0, max: 1, step: 0.01 };
    const span = Math.max(Number.isInteger(value) ? 10 : 1, Math.abs(value) * 2);
    const step = Number.isInteger(value) ? 1 : span / 200;
    return { min: value < 0 ? -span : 0, max: span, step };
}

function createInput(type: string): HTMLInputElement {
    const input = document.createElement('input');
    input.type = type;
    return input;
}

function createElement<K extends keyof HTMLElementTagNameMap>(tag: K, options: { readonly className?: string; readonly text?: string } = {}): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    if (options.className !== undefined) element.className = options.className;
    if (options.text !== undefined) element.textContent = options.text;
    return element;
}

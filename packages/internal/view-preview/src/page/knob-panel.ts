import type { KnobKind, KnobValue, PoseInfo } from '../shared';
import type { KnobEffect } from './knob-effects';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface KnobPanelOptions {
    readonly host: HTMLElement;
    /** The knobs of the pose being previewed, or `undefined` for a pose that wasn't written in place. */
    readonly pose: PoseInfo | undefined;
    /** The knobs you've changed, by index, which the panel changes as you move them. */
    readonly values: Map<number, KnobValue>;
    /** What a knob does to the pose, by its index, or `undefined` until that's measured. */
    readonly effectOf: (index: number) => KnobEffect | undefined;
    /** Called after each change to `values`. */
    readonly onChange: () => void;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Fills `host` with a control for each of a pose's knobs. Each is a slider,
 * a colour, a checkbox or a text box. A knob that leaves the picture the
 * same is folded away below the rest, unless you've changed it.
 */
export function renderKnobPanel(options: KnobPanelOptions): void {
    const { host, pose, values, effectOf, onChange } = options;
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
    const folded: FoldedRow[] = [];
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
        const effect = effectOf(knob.index);
        const row = createKnobRow({ kind: knob.kind, label: knob.label, where: `line ${knob.line}`, doc: undefined, effect, initial: knob.value, value: values.get(knob.index) ?? knob.value, set, reset });
        row.classList.toggle('vp-changed', values.has(knob.index));
        if (isShown({ effect, isChanged: values.has(knob.index) })) host.append(row);
        else folded.push({ row, effect: effect! });
    }
    appendFoldedRows({ host, rows: folded });
}

/** What a row of the panel shows, and what it calls as you change it. */
export interface KnobRowOptions {
    readonly kind: KnobKind;
    /** What the value sets, which also chooses a number's range, as `flightMs` or `alpha` does. */
    readonly label: string;
    /** Where the value is written, such as `line 12`. */
    readonly where: string;
    /** What the value is for, from its doc comment, shown under its label. */
    readonly doc: string | undefined;
    /** What the value does to the pose, shown beside its label, or `undefined` until that's measured. */
    readonly effect: KnobEffect | undefined;
    /** The value written in the file, which Reset goes back to. */
    readonly initial: KnobValue;
    readonly value: KnobValue;
    readonly set: (value: KnobValue) => void;
    readonly reset: () => void;
}

/** Returns a row with a value's label, where it's written, what it changes, a Reset button, and a control to change it. */
export function createKnobRow(options: KnobRowOptions): HTMLElement {
    const { label: text, where, doc, effect, initial, reset } = options;
    const row = createElement('div', { className: 'vp-knob' });
    const label = createElement('label', { className: 'vp-knob-label' });
    label.append(createElement('span', { text }), createElement('span', { className: 'vp-line', text: where }));
    const badge = describeEffect(effect);
    if (badge !== undefined) {
        const element = createElement('span', { className: 'vp-effect', text: badge.text });
        element.title = badge.title;
        label.append(element);
    }
    const resetButton = createElement('button', { className: 'vp-reset', text: 'Reset' });
    resetButton.title = `Back to ${JSON.stringify(initial)}, as the file has it`;
    resetButton.addEventListener('click', reset);
    label.append(resetButton);
    row.append(label);
    if (doc !== undefined) row.append(createElement('div', { className: 'vp-doc', text: doc }));
    row.append(createControl(options));
    return row;
}

/** A row that's folded away, and why. */
export interface FoldedRow {
    readonly row: HTMLElement;
    readonly effect: KnobEffect;
}

/** Returns whether a row is shown, rather than folded away. It's shown until its effect is measured, and once you've changed it. */
export function isShown(options: { readonly effect: KnobEffect | undefined; readonly isChanged: boolean }): boolean {
    const { effect, isChanged } = options;
    return isChanged || effect === undefined || effect.kind === 'changes' || effect.kind === 'later' || effect.kind === 'unchecked';
}

/** Adds the rows that are folded away, closed, under headings that say why each is folded. */
export function appendFoldedRows(options: { readonly host: HTMLElement; readonly rows: readonly FoldedRow[] }): void {
    const { host, rows } = options;
    if (rows.length === 0) return;
    const details = createElement('details', { className: 'vp-folded' });
    details.append(createElement('summary', { text: `${rows.length} more, which don't change this pose` }));
    const groups: readonly { readonly kind: KnobEffect['kind']; readonly heading: string }[] = [
        { kind: 'same', heading: 'The pose reads these, but looks the same at other values' },
        { kind: 'unread', heading: 'The pose doesn\'t read these. Play on to see if the view does' },
    ];
    for (const { kind, heading } of groups) {
        const inGroup = rows.filter((folded) => folded.effect.kind === kind);
        if (inGroup.length === 0) continue;
        details.append(createElement('h4', { text: heading }), ...inGroup.map((folded) => folded.row));
    }
    host.append(details);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Returns the badge for what a knob changes: the share of the picture, or that the view read it while playing. */
function describeEffect(effect: KnobEffect | undefined): { readonly text: string; readonly title: string } | undefined {
    if (effect?.kind === 'changes') {
        const percent = effect.share < 0.01 ? '<1%' : `${Math.round(effect.share * 100)}%`;
        return { text: percent, title: `At half or one and a half times this value, ${percent} of the picture changes.` };
    }
    if (effect?.kind === 'later') return { text: 'in play', title: 'The pose doesn\'t read this, but the view read it as it played on.' };
    return undefined;
}

function createControl(options: KnobRowOptions): HTMLElement {
    const { kind, label, initial, value, set } = options;
    const controls = createElement('div', { className: 'vp-controls' });
    if (kind === 'boolean') {
        const box = createInput('checkbox');
        box.checked = value === true;
        box.addEventListener('input', () => set(box.checked));
        controls.append(box, createElement('span', { text: String(value) }));
        box.addEventListener('input', () => {
            controls.lastChild!.textContent = String(box.checked);
        });
        return controls;
    }
    if (kind === 'string') {
        const text = createInput('text');
        text.value = String(value);
        text.addEventListener('input', () => set(text.value));
        controls.append(text);
        return controls;
    }
    if (kind === 'color') {
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
    // A number gets a slider over a range guessed from its name and its value in the file, and a box for any value.
    // The range reaches the value you've set, if that's past it, so a range you grew stays grown as the panel is shown again
    const range = guessRange({ value: initial as number, label });
    const min = Math.min(range.min, value as number);
    const max = Math.max(range.max, value as number);
    const slider = createInput('range');
    Object.assign(slider, { min: String(min), max: String(max), step: String(range.step) });
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
    growRangeWhileHeld({
        slider,
        step: range.step,
        canGrowBelow: range.canGrowBelow,
        canGrowAbove: range.canGrowAbove,
        set: (n) => {
            box.value = String(n);
            set(n);
        },
    });
    controls.append(slider, box);
    return controls;
}

/** A slider's range, and which of its ends may move out while you hold the thumb against them. */
interface SliderRange {
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly canGrowBelow: boolean;
    readonly canGrowAbove: boolean;
}

/**
 * Returns a slider's range for a number. Its name chooses the range when it
 * ends in a unit. A `Chance`, `Fraction` or `Alpha` gets 0 to 1, a `Count`
 * gets whole numbers, and `Ms` and `PerSecond` start at 0. Otherwise the
 * value chooses it: 0 to 1 for a fraction, or else 0 to twice the value, or
 * to 10 if that's more. A negative value gets a range either side of 0.
 * Either end may grow, except an end that the unit fixes: 0 below a unit
 * that can't be negative, and 1 above a `Chance`, `Fraction` or `Alpha`.
 */
function guessRange(options: { readonly value: number; readonly label: string }): SliderRange {
    const { value, label } = options;
    if (/(Chance|Fraction|Alpha)$/.test(label)) return { min: 0, max: 1, step: 0.01, canGrowBelow: false, canGrowAbove: false };
    if (/Ms$/.test(label)) return { min: 0, max: Math.max(1000, Math.abs(value) * 2), step: 1, canGrowBelow: false, canGrowAbove: true };
    if (/(Count|PerSecond)$/.test(label)) {
        return { min: 0, max: Math.max(10, Math.abs(value) * 2), step: Number.isInteger(value) ? 1 : 0.1, canGrowBelow: false, canGrowAbove: true };
    }
    if (!Number.isInteger(value) && value >= 0 && value <= 1) return { min: 0, max: 1, step: 0.01, canGrowBelow: true, canGrowAbove: true };
    const span = Math.max(Number.isInteger(value) ? 10 : 1, Math.abs(value) * 2);
    const step = Number.isInteger(value) ? 1 : span / 200;
    return { min: value < 0 ? -span : 0, max: span, step, canGrowBelow: true, canGrowAbove: true };
}

/** How long you hold a slider's thumb against an end before the end starts to move out, in milliseconds. */
const GROW_DELAY_MS = 1000;
/** How fast an end moves out as it starts, as a share a second of the range you started holding it at. */
const GROW_START_RATE = 0.5;
/** How much faster the end moves for each second it has been moving, as a share a second of that range. */
const GROW_ACCELERATION = 0.5;

/**
 * Grows a slider's range while you hold its thumb against an end. After
 * a second there, the end moves out, slowly at first and faster the longer
 * you hold it, and the value follows the end. Move the thumb off the end,
 * or let go, and the range stays where it reached.
 */
function growRangeWhileHeld(options: {
    readonly slider: HTMLInputElement;
    readonly step: number;
    readonly canGrowBelow: boolean;
    readonly canGrowAbove: boolean;
    readonly set: (value: number) => void;
}): void {
    const { slider, step, canGrowBelow, canGrowAbove, set } = options;
    if (!canGrowBelow && !canGrowAbove) return;
    const hold = { frame: 0, lastTime: 0, atEndSince: undefined as number | undefined, low: 0, high: 0, span: 0 };
    const tick = (time: number): void => {
        hold.frame = requestAnimationFrame(tick);
        const deltaMs = Math.min(time - hold.lastTime, 100);
        hold.lastTime = time;
        const value = Number(slider.value);
        const isAtMax = canGrowAbove && value >= Number(slider.max);
        const isAtMin = canGrowBelow && value <= Number(slider.min);
        if (!isAtMax && !isAtMin) {
            hold.atEndSince = undefined;
            return;
        }
        if (hold.atEndSince === undefined) {
            // The ends are kept unrounded as they grow, so a whole-number range can grow by less than 1 a frame.
            // The growth is a share of the range as it was here, so it speeds up as the hold goes on, rather than compounding
            const low = Number(slider.min);
            const high = Number(slider.max);
            Object.assign(hold, { atEndSince: time, low, high, span: high - low });
        }
        const growingMs = time - hold.atEndSince! - GROW_DELAY_MS;
        if (growingMs <= 0) return;
        const rate = GROW_START_RATE + (GROW_ACCELERATION * growingMs) / 1000;
        const growth = (hold.span * rate * deltaMs) / 1000;
        const end = isAtMax ? roundToStep({ value: (hold.high += growth), step }) : roundToStep({ value: (hold.low -= growth), step });
        if (end === value) return;
        if (isAtMax) slider.max = String(end);
        else slider.min = String(end);
        slider.value = String(end);
        set(end);
    };
    const stop = (): void => {
        cancelAnimationFrame(hold.frame);
        window.removeEventListener('pointerup', stop);
        window.removeEventListener('pointercancel', stop);
    };
    slider.addEventListener('pointerdown', () => {
        stop();
        Object.assign(hold, { lastTime: performance.now(), atEndSince: undefined });
        hold.frame = requestAnimationFrame(tick);
        window.addEventListener('pointerup', stop);
        window.addEventListener('pointercancel', stop);
    });
}

/** Returns a value rounded to a slider's step, without the long tails that adding decimals leaves, as `0.30000000000000004` has. */
function roundToStep(options: { readonly value: number; readonly step: number }): number {
    const { value, step } = options;
    return Number((Math.round(value / step) * step).toPrecision(12));
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

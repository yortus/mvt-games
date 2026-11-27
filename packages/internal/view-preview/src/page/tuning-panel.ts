import type { TuningField, TuningInfo } from '../shared';
import type { KnobEffect } from './knob-effects';
import { appendFoldedRows, createKnobRow, type FoldedRow, isShown } from './knob-panel';
import { fieldKey, readField, type RegisteredTuning, writeField } from './tunings';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface TuningPanelOptions {
    readonly host: HTMLElement;
    /** The tuning objects the test imports, which have registered. */
    readonly tunings: readonly RegisteredTuning[];
    /** What a field does to the pose, by its key (see `fieldKey`), or `undefined` until that's measured. */
    readonly effectOf: (key: string) => KnobEffect | undefined;
    /** Called after each change to a field. */
    readonly onChange: () => void;
    /** Opens a tuning object's file in the editor. Returns whether it did, so the link can leave it to the browser if not. */
    readonly openSource: (where: { readonly path: string; readonly line: number; readonly column: number }) => boolean;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Fills `host` with a group of controls for each tuning object, one for each
 * field. A change sets the field on the object itself, so the code that
 * reads it sees the change the next time it reads it.
 *
 * Once what each field does is measured, the fields that change the picture
 * most come first, in the groups that change it most. A field that leaves
 * the picture the same, or that the pose doesn't read, is folded away below
 * the rest, unless you've changed it.
 */
export function renderTuningPanel(options: TuningPanelOptions): void {
    const { host, tunings, effectOf, onChange, openSource } = options;
    host.replaceChildren(createElement('h2', { text: 'Tuning' }));
    if (tunings.length === 0) {
        host.append(createElement('p', {
            className: 'vp-note',
            text: 'The modules this test imports don\'t declare a tuning object. A top-level object named like SHIP_TUNING shows here.',
        }));
        return;
    }
    const rerender = (): void => renderTuningPanel(options);
    const resetAll = createElement('button', { text: 'Reset all' });
    resetAll.disabled = !tunings.some(hasChanges);
    resetAll.addEventListener('click', () => {
        for (const registered of tunings) {
            for (const field of registered.info.fields) writeField({ registered, field, value: field.value });
        }
        onChange();
        rerender();
    });
    host.append(resetAll);

    const folded: FoldedRow[] = [];
    const groups = tunings.map((registered) => {
        const fields = registered.info.fields.map((field, order) => ({ field, order, effect: effectOf(fieldKey(registered.info, field)) }));
        fields.sort((a, b) => rankEffect(b.effect) - rankEffect(a.effect) || a.order - b.order);
        return { registered, fields, rank: Math.max(0, ...fields.map((entry) => rankEffect(entry.effect))) };
    });
    groups.sort((a, b) => b.rank - a.rank);

    for (const { registered, fields } of groups) {
        const { info } = registered;
        const group = createElement('section', { className: 'vp-tuning-group' });
        group.append(createHeading({ info, openSource }));
        if (info.fields.length === 0) group.append(createElement('p', { className: 'vp-note', text: 'It holds only expressions, which can\'t be changed here.' }));
        let shownCount = 0;
        for (const { field, effect } of fields) {
            const value = readField(registered, field);
            const isChanged = value !== field.value;
            const shown = isShown({ effect, isChanged });
            const row = createFieldRow({
                registered,
                field,
                effect,
                // A folded row is listed apart from its group, so its label names the group too
                label: shown ? field.path.join('.') : `${info.name}.${field.path.join('.')}`,
                onSet: (isNowChanged) => {
                    row.classList.toggle('vp-changed', isNowChanged);
                    resetAll.disabled = !tunings.some(hasChanges);
                    onChange();
                },
                onReset: () => {
                    onChange();
                    rerender();
                },
            });
            row.classList.toggle('vp-changed', isChanged);
            if (shown) {
                group.append(row);
                shownCount++;
            }
            else folded.push({ row, effect: effect! });
        }
        if (shownCount > 0 || info.fields.length === 0) host.append(group);
    }
    appendFoldedRows({ host, rows: folded });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function createHeading(options: { readonly info: TuningInfo; readonly openSource: TuningPanelOptions['openSource'] }): HTMLElement {
    const { info, openSource } = options;
    const heading = createElement('h3', { text: info.name });
    if (info.doc !== undefined) heading.title = info.doc;
    const link = createElement('a', { className: 'vp-line', text: `${shortenPath(info.file)}:${info.line}` });
    link.href = `vscode://file/${info.file}:${info.line}:${info.column}`;
    link.addEventListener('click', (event) => {
        if (openSource({ path: info.file, line: info.line, column: info.column })) event.preventDefault();
    });
    heading.append(' ', link);
    return heading;
}

function createFieldRow(options: {
    readonly registered: RegisteredTuning;
    readonly field: TuningField;
    readonly effect: KnobEffect | undefined;
    readonly label: string;
    /** Called after you set the field, with whether it's now changed from the file. */
    readonly onSet: (isChanged: boolean) => void;
    readonly onReset: () => void;
}): HTMLElement {
    const { registered, field, effect, label, onSet, onReset } = options;
    return createKnobRow({
        kind: field.kind,
        label,
        where: `line ${field.line}`,
        doc: field.doc,
        effect,
        initial: field.value,
        value: readField(registered, field),
        set: (value) => {
            writeField({ registered, field, value });
            onSet(value !== field.value);
        },
        reset: () => {
            writeField({ registered, field, value: field.value });
            onReset();
        },
    });
}

/** Ranks an effect for sorting. Fields that change the picture rank by how much, above the fields not yet measured, which rank above the rest. */
function rankEffect(effect: KnobEffect | undefined): number {
    if (effect?.kind === 'changes') return 1 + effect.share;
    if (effect === undefined || effect.kind === 'later' || effect.kind === 'unchecked') return 0.5;
    return 0;
}

function hasChanges(registered: RegisteredTuning): boolean {
    return registered.info.fields.some((field) => readField(registered, field) !== field.value);
}

/** Returns a file's path from its entry or package down, as `galaxy-raiders/models/ship-model.ts`. */
function shortenPath(file: TuningInfo['file']): string {
    return file.replace(/^.*\/(entries|src)\//, '');
}

function createElement<K extends keyof HTMLElementTagNameMap>(tag: K, options: { readonly className?: string; readonly text?: string } = {}): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    if (options.className !== undefined) element.className = options.className;
    if (options.text !== undefined) element.textContent = options.text;
    return element;
}

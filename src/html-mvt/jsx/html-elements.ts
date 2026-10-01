import { attributesOf, defineElements, element, type ElementDefinition, event } from '#mvt-utils/jsx';
import { writeText } from './owned-text';

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

// In the DOM, reads are cheap and writes are not: a write can invalidate
// style or layout even when the value is the same. So almost everything is
// written on change. The exceptions are `value`, `valueAsNumber` and
// `checked`, which the user changes too, and are compared with the element
// every frame (see `writeValue`). Plain assignments name their property,
// which generated refresh methods assign inline; see `attributesOf`.
//
// There are no changing styles: `style` is fixed, and a style that follows
// the model goes through `class` (proposal 022, open question 5).

const html = attributesOf<HTMLElement>();
const field = attributesOf<FormField>();
const input = attributesOf<HTMLInputElement>();
const textArea = attributesOf<HTMLTextAreaElement>();
const button = attributesOf<HTMLButtonElement>();
const anchor = attributesOf<HTMLAnchorElement>();
const image = attributesOf<HTMLImageElement>();
const progress = attributesOf<HTMLProgressElement>();
const meter = attributesOf<HTMLMeterElement>();
const canvas = attributesOf<HTMLCanvasElement>();
const details = attributesOf<HTMLDetailsElement>();

/** Attributes every HTML element accepts. */
const globalAttributes = {
    /** The element's class list, as one string. The way to change how it looks as the model changes. */
    class: html.onChange('className'),
    id: html.fixed('id'),
    title: html.onChange('title'),
    /** Inline style, as CSS text. Fixed: changing styles go through `class`. */
    style: html.fixed((e, v: string) => { e.style.cssText = v; }),
    /**
     * The element's text, and the only way to put text in an element: JSX
     * has no text children. An element with text has no element children.
     */
    text: html.onChange(writeText),
    tabIndex: html.fixed('tabIndex'),
    role: html.fixed((e, v: string) => { e.setAttribute('role', v); }),

    onClick: event<MouseEvent>('click'),
    onDblClick: event<MouseEvent>('dblclick'),
    onContextMenu: event<MouseEvent>('contextmenu'),
    onPointerDown: event<PointerEvent>('pointerdown'),
    onPointerUp: event<PointerEvent>('pointerup'),
    onPointerMove: event<PointerEvent>('pointermove'),
    onPointerEnter: event<PointerEvent>('pointerenter'),
    onPointerLeave: event<PointerEvent>('pointerleave'),
    onPointerCancel: event<PointerEvent>('pointercancel'),
    onWheel: event<WheelEvent>('wheel'),
    onKeyDown: event<KeyboardEvent>('keydown'),
    onKeyUp: event<KeyboardEvent>('keyup'),
    onFocus: event<FocusEvent>('focus'),
    onBlur: event<FocusEvent>('blur'),
    onInput: event<Event>('input'),
    onChange: event<Event>('change'),
    onSubmit: event<SubmitEvent>('submit'),
};

/**
 * Attributes whose names are not known in advance: `data-*` and `aria-*`,
 * written as the element's attributes, on change.
 */
const globalPatterns = {
    'data-': (name: string) => html.onChange((e, v: string | number | boolean) => { e.setAttribute(name, String(v)); }),
    'aria-': (name: string) => html.onChange((e, v: string | number | boolean) => { e.setAttribute(name, String(v)); }),
};

/** Elements with only the global attributes. */
const PLAIN_TAGS = [
    'div', 'span', 'p', 'section', 'article', 'aside', 'header', 'footer', 'main', 'nav',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'strong', 'em', 'small', 'b', 'i', 'code', 'pre', 'kbd', 'abbr', 'br', 'hr',
    'figure', 'figcaption', 'form', 'fieldset', 'legend', 'summary',
] as const;

/**
 * The DOM's intrinsic elements: one entry per tag, so a `ref` receives the
 * tag's own element type (`HTMLInputElement` for `<input>`).
 */
export const htmlElements = defineElements({
    ...elementsFor(PLAIN_TAGS),

    input: element(() => document.createElement('input'), {
        ...globalAttributes,
        /** What the field holds. Not written while the field has focus; see `writeValue`. */
        value: field.everyFrame(writeValue),
        /**
         * What a number or range field holds, as a number: for a model's
         * number, with no string made per frame. Written as `value` is.
         */
        valueAsNumber: input.everyFrame(writeValueAsNumber),
        checked: input.everyFrame(writeChecked),
        disabled: input.onChange('disabled'),
        readOnly: input.onChange('readOnly'),
        placeholder: input.onChange('placeholder'),
        min: input.onChange('min'),
        max: input.onChange('max'),
        step: input.onChange('step'),
        type: input.fixed('type'),
        name: input.fixed('name'),
    }, globalPatterns),
    textarea: element(() => document.createElement('textarea'), {
        ...globalAttributes,
        value: field.everyFrame(writeValue),
        disabled: textArea.onChange('disabled'),
        readOnly: textArea.onChange('readOnly'),
        placeholder: textArea.onChange('placeholder'),
        rows: textArea.fixed('rows'),
        name: textArea.fixed('name'),
    }, globalPatterns),
    select: element(() => document.createElement('select'), {
        ...globalAttributes,
        value: field.everyFrame(writeValue),
        disabled: attributesOf<HTMLSelectElement>().onChange('disabled'),
        name: attributesOf<HTMLSelectElement>().fixed('name'),
    }, globalPatterns),
    option: element(() => document.createElement('option'), {
        ...globalAttributes,
        value: attributesOf<HTMLOptionElement>().fixed('value'),
        disabled: attributesOf<HTMLOptionElement>().onChange('disabled'),
    }, globalPatterns),
    button: element(() => document.createElement('button'), {
        ...globalAttributes,
        disabled: button.onChange('disabled'),
        type: button.fixed('type'),
    }, globalPatterns),
    label: element(() => document.createElement('label'), {
        ...globalAttributes,
        /** The id of the field it labels. */
        for: attributesOf<HTMLLabelElement>().fixed('htmlFor'),
    }, globalPatterns),
    a: element(() => document.createElement('a'), {
        ...globalAttributes,
        href: anchor.onChange('href'),
        target: anchor.fixed('target'),
    }, globalPatterns),
    img: element(() => document.createElement('img'), {
        ...globalAttributes,
        src: image.onChange('src'),
        alt: image.onChange('alt'),
        width: image.onChangeNumber('width'),
        height: image.onChangeNumber('height'),
    }, globalPatterns),
    progress: element(() => document.createElement('progress'), {
        ...globalAttributes,
        value: progress.onChangeNumber('value'),
        max: progress.onChangeNumber('max'),
    }, globalPatterns),
    meter: element(() => document.createElement('meter'), {
        ...globalAttributes,
        value: meter.onChangeNumber('value'),
        min: meter.onChangeNumber('min'),
        max: meter.onChangeNumber('max'),
        low: meter.onChangeNumber('low'),
        high: meter.onChangeNumber('high'),
        optimum: meter.onChangeNumber('optimum'),
    }, globalPatterns),
    canvas: element(() => document.createElement('canvas'), {
        ...globalAttributes,
        /** Changing it clears the canvas, as in the DOM. */
        width: canvas.onChangeNumber('width'),
        height: canvas.onChangeNumber('height'),
    }, globalPatterns),
    details: element(() => document.createElement('details'), {
        ...globalAttributes,
        open: details.onChange('open'),
    }, globalPatterns),
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** An element whose `value` the user edits. */
type FormField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/**
 * The definitions of elements that have only the global attributes, one per
 * tag.
 */
function elementsFor<K extends keyof HTMLElementTagNameMap>(
    tags: readonly K[],
): { [T in K]: ElementDefinition<HTMLElementTagNameMap[T], typeof globalAttributes, typeof globalPatterns> } {
    const elements: Partial<Record<K, ElementDefinition<HTMLElement, typeof globalAttributes, typeof globalPatterns>>> = {};
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        elements[tag] = element(() => document.createElement(tag), globalAttributes, globalPatterns);
    }
    return elements as { [T in K]: ElementDefinition<HTMLElementTagNameMap[T], typeof globalAttributes, typeof globalPatterns> };
}

/**
 * `value`'s write. Compared with what the field holds, not with the value
 * last written: a model that rejects what the user typed puts its own value
 * back on the next frame. Skipped while the field has focus, so a refresh
 * never overwrites text as it is typed; a value the model changed meanwhile
 * shows once the user leaves the field.
 */
function writeValue(e: FormField, v: string): void {
    if (e.value !== v && e.ownerDocument.activeElement !== e) e.value = v;
}

/** `valueAsNumber`'s write: `writeValue`, for a number. */
function writeValueAsNumber(e: HTMLInputElement, v: number): void {
    if (e.valueAsNumber !== v && e.ownerDocument.activeElement !== e) e.valueAsNumber = v;
}

/** `checked`'s write, compared with the element, like `value`, but written while focused. */
function writeChecked(e: HTMLInputElement, v: boolean): void {
    if (e.checked !== v) e.checked = v;
}

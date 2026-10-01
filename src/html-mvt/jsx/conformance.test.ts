// @vitest-environment happy-dom
import { describeJsxConformance } from '#mvt-utils/jsx/conformance';
import { isDestroyed, updateScene } from '../element-mixin';
import { htmlElements } from './html-elements';
import { htmlTarget } from './html-target';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Runs in happy-dom, a DOM for Node with no layout or rendering, which the
// JSX target needs neither of.
describeJsxConformance<Element>({
    target: htmlTarget,
    elements: htmlElements,
    // HTML's only every-frame attributes are the ones the user edits too.
    // Children and a click on an `<input>` are odd markup, but the DOM allows
    // both, and the suite needs one tag for all three.
    everyFrame: {
        tag: 'input',
        key: 'value',
        values: ['3', '7'],
        read: (node) => (node as HTMLInputElement).value,
        write: (node, value) => {
            (node as HTMLInputElement).value = value as string;
        },
    },
    onChange: {
        tag: 'div',
        key: 'title',
        values: ['a', 'b'],
        read: (node) => (node as HTMLElement).title,
        write: (node, value) => {
            (node as HTMLElement).title = value as string;
        },
    },
    onChangeNumber: {
        tag: 'progress',
        key: 'value',
        values: [10.25, 3.5],
        read: (node) => (node as HTMLProgressElement).value,
        write: (node, value) => {
            (node as HTMLProgressElement).value = value;
        },
        // A progress bar's value is capped at its max, 1 by default
        with: { max: 100 },
    },
    fixed: {
        tag: 'div',
        key: 'id',
        values: ['a', 'b'],
        read: (node) => node.id,
        write: (node, value) => {
            node.id = value as string;
        },
    },
    event: { key: 'onClick', emit: (node) => node.dispatchEvent(new Event('click')) },
    children: (node) => [...node.children],
    parent: (node) => node.parentElement ?? undefined,
    isVisible: (node) => !node.hasAttribute('hidden'),
    isDestroyed,
    updateScene,
});

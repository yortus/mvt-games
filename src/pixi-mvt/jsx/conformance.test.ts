import { type Container, Texture } from 'pixi.js';
import { describeJsxConformance } from '#mvt-utils/jsx/conformance';
import { updateScene } from '../container-mixin';
import { pixiElements } from './pixi-elements';
import { pixiTarget } from './pixi-target';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describeJsxConformance<Container>({
    target: pixiTarget,
    elements: pixiElements,
    everyFrame: {
        tag: 'container',
        key: 'x',
        values: [3, 7],
        read: (node) => node.x,
        write: (node, value) => {
            node.x = value as number;
        },
    },
    onChange: {
        tag: 'container',
        key: 'label',
        values: ['a', 'b'],
        read: (node) => node.label,
        write: (node, value) => {
            node.label = value as string;
        },
    },
    onChangeNumber: {
        tag: 'sprite',
        key: 'width',
        values: [10.25, 3.5],
        read: (node) => node.width,
        write: (node, value) => {
            node.width = value;
        },
        // A sprite's width is its texture's, scaled: it needs a sized texture
        with: { texture: Texture.WHITE },
    },
    fixed: {
        tag: 'container',
        key: 'sortableChildren',
        values: [true, false],
        read: (node) => node.sortableChildren,
        write: (node, value) => {
            node.sortableChildren = value as boolean;
        },
    },
    event: { key: 'onPointerTap', emit: (node) => node.emit('pointertap', {} as never) },
    children: (node) => node.children,
    parent: (node) => node.parent ?? undefined,
    isVisible: (node) => node.visible,
    isDestroyed: (node) => node.destroyed,
    updateScene,
});

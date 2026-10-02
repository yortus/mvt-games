import { BoxGeometry, type BufferGeometry, type Mesh, type Object3D, type PerspectiveCamera, SphereGeometry } from 'three';
import { describeJsxConformance } from '#mvt-utils/jsx/conformance';
import { isDestroyed } from '../object3d-mixin';
import { threeElements } from './three-elements';
import { threeTarget } from './three-target';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Runs in Node: the scene graph needs no WebGL.
describeJsxConformance<Object3D>({
    target: threeTarget,
    elements: threeElements,
    everyFrame: {
        tag: 'group',
        key: 'x',
        values: [3, 7],
        read: (node) => node.position.x,
        write: (node, value) => {
            node.position.x = value as number;
        },
    },
    onChange: {
        tag: 'mesh',
        key: 'geometry',
        values: [new BoxGeometry(), new SphereGeometry()],
        read: (node) => (node as Mesh).geometry,
        write: (node, value) => {
            (node as Mesh).geometry = value as BufferGeometry;
        },
    },
    onChangeNumber: {
        tag: 'perspectiveCamera',
        key: 'fov',
        values: [10.25, 3.5],
        read: (node) => (node as PerspectiveCamera).fov,
        write: (node, value) => {
            (node as PerspectiveCamera).fov = value;
        },
    },
    fixed: {
        tag: 'group',
        key: 'name',
        values: ['a', 'b'],
        read: (node) => node.name,
        write: (node, value) => {
            node.name = value as string;
        },
    },
    event: { key: 'onClick', emit: (node) => node.dispatchEvent({ type: 'click' } as never) },
    children: (node) => node.children,
    parent: (node) => node.parent ?? undefined,
    isVisible: (node) => node.visible,
    isDestroyed,
});

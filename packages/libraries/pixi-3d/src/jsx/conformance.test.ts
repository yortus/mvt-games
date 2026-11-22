import { type Camera3D, type Container3D, CubeGeometry, type Geometry3D, Material3D, type Mesh3D, SphereGeometry } from '@pixi/3d';
import { describeJsxConformance } from '@mvtjs/utils/jsx/conformance';
import '../container3d-mixin';
import { pixi3dElements } from './pixi3d-elements';
import { pixi3dTarget } from './pixi3d-target';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Runs in Node. The scene graph doesn't need a GPU.
describeJsxConformance<Container3D>({
    target: pixi3dTarget,
    elements: pixi3dElements,
    everyFrame: {
        tag: 'group',
        key: 'x',
        values: [3, 7],
        read: (node) => node.x,
        write: (node, value) => {
            node.x = value as number;
        },
    },
    onChange: {
        tag: 'mesh',
        key: 'geometry',
        values: [new CubeGeometry(), new SphereGeometry()],
        read: (node) => (node as Mesh3D).geometry,
        write: (node, value) => {
            (node as Mesh3D).geometry = value as Geometry3D;
        },
    },
    onChangeNumber: {
        tag: 'camera',
        key: 'fov',
        values: [10.25, 3.5],
        read: (node) => (node as Camera3D).fov,
        write: (node, value) => {
            (node as Camera3D).fov = value;
        },
    },
    fixed: {
        tag: 'group',
        key: 'label',
        values: ['a', 'b'],
        read: (node) => node.label,
        write: (node, value) => {
            node.label = value as string;
        },
    },
    event: { key: 'onPointerTap', emit: (node) => node.emit('pointertap' as never, {} as never) },
    children: (node) => node.children,
    parent: (node) => node.parent ?? undefined,
    isVisible: (node) => node.visible,
    isDestroyed: (node) => node.destroyed,
    owned: {
        make: () => new Material3D(),
        isReleased: (material: Material3D) => material.destroyed,
    },
});

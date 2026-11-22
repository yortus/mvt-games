import { BatchedMesh3D, CubeGeometry, Material3D, View3D } from '@pixi/3d';
import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { destroyAndFindLeaks } from './destroy-and-find-leaks';
import { jsx } from './jsx';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('destroyAndFindLeaks', () => {
    it('returns an empty list when the view owns what it made', () => {
        const body = new CubeGeometry();
        const paint = new Material3D();
        const scene = jsx('group', { owns: [body, paint], children: jsx('mesh', { geometry: body, material: paint }) });

        expect(destroyAndFindLeaks(scene)).toEqual([]);
    });

    it('reports a resource that no element owned, and where it was used, through a 2D stage and its View3D', () => {
        const body = new CubeGeometry();
        const scene = jsx('group', { label: 'car', children: jsx('mesh', { geometry: body }) });
        const stage = new Container({ label: 'stage' });
        stage.addChild(new View3D({ root: scene }));

        const leaks = destroyAndFindLeaks(stage);

        expect(leaks).toEqual([{ kind: 'geometry', problem: 'leaked', resource: body, usedBy: 'stage > View3D > car > Mesh3D' }]);
    });

    it('reports what a batch\'s slots drew with, unless an element owned it', () => {
        const body = new CubeGeometry();
        const paint = new Material3D();
        const crowd = new BatchedMesh3D({ size: 2, label: 'crowd' });
        crowd.setGeometryAt(1, body);
        crowd.setMaterialAt(1, paint);

        const leaks = destroyAndFindLeaks(crowd);

        expect(leaks.map((leak) => [leak.resource, leak.usedBy])).toEqual([[body, 'crowd [slot 1]'], [paint, 'crowd [slot 1]']]);
    });

    it('leaves out the resources listed as shared', () => {
        const paint = new Material3D();
        const scene = jsx('mesh', { material: paint });

        expect(destroyAndFindLeaks(scene, { shared: [paint] })).toEqual([]);
    });

    it('reports a resource freed while a mesh still used it', () => {
        const paint = new Material3D();
        const scene = jsx('group', { children: jsx('mesh', { material: paint }) });
        paint.destroy();

        expect(destroyAndFindLeaks(scene)).toMatchObject([{ kind: 'material', problem: 'freed-early' }]);
    });
});

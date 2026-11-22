import { Container3D, View3D } from '@pixi/3d';
import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { refreshView, setRefresh, setUpdate, updateView } from '@mvtjs/pixi';
import { connectScene } from './connect-scene';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('connectScene', () => {
    it('walks the scene when the 2D stage around the view is walked', () => {
        const calls: string[] = [];
        const stage = new Container();
        const view = connectScene(new View3D());
        stage.addChild(view);
        setRefresh(stage, () => void calls.push('stage'));
        const mesh = new Container3D({ label: 'mesh' });
        setRefresh(mesh, () => void calls.push('mesh'));
        view.root.addChild(mesh);
        const deltas: number[] = [];
        setUpdate(mesh, (deltaMs) => void deltas.push(deltaMs));

        updateView(stage, 16);
        refreshView(stage);

        expect(deltas).toEqual([16]);
        expect(calls).toEqual(['stage', 'mesh']);
    });
});

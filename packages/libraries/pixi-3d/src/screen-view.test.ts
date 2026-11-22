import { View3D } from '@pixi/3d';
import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { refreshView, setRefresh, setUpdate, updateView } from '@mvtjs/utils';
import { connectScene } from './connect-scene';
import { destroyAndFindLeaks } from './destroy-and-find-leaks';
import { ScreenView } from './screen-view';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// These tests run in Node, without a renderer, so the texture itself isn't
// drawn. A visual test of a view that holds a screen checks the drawing.
describe('ScreenView', () => {
    it('updates and refreshes its content along with the stage that holds its scene', () => {
        const board = new Container();
        const deltas: number[] = [];
        let refreshes = 0;
        setUpdate(board, (deltaMs) => void deltas.push(deltaMs));
        setRefresh(board, () => void refreshes++);
        const view = connectScene(new View3D());
        view.root.addChild(ScreenView({ content: board, contentWidth: 16, contentHeight: 16, width: 2, height: 2 }));
        const stage = new Container({ children: [view] });

        updateView(stage, 16);
        refreshView(stage);

        expect(deltas).toEqual([16]);
        expect(refreshes).toBe(1);
    });

    it('destroys its content, and frees its plane, material and texture, when it is destroyed', () => {
        const board = new Container();
        const screen = ScreenView({ content: board, contentWidth: 16, contentHeight: 16, width: 2, height: 2, isLit: true });

        expect(destroyAndFindLeaks(screen)).toEqual([]);
        expect(board.destroyed).toBe(true);
    });
});

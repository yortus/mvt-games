import { Container } from 'pixi.js';
import { canvasTest } from 'v-snap';
import { LineCountsView } from '../line-counts-view';
import { GRID_SIZE } from '../view-constants';

const SIZE = { width: GRID_SIZE + 40, height: GRID_SIZE + 40, pixelArt: false };

// The first row and the last column at the fewest they may keep, in red
canvasTest('with lines at their fewest', SIZE, () => {
    const view = new Container();
    const counts = LineCountsView({
        isShown: () => true,
        givensInRow: (row) => (row === 0 ? 2 : 3 + (row % 4)),
        givensInColumn: (column) => (column === 8 ? 2 : 7 - (column % 3)),
        fewestPerLine: () => 2,
    });
    counts.position.set(30, 30);
    view.addChild(counts);
    return view;
});

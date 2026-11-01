import { Container, Graphics } from 'pixi.js';
import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'v-snap';
import type { Demo } from '../../models';
import type { ScreenPoint } from '../pointer-view-model';
import { PointerView } from '../pointer-view';
import { PAPER_COLOR } from '../view-constants';

// Drawn large, so the arrow's shape can be seen. The show comes in for 600 ms, then a tap touches down for 150 ms
const SIZE = { width: 300, height: 300, pixelArt: false };
const ZOOM = 2.5;
const HERE: ScreenPoint = { x: 40, y: 40 };
const THERE: ScreenPoint = { x: 96, y: 40 };

canvasTest('coming in to tap', SIZE, () => pose([{ kind: 'tap', targets: [HERE] }], 540));
canvasTest('touching down, with a ripple', SIZE, () => pose([{ kind: 'tap', targets: [HERE] }], 680));
canvasTest('partway through a drag, with a trail', SIZE, () => pose([{ kind: 'drag', targets: [HERE, THERE] }], 1300));
// A hold touches down for 150 ms, then stays down 1,100 more while its ring fills
canvasTest('holding, its ring half filled', SIZE, () => pose([{ kind: 'hold', targets: [HERE] }], 1300));

/** The pointer showing `demo`, `ms` into its show, on paper, zoomed in on its start. */
async function pose(demo: Demo<ScreenPoint>, ms: number): Promise<Container> {
    const view = new Container();
    view.addChild(new Graphics().rect(0, 0, SIZE.width, SIZE.height).fill(PAPER_COLOR));
    const zoomed = new Container();
    zoomed.scale.set(ZOOM);
    zoomed.position.set(-(HERE.x - 20) * ZOOM, -(HERE.y - 30) * ZOOM);
    zoomed.addChild(PointerView({ demo: () => demo, demosShown: () => 1, findPoint: (point) => point }));
    view.addChild(zoomed);
    await advanceTime(ms, view);
    return view;
}

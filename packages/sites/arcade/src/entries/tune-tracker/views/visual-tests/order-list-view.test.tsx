import { canvasTest } from 'v-snap';
import { TUNES } from '#tunes';
import { textures } from '../../data';
import { OrderListView } from '../order-list-view';
import { createPixelFont } from '../pixel-font';
import { ORDER_WIDTH, PANELS_HEIGHT } from '../view-constants';

const SIZE = { width: ORDER_WIDTH, height: PANELS_HEIGHT, pixelArt: true };
// The first tune's order is longer than the panel, and loops back to its third entry
const SONG = TUNES[0].song;

async function poseOrder(orderIndex: number, isPlaying: boolean): Promise<ReturnType<typeof OrderListView>> {
    await textures.load();
    const font = createPixelFont({ sheet: textures.get().font });
    return OrderListView({ font, width: ORDER_WIDTH, height: PANELS_HEIGHT, song: () => SONG, orderIndex: () => orderIndex, isPlaying: () => isPlaying });
}

canvasTest('at the start, stopped', SIZE, () => poseOrder(0, false));
// The list scrolls to keep the entry playing in its middle, and stops at the end
canvasTest('in the middle, playing', SIZE, () => poseOrder(10, true));
canvasTest('at the end, playing', SIZE, () => poseOrder(SONG.order.length - 1, true));

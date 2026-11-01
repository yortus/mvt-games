import { canvasTest } from 'v-snap';
import { TUNES } from '#tunes';
import { textures } from '../../data';
import { createPixelFont } from '../pixel-font';
import { TuneListView } from '../tune-list-view';
import { PANELS_HEIGHT, TUNES_WIDTH } from '../view-constants';

const SIZE = { width: TUNES_WIDTH, height: PANELS_HEIGHT, pixelArt: true };

async function poseList(tuneIndex: number, isPlaying: boolean): Promise<ReturnType<typeof TuneListView>> {
    await textures.load();
    const font = createPixelFont({ sheet: textures.get().font });
    const names = TUNES.map((tune) => tune.name);
    return TuneListView({ font, width: TUNES_WIDTH, height: PANELS_HEIGHT, names, tuneIndex: () => tuneIndex, isPlaying: () => isPlaying, onTuneChosen: () => {} });
}

canvasTest('with the first tune chosen', SIZE, () => poseList(0, false));
// The tune playing is marked, as well as on the bar
canvasTest('with a tune playing', SIZE, () => poseList(3, true));

import { canvasTest } from 'v-snap';
import { TUNES } from '#tunes';
import { textures } from '../../data';
import { createPixelFont } from '../pixel-font';
import { SongPanelView } from '../song-panel-view';
import { PANELS_HEIGHT, SONG_WIDTH } from '../view-constants';

const SIZE = { width: SONG_WIDTH, height: PANELS_HEIGHT, pixelArt: true };

async function posePanel(tuneIndex: number): Promise<ReturnType<typeof SongPanelView>> {
    await textures.load();
    const font = createPixelFont({ sheet: textures.get().font });
    return SongPanelView({ font, width: SONG_WIDTH, height: PANELS_HEIGHT, tune: () => TUNES[tuneIndex] });
}

// A song that sets how the chip sounds
canvasTest('a song that sets its sound', SIZE, () => posePanel(TUNES.findIndex((tune) => tune.song.character !== undefined)));
canvasTest('the first tune', SIZE, () => posePanel(0));

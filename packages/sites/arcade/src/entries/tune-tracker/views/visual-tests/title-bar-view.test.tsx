import { canvasTest } from 'v-snap';
import { textures } from '../../data';
import { createPixelFont } from '../pixel-font';
import { TitleBarView } from '../title-bar-view';
import { SCREEN_WIDTH, TITLE_HEIGHT } from '../view-constants';

const SIZE = { width: SCREEN_WIDTH, height: TITLE_HEIGHT, pixelArt: true };

async function poseBar(isPlaying: boolean, playedMs: number, orderIndex: number, row: number): Promise<ReturnType<typeof TitleBarView>> {
    await textures.load();
    const font = createPixelFont({ sheet: textures.get().font });
    return TitleBarView({
        font,
        width: SCREEN_WIDTH,
        height: TITLE_HEIGHT,
        isPlaying: () => isPlaying,
        playedMs: () => playedMs,
        orderIndex: () => orderIndex,
        row: () => row,
        onPlayPressed: () => {},
    });
}

canvasTest('stopped', SIZE, () => poseBar(false, 0, 0, 0));
// The order entry and the row in hex, as the pattern shows them, and the time in minutes and seconds
canvasTest('playing', SIZE, () => poseBar(true, 75_400, 0x12, 0x3c));

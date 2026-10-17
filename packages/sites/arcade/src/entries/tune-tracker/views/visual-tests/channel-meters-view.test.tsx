import { AUDIO90_SCOPE_LENGTH, AUDIO90_SCOPE_PANS, AUDIO90_SCOPE_POINTS } from '@mvtjs/chiptune';
import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'v-snap';
import { TUNES } from '#tunes';
import { textures } from '../../data';
import { ChannelMetersView } from '../channel-meters-view';
import { createPatternSheet } from '../pattern-sheet';
import { createPixelFont } from '../pixel-font';
import { METERS_HEIGHT, SCREEN_WIDTH } from '../view-constants';

const SIZE = { width: SCREEN_WIDTH, height: METERS_HEIGHT, pixelArt: true };

async function poseMeters(scope: Float32Array): Promise<ReturnType<typeof ChannelMetersView>> {
    await textures.load();
    const font = createPixelFont({ sheet: textures.get().font });
    const sheet = createPatternSheet({ song: TUNES[0].song });
    const view = ChannelMetersView({ font, height: METERS_HEIGHT, sheet: () => sheet, scope });
    // A few frames, for the levels to reach the voices' peaks
    await advanceTime(100, view);
    return view;
}

canvasTest('with every voice silent', SIZE, () => poseMeters(new Float32Array(AUDIO90_SCOPE_LENGTH)));
// Each voice a wave of its own, louder from left to right, panned from left to right: the
// scopes show each wave at the same height, scaled to its own peak, and the levels and pans differ
canvasTest('with each voice playing', SIZE, () => poseMeters(createScope()));

/** A scope in which voice v plays a sine of v + 1 cycles, at a level and a pan that rise with v. */
function createScope(): Float32Array {
    const scope = new Float32Array(AUDIO90_SCOPE_LENGTH);
    const voices = TUNES[0].song.channelCount;
    for (let v = 0; v < voices; v++) {
        const level = 0.05 + 0.4 * v / voices;
        for (let i = 0; i < AUDIO90_SCOPE_POINTS; i++) scope[v * AUDIO90_SCOPE_POINTS + i] = level * Math.sin(2 * Math.PI * (v + 1) * i / AUDIO90_SCOPE_POINTS);
        scope[AUDIO90_SCOPE_PANS + v] = -1 + 2 * v / (voices - 1);
    }
    return scope;
}

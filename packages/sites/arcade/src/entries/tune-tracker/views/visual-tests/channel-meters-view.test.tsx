import { AUDIO90_VOICE_COUNT, type Scope, SCOPE_POINTS } from 'audio90/tracker';
import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'v-snap';
import { TUNES } from '#tunes';
import { textures } from '../../data';
import { ChannelMetersView } from '../channel-meters-view';
import { createPatternSheet } from '../pattern-sheet';
import { createPixelFont } from '../pixel-font';
import { METERS_HEIGHT, SCREEN_WIDTH } from '../view-constants';

const SIZE = { width: SCREEN_WIDTH, height: METERS_HEIGHT, pixelArt: true };

async function poseMeters(scope: Scope): Promise<ReturnType<typeof ChannelMetersView>> {
    await textures.load();
    const font = createPixelFont({ sheet: textures.get().font });
    const sheet = createPatternSheet({ song: TUNES[0].song });
    const view = ChannelMetersView({ font, height: METERS_HEIGHT, sheet: () => sheet, scope });
    // A few frames, for the levels to reach the voices' peaks
    await advanceTime(100, view);
    return view;
}

canvasTest('with every voice silent', SIZE, () => poseMeters(createSilentScope()));
// Each voice a wave of its own, louder from left to right, panned from left to right: the
// scopes show each wave at the same height, scaled to its own peak, and the levels and pans differ
canvasTest('with each voice playing', SIZE, () => poseMeters(createPlayingScope()));

/** A scope of an Audio90's voices, every one silent, as a chip fills one. */
function createSilentScope(): Scope {
    return { voiceCount: AUDIO90_VOICE_COUNT, points: new Float32Array(AUDIO90_VOICE_COUNT * SCOPE_POINTS), pans: new Float32Array(AUDIO90_VOICE_COUNT), destroy: () => undefined };
}

/** A scope in which voice v plays a sine of v + 1 cycles, at a level and a pan that rise with v. */
function createPlayingScope(): Scope {
    const scope = createSilentScope();
    const voices = TUNES[0].song.channelCount;
    for (let v = 0; v < voices; v++) {
        const level = 0.05 + 0.4 * v / voices;
        for (let i = 0; i < SCOPE_POINTS; i++) scope.points[v * SCOPE_POINTS + i] = level * Math.sin(2 * Math.PI * (v + 1) * i / SCOPE_POINTS);
        scope.pans[v] = -1 + 2 * v / (voices - 1);
    }
    return scope;
}

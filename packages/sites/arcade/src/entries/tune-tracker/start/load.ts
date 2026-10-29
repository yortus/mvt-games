import { createScope, prepareAudio90Samples } from 'audio90';
import { INSTRUMENT_NAMES, SAMPLES, TUNES } from '#tunes';
import { definePixiLoader, type EntrySession } from '../../../entry-types';
import { textures } from '../data';
import { createTrackerModel } from '../models';
import { createPixelFont, SCREEN_HEIGHT, SCREEN_WIDTH, TrackerView } from '../views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Loads the Tune Tracker's font and bounces the tunes' samples, and returns
 * how to start it. It plays on the Audio90, and is drawn with Pixi, as pixel
 * art. The model advances only the time the tune has played. Then the views
 * play the tune on the chip, and show where it is.
 */
export const load = definePixiLoader(async () => {
    await textures.load();
    prepareAudio90Samples(SAMPLES);

    return {
        kind: 'pixi',
        soundChip: 'audio90',
        pixelArt: true,
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        // The thumbnail shows the first tune a few bars in
        thumbnailAdvanceMs: THUMBNAIL_ADVANCE_MS,
        // Play is pressed once, as the advance starts: a second press would stop the tune
        thumbnailInput: (session, elapsedMs) => {
            if (elapsedMs === 0) session.inputConfig?.onPrimaryButtonChanged?.(true);
        },

        start({ stage, music }): EntrySession {
            const model = createTrackerModel({ tuneCount: TUNES.length });
            const font = createPixelFont({ sheet: textures.get().font });
            // A scope costs the audio thread a little, so one is attached only while the Tune Tracker runs
            const scope = createScope(music);
            const view = TrackerView({ model, music, scope, tunes: TUNES, instrumentNames: INSTRUMENT_NAMES, font });
            stage.addChild(view);

            return {
                // The host ticks the view with the rest of the stage
                update(deltaMs: number): void {
                    model.update(deltaMs);
                },
                destroy(): void {
                    scope.destroy();
                    stage.removeChild(view);
                    view.destroy({ children: true });
                },
                inputConfig: {
                    onYDirectionChanged(direction) {
                        if (direction !== 'none') model.moveChoice(direction === 'up' ? -1 : 1);
                    },
                    onXDirectionChanged(direction) {
                        if (direction !== 'none') model.moveChoice(direction === 'left' ? -1 : 1);
                    },
                    onPrimaryButtonChanged(isPressed) {
                        if (isPressed) model.playOrStop();
                    },
                },
            };
        },
    };
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Long enough for the first tune to reach its keys, after its four patterns of drums and bass. */
const THUMBNAIL_ADVANCE_MS = 9000;

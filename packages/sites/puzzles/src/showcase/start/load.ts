import { Assets, type Texture } from 'pixi.js';
import { definePixiLoader, type EntrySession, type EntryStarter, type PlayRect } from '@mvtjs/site-kit/entry-types';
import { createLiveEntriesHost, fitShowcaseWidth } from '@mvtjs/site-kit/showcase';
import { toDayNumber } from '../../shared';
import { PUZZLE_ENTRIES, TURN_MS } from '../data';
import { createGameModel } from '../models';
import { DESK_SHADOW, GameView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../views';
import { showcase } from './showcase';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns how to start the paper. It loads every puzzle's picture, for the
 * boxes on the pages. A puzzle's code loads as its spread opens, so its box
 * can be framed exactly where the site's page will play it.
 */
export const load = definePixiLoader(async () => {
    const pictures = await Promise.all(PUZZLE_ENTRIES.map((each) => Assets.load<Texture>(each.thumbnail)));
    const puzzleAspects = PUZZLE_ENTRIES.map((each) => each.screenWidth / each.screenHeight);
    // The paper lays itself out to fill the site's page's area, at its own height
    let viewWidth = SCREEN_WIDTH;

    return {
        kind: 'pixi',
        // The pages rustle as they turn
        soundChip: 'audio90',
        get screenWidth() {
            return viewWidth;
        },
        screenHeight: SCREEN_HEIGHT,
        fitTo(width, height) {
            viewWidth = fitShowcaseWidth({ areaWidth: width, areaHeight: height, height: SCREEN_HEIGHT });
        },
        backgroundColor: DESK_SHADOW,
        // PixiJS 3D must be imported before the renderer starts
        draws3d: true,
        // A touch screen turns the pages with sweeps and taps on the paper, so it doesn't need buttons
        arcadeControls: 'keys-only',
        // The paper opened at its first spread, with a puzzle on it
        thumbnailAdvanceMs: TURN_MS + 200,
        thumbnailInput: (controls, elapsedMs) => {
            controls.setXDirection('script', elapsedMs < 100 ? 'right' : 'none');
        },

        start({ stage, controls, sfx, launcher, isInPage }): EntrySession {
            const model = createGameModel({ day: isInPage === true ? findToday() : SHOWCASE_DAY, puzzleAspects });
            // Puzzles never run live on the paper. The host launches the one leant in to, and calls `onPlayEnded` once the reader has left it
            const puzzleHost = createLiveEntriesHost({
                showcaseId: showcase.id,
                entries: PUZZLE_ENTRIES,
                launcher,
                distanceTo: () => Infinity,
                maxLive: 0,
                startDistance: 0,
                stopDistance: 0,
                gameOverMs: 0,
                indexInPlay: () => (model.mode === 'playing' ? model.puzzleInPlay : undefined),
                onPlayEnded: model.stopPlaying,
            });
            // Each puzzle's code, once loaded as its spread opens. Where the site's page plays a puzzle depends on its
            // starter, such as whether it has touch controls, so the box is framed with it
            const starters: (EntryStarter | undefined)[] = PUZZLE_ENTRIES.map(() => undefined);
            const isLoading: boolean[] = PUZZLE_ENTRIES.map(() => false);
            const playRectAt = (index: number): PlayRect | undefined => launcher?.playRectFor(PUZZLE_ENTRIES[index].id, starters[index]);
            const view = GameView({ model, controls, puzzles: PUZZLE_ENTRIES, pictures, playRectAt, sfx, viewWidth: () => viewWidth });
            stage.addChild(view);

            return {
                update(deltaMs: number): void {
                    model.update(deltaMs);
                    loadPuzzleOnSpread();
                    puzzleHost.update(deltaMs);
                },
                destroy(): void {
                    puzzleHost.destroy();
                    stage.removeChild(view);
                    view.destroy({ children: true });
                },
            };

            /** Loads the code of the puzzle on the spread open, in the site's page, unless it's loaded or loading. */
            function loadPuzzleOnSpread(): void {
                const index = model.puzzleOnSpread;
                if (launcher === undefined || index === undefined || starters[index] !== undefined || isLoading[index]) return;
                isLoading[index] = true;
                PUZZLE_ENTRIES[index].load().then((starter) => {
                    starters[index] = starter;
                }).catch(() => {
                    // Its box is framed without it, and the launch will say what went wrong
                    isLoading[index] = false;
                });
            }
        },
    };
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Started headless, for the thumbnail or a visual test, the paper is a fixed
 * day's, so its picture is the same whenever it's taken.
 */
const SHOWCASE_DAY = toDayNumber({ year: 2026, month: 11, day: 21 });

/** Today, where the reader is, from the device's clock and time zone. */
function findToday(): number {
    const now = new Date();
    return toDayNumber({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
}

import { Assets, type Container, type Texture } from 'pixi.js';
import { definePixiLoader, type EntrySession } from '@mvtjs/site-kit/entry-types';
import { createArcadeControls } from '@mvtjs/site-kit/input';
import { createLiveEntriesHost, fitShowcaseWidth } from '@mvtjs/site-kit/showcase';
import { ATTRACT_GAME_OVER_MS, ATTRACT_START_DISTANCE, ATTRACT_STOP_DISTANCE, CABINET_ENTRIES, MAX_ATTRACT_GAMES } from '../data';
import { createGameModel } from '../models';
import { GameView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../views';
import { showcase } from './showcase';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns how to start the Arcade Hall. It loads every game's picture, for
 * the cabinets' idle screens. A game's code loads as the visitor comes near
 * its cabinet.
 */
export const load = definePixiLoader(async () => {
    // The games, then the hall itself, in the cabinet at the far end
    const entries = [...CABINET_ENTRIES, showcase];
    const thumbnails = await Promise.all(entries.map((each) => Assets.load<Texture>(each.thumbnail)));
    // The hall lays itself out to fill the page's area, at its own height. A hall on its own cabinet's screen keeps this shape
    let viewWidth = SCREEN_WIDTH;

    return {
        kind: 'pixi',
        // The meadow outside the last hall has the sounds of a river and birds
        soundChip: 'audio90',
        get screenWidth() {
            return viewWidth;
        },
        screenHeight: SCREEN_HEIGHT,
        fitTo(width, height) {
            viewWidth = fitShowcaseWidth({ areaWidth: width, areaHeight: height, height: SCREEN_HEIGHT });
        },
        // PixiJS 3D must be imported before the renderer starts. A game in a cabinet draws with the hall's renderer
        draws3d: true,
        arcadeControls: { showDpad: true, showPrimary: true, primaryLabel: 'Play' },
        // A few steps into the hall, looking down the aisle between the cabinets
        thumbnailAdvanceMs: 800,
        thumbnailInput: (controls, elapsedMs) => {
            controls.setYDirection('script', elapsedMs < 500 ? 'up' : 'none');
        },

        start({ stage, controls, sfx, launcher }): EntrySession {
            const gameModel = createGameModel({ cabinetCount: CABINET_ENTRIES.length });

            /**
             * Starts the hall, standing still at its entrance, on the hall cabinet's
             * screen. It doesn't run any games, and its own hall cabinet shows its picture.
             */
            function startHallOnScreen(screenStage: Container): EntrySession {
                const screenModel = createGameModel({ cabinetCount: CABINET_ENTRIES.length });
                const screenControls = createArcadeControls();
                const screenView = GameView({
                    model: screenModel,
                    controls: screenControls,
                    entries,
                    thumbnails,
                    gameAt: () => undefined,
                    playRectAt: () => undefined,
                    showsHud: false,
                    hasMeadow: false,
                    // One hall deeper than the hall it's in, as it will be once the player steps inside
                    depth: () => gameModel.depth + 1,
                    sfx: undefined,
                });
                screenStage.addChild(screenView);
                return {
                    update: screenModel.update,
                    destroy(): void {
                        screenControls.destroy();
                        screenStage.removeChild(screenView);
                        screenView.destroy({ children: true });
                    },
                };
            }

            // The cabinets near the player run their games, while the player walks round a hall that has its cabinets
            const cabinetHost = createLiveEntriesHost({
                showcaseId: showcase.id,
                entries,
                launcher,
                distanceTo: (index) => {
                    if (gameModel.mode === 'playing' || !gameModel.hasCabinets) return Infinity;
                    const cabinet = gameModel.cabinets[index];
                    return Math.hypot(cabinet.x - gameModel.playerX, cabinet.z - gameModel.playerZ);
                },
                maxLive: MAX_ATTRACT_GAMES,
                startDistance: ATTRACT_START_DISTANCE,
                stopDistance: ATTRACT_STOP_DISTANCE,
                gameOverMs: ATTRACT_GAME_OVER_MS,
                indexInPlay: () => (gameModel.mode === 'playing' ? gameModel.cabinetInPlay?.index : undefined),
                onPlayEnded: gameModel.stopPlaying,
                ownIndex: gameModel.hallCabinet.index,
                startOwnScreen: startHallOnScreen,
            });
            const gameView = GameView({
                model: gameModel,
                controls,
                entries,
                thumbnails,
                gameAt: cabinetHost.liveAt,
                playRectAt: cabinetHost.playRectAt,
                showsHud: true,
                hasMeadow: true,
                depth: () => gameModel.depth,
                sfx,
                // The views follow the width as it changes, so the session needs no resize of its own
                viewWidth: () => viewWidth,
            });
            stage.addChild(gameView);

            return {
                // The attract games are part of the hall, so their models advance with the hall's,
                // and their views tick with the hall's scene, through their cabinets' screens
                update(deltaMs: number): void {
                    gameModel.update(deltaMs);
                    cabinetHost.update(deltaMs);
                },
                destroy(): void {
                    cabinetHost.destroy();
                    stage.removeChild(gameView);
                    gameView.destroy({ children: true });
                },
            };
        },
    };
});

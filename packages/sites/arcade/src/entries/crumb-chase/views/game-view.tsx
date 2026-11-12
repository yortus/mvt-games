/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { isTouchDevice } from '@mvtjs/site-kit/device';
import type { ArcadeControls } from '@mvtjs/site-kit/input';
import { ArcadeControlsInputView, SwipeInputView } from '@mvtjs/site-kit/input/pixi';
import { OverlayView } from '@mvtjs/site-kit/shared';
import type { MusicChip, SfxChip } from '@mvtjs/site-kit/sound';
import { describeControl } from '@mvtjs/site-kit/input';
import { List } from '@mvtjs/pixi';
import type { GameModel } from '../models';
import { MAZE_ROWS, MAZE_COLS } from '../data';
import { AudioView } from './audio-view';
import { TILE_SIZE, CAT_COLORS, SCREEN_HEIGHT, SCREEN_WIDTH } from './view-constants';
import { MazeView } from './maze-view';
import { MouseView } from './mouse-view';
import { CatView } from './cat-view';
import { HudView } from './hud-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    /** The game to draw and play the sounds of. */
    model: GameModel;
    /** The chip the game's music plays on. It is the view's output, not model state, so the view reads it once. */
    music: MusicChip<'audio80'>;
    /** The chip the game's sound effects play on, read once as `music` is. */
    sfx: SfxChip<'audio80'>;
    /** The arcade controls, which the host passes to the game as it starts. */
    controls: ArcadeControls;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The whole game: the maze and the mouse, the HUD below, the overlay, and the
 * cats, drawn last (so above the overlay, as they always have been). The
 * cats are a `<List>`; each takes its color from its index. Its audio view
 * plays the music and the nibbles. On a touch screen, a swipe anywhere on
 * the screen steers the mouse, as an arrow key does: it turns that way at
 * the next corner that opens that way. The overlay's own taps come first.
 */
export function GameView(bindings: GameViewBindings): Container {
    const { model, music, sfx, controls } = bindings;
    const canvasW = MAZE_COLS * TILE_SIZE;
    const canvasH = MAZE_ROWS * TILE_SIZE;
    const isTouch = isTouchDevice();
    const restartHint = isTouch ? 'Tap to restart' : `Press ${describeControl('restart')} to restart`;
    const gameOverText = `GAME OVER\n\n${restartHint}`;
    const winText = `YOU WIN!\n\n${restartHint}`;

    return (
        <container>
            {/* The keys steer the mouse, and a way let go of leaves it heading the same way */}
            <ArcadeControlsInputView
                controls={controls}
                onXDirectionChanged={(direction) => { if (direction !== 'none') model.direction = direction; }}
                onYDirectionChanged={(direction) => { if (direction !== 'none') model.direction = direction; }}
                onRestartPressed={model.startNewRun}
            />
            {/* Behind everything, so the overlay takes its own taps; it reaches past the screen, to the space round it */}
            <SwipeInputView
                isEnabled={isTouch}
                x={-SCREEN_WIDTH * 2}
                y={-SCREEN_HEIGHT}
                width={SCREEN_WIDTH * 5}
                height={SCREEN_HEIGHT * 4}
                swipeDistance={SWIPE_DISTANCE}
                onSwiped={(direction) => { model.direction = direction; }}
            />
            <AudioView
                music={music}
                sfx={sfx}
                phase={() => model.phase}
                remainingCrumbs={() => model.maze.remainingCrumbs}
                totalCrumbs={model.maze.totalCrumbs}
            />
            <MazeView
                tileSize={() => TILE_SIZE}
                rows={() => MAZE_ROWS}
                cols={() => MAZE_COLS}
                tileKindAt={(r, c) => model.maze.tileAt(r, c)}
                isCrumbAt={(r, c) => model.maze.isCrumb(r, c)}
                gamePhase={() => model.phase}
            />
            <MouseView
                row={() => model.mouse.row}
                col={() => model.mouse.col}
                direction={() => model.mouse.direction}
                tileSize={() => TILE_SIZE}
            />
            <container y={canvasH}>
                <HudView score={() => model.score} hint={isTouch ? 'Swipe to steer' : ''} width={canvasW} />
            </container>
            <OverlayView
                font="pixel"
                width={canvasW}
                height={canvasH}
                isVisible={() => model.phase !== 'playing'}
                text={() => (model.phase === 'game-over' ? gameOverText : winText)}
                onPressed={model.startNewRun}
            />
            <List items={() => model.cats}>
                {(cat, index) => (
                    <CatView
                        row={() => cat().row}
                        col={() => cat().col}
                        direction={() => cat().direction}
                        color={() => CAT_COLORS[index] ?? CAT_COLORS[0]}
                        tileSize={() => TILE_SIZE}
                    />
                )}
            </List>
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far a finger must slide to swipe, in the game's pixels: most of a tile. */
const SWIPE_DISTANCE = 14;

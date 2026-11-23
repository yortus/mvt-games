/** @jsxImportSource @mvtjs/pixi */

import type { Container, Texture } from 'pixi.js';
import { Scene3DView } from '@mvtjs/pixi-3d';
import { isTouchDevice } from '@mvtjs/site-kit/device';
import type { ArcadeEntry, PlayRect } from '@mvtjs/site-kit/entry-types';
import { type ArcadeControls, describeControl } from '@mvtjs/site-kit/input';
import { ArcadeControlsInputView } from '@mvtjs/site-kit/input/pixi';
import { type ScreenPlacement, ShowcaseHudView } from '@mvtjs/site-kit/showcase';
import type { SfxChip } from '@mvtjs/site-kit/sound';
import type { GameModel } from '../models';
import { AudioView } from './audio-view';
import { findMarginCell } from './find-margin-cell';
import { findPaperPoint, findReadingCentre } from './paper-camera';
import { PaperGesturesView } from './paper-gestures-view';
import { PaperSceneView } from './paper-scene-view';
import { placePuzzleScreen } from './place-puzzle-screen';
import { DESK_SHADOW, SCREEN_HEIGHT, SCREEN_WIDTH } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    readonly model: GameModel;
    /** The arcade controls, which the host passes to the game as it starts. */
    readonly controls: ArcadeControls;
    /** The puzzles in the paper, by their indexes in its list. */
    readonly puzzles: readonly ArcadeEntry[];
    /** Each puzzle's picture, by its index in the list, for its box on the page. */
    readonly pictures: readonly Texture[];
    /** Where the page will play the puzzle at `index`, in the paper's pixels, if the paper runs in the page. */
    readonly playRectAt: (index: number) => PlayRect | undefined;
    /** The chip the pages' rustle plays on. A paper started headless doesn't have one. */
    readonly sfx: SfxChip<'audio90'> | undefined;
    /** How wide the paper's view is, in pixels, as it fits itself to the page. Absent, it's `SCREEN_WIDTH`. Its height is always `SCREEN_HEIGHT`. */
    readonly viewWidth?: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The whole paper. It's a 3D scene, with help drawn over it in 2D. It also
 * wires the controls. Left and right, or a sweep across the paper, turn the
 * pages. The primary button, or a tap on a puzzle's box, leans in to the
 * puzzle on the spread, and the puzzle then plays over the paper. A tap on
 * either page elsewhere turns it.
 */
export function GameView({ model, controls, puzzles, pictures, playRectAt, sfx, viewWidth = DESIGN_WIDTH }: GameViewBindings): Container {
    const { layout } = model;
    const puzzleNames = puzzles.map((puzzle) => puzzle.name);
    const puzzleScreens: readonly (ScreenPlacement | undefined)[] = layout.spreads.map((spread, index) => {
        if (spread.puzzleIndex === undefined) return undefined;
        const puzzle = puzzles[spread.puzzleIndex];
        return placePuzzleScreen({ layout, spread: index, playWidth: puzzle.screenWidth, playHeight: puzzle.screenHeight });
    });
    const isTouch = isTouchDevice();
    const openHint = isTouch ? 'Swipe left to open the paper' : `Press ${describeControl('right')} to open the paper`;
    const backHint = isTouch ? 'Swipe right to turn back' : `Press ${describeControl('left')} to turn back`;
    const playHints = puzzleNames.map((name) => (isTouch ? `Tap ${name} to play it` : `Press ${describeControl('primary')} to play ${name}`));
    const pageLines = layout.spreads.map((_, s) => {
        if (s === 0) return '';
        if (s === layout.spreads.length - 1) return `Page ${layout.pages.length}`;
        return `Pages ${2 * s} and ${2 * s + 1}`;
    });
    const hint = (): string => {
        if (model.mode !== 'reading') return '';
        const puzzle = model.puzzleOnSpread;
        if (puzzle !== undefined) return playHints[puzzle];
        return model.spread === 0 ? openHint : backHint;
    };
    // Where a tap met the paper, reused for every tap
    const tapped = { x: 0, z: 0 };

    return (
        <container>
            <ArcadeControlsInputView
                controls={controls}
                onXDirectionChanged={(direction) => {
                    if (direction === 'right') model.turnForward();
                    else if (direction === 'left') model.turnBack();
                }}
                onPrimaryPressed={model.playPuzzle}
            />
            {/* The 3D scene is built by another JSX runtime, so it's a call, not a tag */}
            <Scene3DView
                scene={PaperSceneView({ model, puzzleNames, puzzlePictures: pictures, puzzleScreens, playRectAt, viewWidth })}
                width={viewWidth}
                height={SCREEN_HEIGHT}
                background={DESK_SHADOW}
                environment={{ skyColor: 0x5e574e, groundColor: 0x2a2018 }}
            />
            <PaperGesturesView
                width={viewWidth}
                height={SCREEN_HEIGHT}
                onSwipedLeft={model.turnForward}
                onSwipedRight={model.turnBack}
                onTapped={(x, y) => {
                    const marginCell = findMarginCellAt(x, y);
                    if (marginCell >= 0) model.markMarginCell(marginCell);
                    else if (isOnPuzzle(x, y)) model.playPuzzle();
                    else if (x > viewWidth() / 2) model.turnForward();
                    else model.turnBack();
                }}
            />
            {sfx === undefined
                ? undefined
                : (
                        <AudioView
                            sfx={sfx}
                            pagesTurned={() => model.pagesTurned}
                            turnPan={() => (model.turnDirection === 'forward' ? 1 : -1)}
                            marginMarksMade={() => model.marginGame.marksMade}
                        />
                    )}
            <ShowcaseHudView width={viewWidth} height={SCREEN_HEIGHT} hint={hint} cornerLine={() => (model.mode === 'reading' ? pageLines[model.spread] : '')} />
        </container>
    );

    /** The square of the margin game's grid at the point `x`, `y` in the view, in pixels, while the back page lies open, or -1. */
    function findMarginCellAt(x: number, y: number): number {
        if (!model.isMarginGameOpen) return -1;
        findPaperPoint(x, y, viewWidth(), findReadingCentre(model, viewWidth()), tapped);
        return findMarginCell(tapped.x, tapped.z);
    }

    /** Whether the point `x`, `y` in the view, in pixels, is on the box of the puzzle on the spread open. */
    function isOnPuzzle(x: number, y: number): boolean {
        const screen = puzzleScreens[model.spread];
        if (screen === undefined) return false;
        findPaperPoint(x, y, viewWidth(), findReadingCentre(model, viewWidth()), tapped);
        return Math.abs(tapped.x - screen.x) <= screen.width / 2 && Math.abs(tapped.z - screen.z) <= screen.height / 2;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The width the paper is designed around, for a paper that isn't fitted to the page, as in a test. */
const DESIGN_WIDTH = (): number => SCREEN_WIDTH;

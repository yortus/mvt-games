/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { createComputed } from '@mvtjs/utils';
import type { SfxChip } from '#shared';
import { LEVELS } from '../data';
import type { DiggerModel, DiggerPhase, Playback } from '../models';
import { ButtonView } from './button-view';
import { DiggerAudioView } from './digger-audio-view';
import { GridView } from './grid-view';
import { LineCountsView } from './line-counts-view';
import { PanelRowView } from './panel-row-view';
import { PhaseListView } from './phase-list-view';
import {
    BACKGROUND_COLOR, BUTTON_WIDTH, BUTTON_Y, DIM_TEXT_COLOR, GRID_X, GRID_Y, LEVEL_NAMES, LOGIC_COLOR, NUMBER_TEXTS, PANEL_WIDTH,
    PANEL_X, SCREEN_HEIGHT, SCREEN_WIDTH, TEXT_COLOR, WARNING_COLOR,
} from './view-constants';
import { toCaptionKey, writeCaption } from './write-caption';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DiggerViewBindings {
    model: DiggerModel;
    /** The chip the sound effects play on. */
    sfx: SfxChip<'audio90'>;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The whole screen: the grid on the left, with each line's count of givens
 * beside it, and a panel on the right. The panel shows the level asked for
 * and the level the puzzle came out at, the method's steps, a caption
 * saying what the last step did, and the counts. Along the bottom, buttons
 * choose the level, the speed, and a new puzzle.
 */
export function DiggerView(bindings: DiggerViewBindings): Container {
    const { model, sfx } = bindings;
    const caption = createComputed({ watch: () => toCaptionKey(model), compute: () => writeCaption(model) });
    const isMaking = () => model.phase === 'trying' || model.phase === 'seeding' || model.phase === 'filling';
    const givensText = createComputed({
        watch: { isMaking, givens: () => model.givensCount },
        compute: ({ isMaking, givens }) => (isMaking ? '-' : NUMBER_TEXTS[givens]),
    });
    const targetText = createComputed({
        watch: { isMaking, target: () => model.givensTarget },
        compute: ({ isMaking, target }) => (isMaking ? '-' : NUMBER_TEXTS[target]),
    });
    const movesText = createComputed({ watch: () => model.searchTries + model.searchRetreats, compute: String });
    const deadEndsText = createComputed({ watch: () => model.searchRetreats, compute: String });
    const gradeText = () => (model.grade === undefined ? '...' : LEVEL_NAMES[model.grade]);
    const gradeColor = () => (model.grade === undefined ? DIM_TEXT_COLOR : model.grade === model.level ? LOGIC_COLOR : WARNING_COLOR);
    const isPlayback = (playback: Playback) => () => model.playback === playback;
    const choosePlayback = (playback: Playback) => () => setPlayback(playback);
    // While shuffling, how far the last shuffle has moved. Otherwise nothing is moving
    const shuffleProgress = () => (model.phase === 'shuffling' && model.stepKind === 'shuffled' ? model.stepProgress : 1);
    const white = () => TEXT_COLOR;

    return (
        <container label="sudoku-digger">
            <graphics ref={(g) => g.rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill(BACKGROUND_COLOR)} />
            {/* The puzzles tried out of sight show dimmed, until one is chosen */}
            <container x={GRID_X} y={GRID_Y} alpha={() => (model.phase === 'trying' && !model.isGridChosen ? TRYING_ALPHA : 1)}>
                <GridView
                    digitAt={model.digitAt}
                    cellKindAt={model.cellKindAt}
                    digMarkAt={model.digMarkAt}
                    areDigMarksShown={() => model.phase === 'digging' || model.phase === 'shuffling'}
                    candidatesAt={model.candidatesAt}
                    eliminatedAt={model.eliminatedAt}
                    isHighlightedAt={model.isHighlightedAt}
                    isDifferentAt={model.isDifferentAt}
                    fullGridDigitAt={model.fullGridDigitAt}
                    focusCell={() => (model.phase === 'digging' ? model.focusCell : -1)}
                    testedCell={() => model.testedCell}
                    ownDigit={() => model.originalDigit}
                    rivalDigits={() => model.rivalDigits}
                    ruledOutDigits={() => model.ruledOutDigits}
                    testDigit={() => model.testDigit}
                    deadEnds={() => model.searchRetreats}
                    deadEndCell={() => model.lastSearchCell}
                    cellsNeeded={() => model.cellsNeeded}
                    neededCell={() => model.lastNeededCell}
                    cellsDug={() => model.cellsDug}
                    dugCell={() => model.lastDugCell}
                    dugDigit={() => model.lastDugDigit}
                    seedsPlaced={() => model.seedsPlaced}
                    seedCell={() => model.lastSeedCell}
                    placements={() => model.logicPlacements}
                    placedCell={() => model.techniqueCell}
                    shuffleKind={() => model.shuffleKind}
                    shuffleFirst={() => model.shuffleFirst}
                    shuffleSecond={() => model.shuffleSecond}
                    shuffleProgress={shuffleProgress}
                />
                <LineCountsView
                    isShown={() => model.phase === 'digging'}
                    givensInRow={model.givensInRow}
                    givensInColumn={model.givensInColumn}
                    fewestPerLine={() => model.fewestPerLine}
                />
            </container>
            <container x={PANEL_X} y={PANEL_Y}>
                <PanelRowView label="Asked for" value={() => LEVEL_NAMES[model.level]} color={white} width={PANEL_WIDTH} />
                <container y={ROW_HEIGHT}>
                    <PanelRowView label="Came out" value={gradeText} color={gradeColor} width={PANEL_WIDTH} />
                </container>
                <container y={PHASES_Y}>
                    <PhaseListView names={PHASE_NAMES} current={() => PHASE_ORDER.indexOf(model.phase)} />
                </container>
                <text y={CAPTION_Y} text={caption} style={CAPTION_STYLE} tint={TEXT_COLOR} />
                <container y={STATS_Y}>
                    <PanelRowView label="Puzzles tried" value={() => NUMBER_TEXTS[model.gridsTried]} color={white} width={PANEL_WIDTH} />
                    <container y={ROW_HEIGHT}>
                        <PanelRowView label="Givens" value={givensText} color={white} width={PANEL_WIDTH} />
                    </container>
                    <container y={ROW_HEIGHT * 2}>
                        <PanelRowView label="Keep at least" value={targetText} color={white} width={PANEL_WIDTH} />
                    </container>
                    <container y={ROW_HEIGHT * 3}>
                        <PanelRowView label="Each line keeps" value={() => NUMBER_TEXTS[model.fewestPerLine]} color={white} width={PANEL_WIDTH} />
                    </container>
                    <container y={ROW_HEIGHT * 4}>
                        <PanelRowView label="Search moves" value={movesText} color={white} width={PANEL_WIDTH} />
                    </container>
                    <container y={ROW_HEIGHT * 5}>
                        <PanelRowView label="Dead ends" value={deadEndsText} color={white} width={PANEL_WIDTH} />
                    </container>
                    <container y={ROW_HEIGHT * 6}>
                        <PanelRowView label="Restarts" value={() => NUMBER_TEXTS[model.restarts]} color={white} width={PANEL_WIDTH} />
                    </container>
                    <container y={ROW_HEIGHT * 7}>
                        <PanelRowView label="Cells dug" value={() => NUMBER_TEXTS[model.cellsDug]} color={white} width={PANEL_WIDTH} />
                    </container>
                    <container y={ROW_HEIGHT * 8}>
                        <PanelRowView
                            label="Cells kept"
                            value={() => NUMBER_TEXTS[model.cellsNeeded + model.cellsHeld]}
                            color={white}
                            width={PANEL_WIDTH}
                        />
                    </container>
                </container>
            </container>
            <container y={BUTTON_Y}>
                {LEVELS.map((level, i) => (
                    <ButtonView
                        x={BUTTONS_LEFT + i * BUTTON_STEP}
                        label={LEVEL_NAMES[level]}
                        isLit={() => model.level === level}
                        onPressed={() => model.chooseLevel(level)}
                    />
                ))}
                <ButtonView x={SPEEDS_LEFT} label="Step" isLit={isPlayback('paused')} onPressed={stepOnce} />
                <ButtonView x={SPEEDS_LEFT + BUTTON_STEP} label="Slow" isLit={isPlayback('slow')} onPressed={choosePlayback('slow')} />
                <ButtonView x={SPEEDS_LEFT + BUTTON_STEP * 2} label="Normal" isLit={isPlayback('normal')} onPressed={choosePlayback('normal')} />
                <ButtonView x={SPEEDS_LEFT + BUTTON_STEP * 3} label="Fast" isLit={isPlayback('fast')} onPressed={choosePlayback('fast')} />
                <ButtonView x={NEW_LEFT} label="New" isLit={() => false} onPressed={model.makeNewPuzzle} />
            </container>
            <DiggerAudioView
                sfx={sfx}
                phase={() => model.phase}
                seedsPlaced={() => model.seedsPlaced}
                seedCell={() => model.lastSeedCell}
                seedDigit={() => model.lastSeedDigit}
                searchTries={() => model.searchTries}
                searchRetreats={() => model.searchRetreats}
                searchCell={() => model.lastSearchCell}
                searchDigit={() => model.lastSearchDigit}
                restarts={() => model.restarts}
                cellsDug={() => model.cellsDug}
                dugCell={() => model.lastDugCell}
                dugDigit={() => model.lastDugDigit}
                cellsNeeded={() => model.cellsNeeded}
                testsFailed={() => model.testsFailed}
                cellsHeld={() => model.cellsHeld}
                focusCell={() => model.focusCell}
                shufflesDone={() => model.shufflesDone}
                logicPlacements={() => model.logicPlacements}
                placedCell={() => model.techniqueCell}
                placedDigit={() => model.techniqueDigit}
                logicReductions={() => model.logicReductions}
                needsGuessing={() => model.needsGuessing}
                puzzlesFinished={() => model.puzzlesFinished}
                gridsTried={() => model.gridsTried}
                isGridChosen={() => model.isGridChosen}
            />
        </container>
    );

    function setPlayback(playback: Playback): void {
        model.playback = playback;
    }

    /** Pauses the making if it is running, and takes it on one step. */
    function stepOnce(): void {
        model.playback = 'paused';
        model.step();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The method's steps, as the panel lists them, and the phase each is. A finished puzzle has done them all. */
const PHASE_NAMES: readonly string[] = ['Try', 'Seed', 'Fill', 'Dig', 'Shuffle', 'Grade'];
const PHASE_ORDER: readonly DiggerPhase[] = ['trying', 'seeding', 'filling', 'digging', 'shuffling', 'grading', 'finished'];

// The panel's layout, from its top, in pixels
const PANEL_Y = 20;
const ROW_HEIGHT = 15;
const PHASES_Y = 44;
const CAPTION_Y = 164;
const STATS_Y = 272;

/** How bright the puzzles tried out of sight show. */
const TRYING_ALPHA = 0.5;

// The buttons: the five levels, then the four speeds, then New
const BUTTON_STEP = BUTTON_WIDTH + 4;
const BUTTONS_LEFT = 12;
const SPEEDS_LEFT = BUTTONS_LEFT + BUTTON_STEP * 5 + 8;
const NEW_LEFT = SPEEDS_LEFT + BUTTON_STEP * 4 + 8;

const CAPTION_STYLE = {
    fontFamily: 'monospace',
    fontSize: 12,
    fill: 0xffffff,
    wordWrap: true,
    wordWrapWidth: PANEL_WIDTH,
    lineHeight: 16,
};

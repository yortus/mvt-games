/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { createComputed } from '@mvtjs/utils';
import type { SfxChip } from '#shared';
import { LEVELS } from '../sudoku-grid';
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
        watch: { isMaking, givens: () => model.digging.givensCount },
        compute: ({ isMaking, givens }) => (isMaking ? '-' : NUMBER_TEXTS[givens]),
    });
    const targetText = createComputed({
        watch: { isMaking, target: () => model.digging.givensTarget },
        compute: ({ isMaking, target }) => (isMaking ? '-' : NUMBER_TEXTS[target]),
    });
    const movesText = createComputed({ watch: () => model.search.tries.count + model.search.retreats.count, compute: String });
    const deadEndsText = createComputed({ watch: () => model.search.retreats.count, compute: String });
    const gradeText = () => (model.grade === undefined ? '...' : LEVEL_NAMES[model.grade]);
    const gradeColor = () => (model.grade === undefined ? DIM_TEXT_COLOR : model.grade === model.level ? LOGIC_COLOR : WARNING_COLOR);
    const isPlayback = (playback: Playback) => () => model.playback === playback;
    const choosePlayback = (playback: Playback) => () => model.choosePlayback(playback);
    // While shuffling, how far the last shuffle has moved. Otherwise nothing is moving
    const shuffleProgress = () => (model.phase === 'shuffling' && model.stepKind === 'shuffled' ? model.stepProgress : 1);
    const white = () => TEXT_COLOR;
    // The counts, a row each, down the foot of the panel
    const stats: readonly { label: string; value: () => string }[] = [
        { label: 'Puzzles tried', value: () => NUMBER_TEXTS[model.trying.gridsTried] },
        { label: 'Givens', value: givensText },
        { label: 'Keep at least', value: targetText },
        { label: 'Each line keeps', value: () => NUMBER_TEXTS[model.digging.fewestPerLine] },
        { label: 'Search moves', value: movesText },
        { label: 'Dead ends', value: deadEndsText },
        { label: 'Restarts', value: () => NUMBER_TEXTS[model.filling.restarts] },
        { label: 'Cells dug', value: () => NUMBER_TEXTS[model.digging.dug.count] },
        { label: 'Cells kept', value: () => NUMBER_TEXTS[model.digging.needed.count + model.digging.held.count] },
    ];

    return (
        <container label="sudoku-digger">
            <graphics ref={(g) => g.rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill(BACKGROUND_COLOR)} />
            {/* The puzzles tried out of sight show dimmed, until one is chosen */}
            <container x={GRID_X} y={GRID_Y} alpha={() => (model.phase === 'trying' && !model.trying.isGridChosen ? TRYING_ALPHA : 1)}>
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
                    focusCell={() => (model.phase === 'digging' ? model.digging.focusCell : -1)}
                    testedCell={() => model.digging.testedCell}
                    ownDigit={() => model.digging.originalDigit}
                    rivalDigits={() => model.digging.rivalDigits}
                    ruledOutDigits={() => model.digging.ruledOutDigits}
                    testDigit={() => model.digging.testDigit}
                    deadEnds={model.search.retreats}
                    needed={model.digging.needed}
                    dug={model.digging.dug}
                    seeds={model.filling.seeds}
                    placements={model.grading.placements}
                    shuffle={model.shuffling}
                    shuffleProgress={shuffleProgress}
                />
                <LineCountsView
                    isShown={() => model.phase === 'digging'}
                    givensInRow={model.digging.givensInRow}
                    givensInColumn={model.digging.givensInColumn}
                    fewestPerLine={() => model.digging.fewestPerLine}
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
                    {stats.map(({ label, value }, i) => (
                        <container y={ROW_HEIGHT * i}>
                            <PanelRowView label={label} value={value} color={white} width={PANEL_WIDTH} />
                        </container>
                    ))}
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
                seeds={model.filling.seeds}
                tries={model.search.tries}
                retreats={model.search.retreats}
                restarts={() => model.filling.restarts}
                dug={model.digging.dug}
                needed={model.digging.needed}
                failedTests={model.digging.failedTests}
                held={model.digging.held}
                shufflesDone={() => model.shuffling.count}
                placements={model.grading.placements}
                logicReductions={() => model.grading.reductions}
                needsGuessing={() => model.grading.needsGuessing}
                puzzlesFinished={() => model.puzzlesFinished}
                gridsTried={() => model.trying.gridsTried}
                isGridChosen={() => model.trying.isGridChosen}
            />
        </container>
    );

    /** Pauses the making if it is running, and takes it on one step. */
    function stepOnce(): void {
        model.choosePlayback('paused');
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

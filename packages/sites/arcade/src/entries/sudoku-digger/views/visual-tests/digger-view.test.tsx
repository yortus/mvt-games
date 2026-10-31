import { advanceTime } from '@mvtjs/pixi';
import { createHeadlessAudio90 } from 'audio90/headless';
import { canvasTest } from 'v-snap';
import type { Level } from '../../sudoku-grid';
import { createDiggerModel, type DiggerModel } from '../../models';
import { DiggerView } from '../digger-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

canvasTest('trying puzzles out of sight', SIZE, () => pose('hard', (model) => model.trying.gridsTried === 3 && !model.trying.isGridChosen));
canvasTest('a puzzle chosen', SIZE, () => pose('hard', (model) => model.trying.isGridChosen && model.phase === 'trying'));
canvasTest('seeding', SIZE, () => pose('easy', (model) => model.filling.seeds.count === 6));
canvasTest('filling the grid', SIZE, () => pose('easy', (model) => model.phase === 'filling' && model.search.tries.count === 40));
canvasTest('testing whether a cell can be dug', SIZE, () => pose('hardest', (model) => (
    model.phase === 'digging' && model.digging.dug.count >= 30 && model.stepKind === 'search-tried'
)));
canvasTest('a cell that must stay', SIZE, () => pose('hardest', (model) => model.stepKind === 'dig-needed' && model.digging.dug.count >= 30));
canvasTest('half way through a turn', SIZE, () => pose('medium', (model) => (
    model.shuffling.kind === 'turn' && model.stepKind === 'shuffled' && model.stepProgress >= 0.5
)));
canvasTest('grading, with pencil marks rubbed out', SIZE, () => pose('hard', (model) => (
    model.grading.technique !== undefined && model.grading.technique !== 'naked-single' && model.grading.technique !== 'hidden-single'
)));
canvasTest('finished', SIZE, () => pose('hard', (model) => model.phase === 'finished'));

/** The screen as a puzzle for `level` is made, at the first moment `isPosed` holds. */
async function pose(level: Level, isPosed: (model: DiggerModel) => boolean) {
    const model = createDiggerModel({ seed: SEED, level });
    // A headless chip makes no sound, and an image does not depend on what plays
    const view = DiggerView({ model, sfx: createHeadlessAudio90() });
    model.choosePlayback('fast');
    for (let i = 0; i < MAX_FRAMES && !isPosed(model); i++) await advanceTime(FRAME_MS, model, view);
    if (!isPosed(model)) throw new Error('The model never reached the pose');
    return view;
}

const SEED = 2026;
const FRAME_MS = 16;
/** Ten minutes of frames: far longer than any puzzle takes, even at normal speed. */
const MAX_FRAMES = 37_500;

import { type DiggerModel, type DiggerPhase, type Technique } from '../models';
import { COLUMN_OF, ROW_OF } from '../sudoku-grid';
import { LEVEL_NAMES } from './view-constants';

// The caption under the phases, which says what the last step did in plain
// words. It is written only when it changes, which `toCaptionKey` tells.

// ---------------------------------------------------------------------------
// Captions
// ---------------------------------------------------------------------------

/**
 * A number that changes whenever the caption does. Most steps get a caption
 * of their own. The search's moves come many to a frame, so they share one,
 * which stays while the search lasts.
 */
export function toCaptionKey(model: DiggerModel): number {
    if (model.stepKind !== 'search-tried' && model.stepKind !== 'search-retreated') return model.stepCount;
    return -1 - (PHASES.indexOf(model.phase) * 1000 + (model.digging.focusCell + 1) * 10 + model.digging.testDigit);
}

/** What the model's last step did, in a sentence or three. */
export function writeCaption(model: DiggerModel): string {
    const cell = model.digging.focusCell;
    const d = model.digging.originalDigit;
    const t = model.digging.testDigit;
    switch (model.stepKind) {
        case 'started':
            return `A new puzzle. Puzzles are made out of sight until one comes out ${LEVEL_NAMES[model.level]}.`;
        case 'grid-tried':
            return writeTry(model);
        case 'seed-placed':
            return 'Seeding: 11 random digits, each breaking no rule. A full grid will grow from them.';
        case 'search-tried':
        case 'search-retreated':
            if (model.phase === 'filling') return FILLING;
            if (model.phase === 'grading') return 'Guessing: the search finishes the puzzle.';
            return writeTesting(cell, d, t);
        case 'fill-gave-up':
            return 'The search took too long, so the grid is wiped. Starting again is quicker than searching on.';
        case 'fill-solved':
            return 'The grid is full. Next, digging: each cell is emptied, if the puzzle still has one solution.';
        case 'dig-chosen':
            return `Can the ${d} at ${nameCell(cell)} be dug out?`;
        case 'dig-held':
            return `No: row ${ROW_OF[cell] + 1} or column ${COLUMN_OF[cell] + 1} would keep fewer than ${model.digging.fewestPerLine} givens. The ${d} stays.`;
        case 'dig-only-digit':
            return 'Yes: no other digit could go there, so the puzzle still has one solution.';
        case 'dig-testing':
            return writeTesting(cell, d, t);
        case 'dig-test-failed':
            return `Not with a ${t}: it leads nowhere.`;
        case 'dig-needed':
            return `Yes: with a ${t} there, the search found another solution. Two solutions, so the ${d} must stay.`;
        case 'dig-dug':
            return `No other digit leads anywhere, so the ${d} goes. The puzzle still has one solution.`;
        case 'dig-enough':
            return `The puzzle is down to ${model.digging.givensCount} givens, its target. Digging stops.`;
        case 'dig-done':
            return `Every cell has been tried, and ${model.digging.givensCount} givens are left.`;
        case 'shuffled':
            return writeShuffle(model);
        case 'grade-marked':
            return 'Grading: pencil marks show what could go in each empty cell. Now it is solved as a person would solve it.';
        case 'grade-step':
            return writeReasoning(model);
        case 'grade-stuck':
            return 'Stuck: no technique makes progress. The rest needs guesswork, so the search finishes it.';
        case 'finished':
            return writeVerdict(model);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const PHASES: readonly DiggerPhase[] = ['trying', 'seeding', 'filling', 'digging', 'shuffling', 'grading', 'finished'];

const FILLING = 'Filling: the search fills the cell with the fewest choices first. At a dead end, it backs up.';

/** Each technique, as the verdict names it. */
const TECHNIQUE_NAMES: Readonly<Record<Technique, string>> = {
    'naked-single': 'a single',
    'hidden-single': 'a hidden single',
    'locked-candidates': 'locked candidates',
    'naked-pair': 'a pair',
    'hidden-pair': 'a hidden pair',
    'naked-triple': 'a triple',
};

const BOX_NAMES: readonly string[] = [
    'the top left box', 'the top box', 'the top right box',
    'the left box', 'the middle box', 'the right box',
    'the bottom left box', 'the bottom box', 'the bottom right box',
];

function writeTry(model: DiggerModel): string {
    const asked = LEVEL_NAMES[model.level];
    const tried = model.trying.triedGrade === undefined ? asked : LEVEL_NAMES[model.trying.triedGrade];
    const n = model.trying.gridsTried;
    if (!model.trying.isGridChosen) return `Trying puzzles out of sight: number ${n} came out ${tried}, not ${asked}.`;
    if (model.trying.triedGrade === model.level) return `Number ${n} came out ${asked}. Now watch it being made again, step by step.`;
    return `None of ${n} came out ${asked}. The nearest, which came out ${tried}, is made instead.`;
}

function writeTesting(cell: number, d: number, t: number): string {
    return `If a ${t} went at ${nameCell(cell)} instead of the ${d}, would the puzzle still have a solution? Searching...`;
}

function writeShuffle(model: DiggerModel): string {
    switch (model.shuffling.kind) {
        case 'digits':
            return `Shuffling: every ${model.shuffling.first} swaps with every ${model.shuffling.second}. The puzzle is just as hard, but looks new.`;
        case 'columns':
            return `Shuffling: columns ${model.shuffling.first + 1} and ${model.shuffling.second + 1} swap places, within their stack of boxes.`;
        case 'stacks':
            return 'Shuffling: two stacks of boxes swap places.';
        case 'turn':
        case undefined:
            return 'Shuffling: a quarter turn. The shuffles hide the order the cells were dug in.';
    }
}

function writeReasoning(model: DiggerModel): string {
    const d = model.grading.techniqueDigit;
    const unit = nameUnit(model.grading.techniqueUnit);
    switch (model.grading.technique) {
        case 'naked-single':
            return `Only a ${d} can go at ${nameCell(model.grading.techniqueCell)}.`;
        case 'hidden-single':
            return `In ${unit}, a ${d} fits only one cell.`;
        case 'locked-candidates':
            return model.grading.techniqueUnit >= 18
                ? `In ${unit}, a ${d} fits only the lit cells, which share a line. So a ${d} can't go elsewhere on that line.`
                : `In ${unit}, a ${d} fits only the lit cells, which share a box. So a ${d} can't go elsewhere in that box.`;
        case 'naked-pair':
            return `Two cells of ${unit} can only hold the same two digits. So no other cell there can hold them.`;
        case 'hidden-pair':
            return `In ${unit}, two digits fit only the two lit cells. So those cells can hold nothing else.`;
        case 'naked-triple':
            return `Three cells of ${unit} hold only three digits between them. So no other cell there can hold them.`;
        case undefined:
            return '';
    }
}

function writeVerdict(model: DiggerModel): string {
    const asked = LEVEL_NAMES[model.level];
    const graded = model.grade === undefined ? asked : LEVEL_NAMES[model.grade];
    const found = model.trying.gridsTried === 1 ? 'the first puzzle tried' : `puzzle ${model.trying.gridsTried} of those tried`;
    return `Done. Asked for ${asked}, it came out ${graded}: ${writeHardest(model)}. It was ${found}.`;
}

function writeHardest(model: DiggerModel): string {
    if (model.grading.needsGuessing) return 'it needs guesswork';
    if (model.grading.hardestTechnique === undefined) return 'it has nothing to solve';
    return `its hardest step is ${TECHNIQUE_NAMES[model.grading.hardestTechnique]}`;
}

function nameCell(cell: number): string {
    return `row ${ROW_OF[cell] + 1}, column ${COLUMN_OF[cell] + 1}`;
}

function nameUnit(unit: number): string {
    if (unit < 0) return 'the grid';
    if (unit < 9) return `row ${unit + 1}`;
    if (unit < 18) return `column ${unit - 9 + 1}`;
    return BOX_NAMES[unit - 18];
}

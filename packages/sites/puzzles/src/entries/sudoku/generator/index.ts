// Sudoku's puzzle maker, and the grid it works on. Sudoku plays its puzzles,
// and Sudoku Digger, a demo, shows it at work, dig by dig.

// The puzzle maker. A game loads it only when it asks for it
export { loadSudokuGenerator, type SudokuGenerator } from './load-sudoku-generator';
// The maker as a model, stepped a move at a time, for watching it work. Only
// its types here: its code loads with the maker, or from
// `@mvtjs/puzzles/sudoku-generator/models`, which Sudoku Digger imports
export type {
    CellDigging, CellEvent, CellKind, DiggerModel, DiggerModelOptions, DiggerPhase, DigMark, GeneratedSudoku, GenerateSudokuOptions, GridFilling,
    GridShuffling, Playback, PuzzleGrading, PuzzleTries, SearchMoves, ShuffleKind, StepKind, Technique,
} from './models';
// The grid's rules, its levels, and helpers for drawing it
export {
    ALL_DIGITS, BOX_OF, CELL_COUNT, COLUMN_OF, countDigits, DIGIT_TEXTS, drawGridLines, easeInOut, findCandidates, type GridLineStyle,
    hasDigit, isConsistent, isOneUnit, isSameUnit, type Level, LEVELS, lowestDigit, mixColors, PEER_COUNT, PEERS, pickDigit, ROW_OF,
    toDigitSet, UNIT_CELLS, UNIT_COUNT,
} from './sudoku-grid';

import type { GeneratedSudoku, GenerateSudokuOptions } from './models';

/** Makes a Sudoku puzzle at a level, the way `generateSudoku`, in Sudoku Digger's models, does. */
export type SudokuGenerator = (options: GenerateSudokuOptions) => GeneratedSudoku;

/**
 * Loads Sudoku Digger's puzzle maker, for a game that plays its puzzles.
 * It loads only when it is asked for, as an entry's code does, so the
 * Arcade's first load, which lists this entry, stays small.
 */
export async function loadSudokuGenerator(): Promise<SudokuGenerator> {
    return (await import('./models')).generateSudoku;
}

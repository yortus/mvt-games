import type { PuzzleLevel } from '../../../shared';

/** What makes a level of puzzle. Its name, and the levels' order, are the four every puzzle on the site has. */
export interface LevelSettings {
    /**
     * How much glass the window holds, as a count of the tiling's average
     * piece. The frame's pieces are cut smaller, so a window has a few more
     * pieces than this.
     */
    readonly tiles: number;
    /**
     * How different the two most alike pieces look, at least, in OKLab: the
     * puzzle's subtlety. 0.02 is about the least difference anyone notices at
     * a glance. Side by side, smaller ones can be seen, with care.
     */
    readonly closestPair: number;
    /**
     * The tilings' symmetries the level draws from, one listed twice as often
     * as another being twice as likely. Each has its thinnest tile at least
     * 20 pixels wide at the level's size; more pieces need a tiling whose
     * thinnest tiles are less thin.
     */
    readonly symmetries: readonly number[];
}

export const LEVEL_SETTINGS: Readonly<Record<PuzzleLevel, LevelSettings>> = {
    easy: { tiles: 40, closestPair: 0.03, symmetries: [5, 5, 7, 8, 10, 12] },
    medium: { tiles: 70, closestPair: 0.022, symmetries: [5, 5, 7, 8, 10, 12] },
    hard: { tiles: 110, closestPair: 0.016, symmetries: [5, 5, 8, 10] },
    expert: { tiles: 150, closestPair: 0.012, symmetries: [5, 5, 8, 10] },
};

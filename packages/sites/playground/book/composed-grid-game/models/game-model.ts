import { createGridModel, type GridModel } from './grid-model';
import { createPlayerModel, type PlayerModel } from './player-model';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How many lives a new game starts with. */
const START_LIVES = 3;
/** How many points each dot is worth. */
const POINTS_PER_DOT = 10;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A small grid game. The player collects dots for points, and loses a life
 * on a spike. Collecting every dot puts them all back, and losing the last
 * life starts a new game.
 */
export interface GameModel {
    readonly grid: GridModel;
    readonly player: PlayerModel;
    readonly score: number;
    readonly lives: number;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a game, with the player at the start and every dot in place. */
export function createGameModel(): GameModel {
    const grid = createGridModel({ layout: LAYOUT });
    const player = createPlayerModel({ grid });
    let score = 0;
    let lives = START_LIVES;

    const model: GameModel = {
        grid,
        player,
        get score() { return score; },
        get lives() { return lives; },

        update(deltaMs) {
            player.update(deltaMs);

            // Then whatever the player has reached
            const row = Math.round(player.row);
            const col = Math.round(player.col);
            const kind = grid.tileKindAt(row, col);
            if (kind === 'dot') {
                grid.clearDotAt(row, col);
                score += POINTS_PER_DOT;
                if (grid.dotsLeft === 0) grid.refill();
            }
            else if (kind === 'spike') {
                lives--;
                if (lives === 0) startNewGame();
                else player.respawn();
            }
        },
    };

    return model;

    function startNewGame(): void {
        score = 0;
        lives = START_LIVES;
        grid.refill();
        player.respawn();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** `#` is a wall, `.` a dot, `^` a spike and `S` the start. */
const LAYOUT: readonly string[] = [
    '###############',
    '#......#..^...#',
    '#.###..#..###.#',
    '#.#.........#.#',
    '#...##.^.##...#',
    '#.#.........#.#',
    '#.###.###.###.#',
    '#S............#',
    '###############',
];

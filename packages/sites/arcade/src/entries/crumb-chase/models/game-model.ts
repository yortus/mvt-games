import type { TileKind } from '../data';
import type { Direction } from './common';
import { createMazeModel, type MazeModel } from './maze-model';
import { createMouseModel, type MouseModel } from './mouse-model';
import { createCatModel, type CatModel, type CatBehavior, type CatMode } from './cat-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export type GamePhase = 'playing' | 'game-over' | 'won';

export interface GameModel {
    readonly phase: GamePhase;
    readonly maze: MazeModel;
    readonly mouse: MouseModel;
    readonly cats: readonly CatModel[];
    /**
     * What all the cats are doing. They take turns to scatter to their home
     * corners and to chase, scattering for less of the time as a game goes
     * on, until they only chase.
     */
    readonly catMode: CatMode;
    readonly score: number;
    /**
     * The way the player last steered. The mouse turns that way at the
     * first tile where it can, and runs on that way until steered again.
     */
    direction: Direction;
    /** Asks for a new game. It starts at the next update, if the last game is over. */
    startNewRun: () => void;
    reset: () => void;
    /**
     * Returns the game as it stands, as a value JSON can hold, for `load` to
     * restore. Returns undefined unless a game is being played, and until
     * the mouse eats its first crumb, since resuming before that would only
     * start the game again.
     */
    save: () => SavedGame | undefined;
    /**
     * Restores a game that `save` returned, in place of this one. Returns
     * whether it could: a value that is not a saved game of this maze, such
     * as one from an older version, leaves the game as it was.
     */
    load: (saved: unknown) => boolean;
    update: (deltaMs: number) => void;
}

/**
 * A game part way through, as `save` returns it. Each animal is saved on a
 * tile, so one saved between two tiles goes back to the nearer.
 */
export interface SavedGame {
    readonly version: typeof SAVED_GAME_VERSION;
    readonly score: number;
    /** How long the game has been played, in milliseconds, for the cats' turns to scatter and chase. */
    readonly playedMs: number;
    /** The crumbs eaten, each as its tile's index, `row * cols + col`. */
    readonly eaten: readonly number[];
    readonly mouse: SavedAnimal;
    readonly cats: readonly SavedCat[];
}

/** An animal's tile, and the way it faces. */
export interface SavedAnimal {
    readonly row: number;
    readonly col: number;
    readonly direction: Direction;
}

/** A cat's tile, the way it faces, and how long it still waits in its pen. */
export interface SavedCat extends SavedAnimal {
    readonly releaseInMs: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GameModelOptions {
    grid: TileKind[][];
    mouseSpawn: [number, number];
    catSpawns: [number, number][];
    /** The tile just outside the pen's way out, where cats head when they start. */
    penExit: [number, number];
    mouseSpeed?: number;
    catSpeed?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameModel(options: GameModelOptions): GameModel {
    const { grid, mouseSpawn, catSpawns, penExit, mouseSpeed = 5, catSpeed = 4 } = options;
    const rows = grid.length;
    const cols = grid[0].length;
    // Each cat's home: a tile beyond a corner of the maze, so it circles that corner's hedges
    const homeCorners: readonly { row: number; col: number }[] = [
        { row: -3, col: cols - 3 },
        { row: -3, col: 2 },
        { row: rows + 1, col: cols - 1 },
        { row: rows + 1, col: 0 },
    ];

    let gamePhase: GamePhase = 'playing';
    /** How long this game has been played, which says whether the cats scatter or chase. */
    let playedMs = 0;
    let catMode: CatMode = catModeAt(0);

    // ---- Initialise child models -------------------------------------------

    let maze = buildMaze();
    let mouse = buildMouse(maze);
    let cats = buildCats(maze);
    let score = 0;

    let isNewRunRequested = false;

    // ---- Public model record -----------------------------------------------

    const model: GameModel = {
        get phase() {
            return gamePhase;
        },
        get maze() {
            return maze;
        },
        get mouse() {
            return mouse;
        },
        get cats() {
            return cats;
        },
        get catMode() {
            return catMode;
        },
        get score() {
            return score;
        },
        // The way the player steers carries over from one game to the next
        direction: 'left',

        startNewRun(): void {
            isNewRunRequested = true;
        },

        reset(): void {
            playedMs = 0;
            catMode = catModeAt(0);
            maze = buildMaze();
            mouse = buildMouse(maze);
            cats = buildCats(maze);
            score = 0;
            gamePhase = 'playing';
        },

        save() {
            // A game with no crumb eaten has nothing worth resuming. Resuming it would only start it again
            if (gamePhase !== 'playing' || score === 0) return undefined;
            const eaten: number[] = [];
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (grid[r][c] === 'crumb' && !maze.isCrumb(r, c)) eaten.push(r * cols + c);
                }
            }
            return {
                version: SAVED_GAME_VERSION,
                score,
                playedMs,
                eaten,
                mouse: { row: Math.round(mouse.row), col: Math.round(mouse.col), direction: mouse.direction },
                cats: cats.map((cat) => ({
                    row: Math.round(cat.row),
                    col: Math.round(cat.col),
                    direction: cat.direction,
                    releaseInMs: cat.releaseInMs,
                })),
            };
        },

        load(value) {
            const saved = parseSavedGame(value);
            if (saved === undefined) return false;
            playedMs = saved.playedMs;
            catMode = catModeAt(playedMs);
            maze = buildMaze();
            for (let i = 0; i < saved.eaten.length; i++) {
                maze.eatCrumb(Math.floor(saved.eaten[i] / cols), saved.eaten[i] % cols);
            }
            mouse = buildMouse(maze, saved.mouse);
            cats = buildCats(maze, saved.cats);
            score = saved.score;
            gamePhase = 'playing';
            // The mouse runs on the way it was going, until the player steers it
            model.direction = saved.mouse.direction;
            return true;
        },

        update(deltaMs: number): void {
            // A new game is allowed from any non-playing phase. One asked
            // for during play is dropped, not kept for later
            if (isNewRunRequested && gamePhase !== 'playing') {
                model.reset();
            }
            isNewRunRequested = false;

            // Apply current direction every tick (not via watch - a watch
            // would "consume" a direction the player repeats after a failed
            // turn attempt, making input feel unresponsive).
            if (gamePhase === 'playing') {
                mouse.setDirection(model.direction);
            }

            if (gamePhase !== 'playing') return;

            playedMs += deltaMs;
            catMode = catModeAt(playedMs);
            maze.update(deltaMs);
            mouse.update(deltaMs);
            for (let i = 0; i < cats.length; i++) {
                cats[i].update(deltaMs);
            }

            checkCollisions();
        },
    };

    return model;

    // ---- Child model construction ------------------------------------------

    function buildMaze(): MazeModel {
        return createMazeModel({ grid });
    }

    function buildMouse(maze: MazeModel, from?: SavedAnimal): MouseModel {
        return createMouseModel({
            startRow: from?.row ?? mouseSpawn[0],
            startCol: from?.col ?? mouseSpawn[1],
            startDirection: from?.direction,
            speed: mouseSpeed,
            // The pen is the cats' alone
            isWalkable: (r, c) => !maze.isWall(r, c) && maze.tileAt(r, c) !== 'pen',
        });
    }

    function buildCats(maze: MazeModel, from?: readonly SavedCat[]): CatModel[] {
        const cats: CatModel[] = [];
        for (let i = 0; i < catSpawns.length; i++) {
            const saved = from?.[i];
            cats.push(
                createCatModel({
                    startRow: saved?.row ?? catSpawns[i][0],
                    startCol: saved?.col ?? catSpawns[i][1],
                    startDirection: saved?.direction,
                    speed: catSpeed,
                    behavior: CAT_BEHAVIORS[i] ?? 'chase',
                    isWalkable: (r, c) => !maze.isWall(r, c),
                    chaseTarget: mouse,
                    flankPartner: i === 2 ? cats[0] : undefined,
                    homeCorner: homeCorners[i % homeCorners.length],
                    mode: () => catMode,
                    releaseDelayMs: saved?.releaseInMs ?? CAT_RELEASE_DELAYS_MS[i] ?? 0,
                    isInPen: (r, c) => maze.tileAt(r, c) === 'pen',
                    penExit: { row: penExit[0], col: penExit[1] },
                }),
            );
        }
        return cats;
    }

    // ---- Collision detection -----------------------------------------------

    function checkCollisions(): void {
        if (gamePhase !== 'playing') return;

        // The mouse eats crumbs
        if (maze.eatCrumb(Math.round(mouse.row), Math.round(mouse.col))) {
            score += CRUMB_POINTS;
        }

        // Win if all crumbs eaten
        if (maze.remainingCrumbs === 0) {
            gamePhase = 'won';
            return;
        }

        // Cat collisions
        for (let i = 0; i < cats.length; i++) {
            const dr = mouse.row - cats[i].row;
            const dc = mouse.col - cats[i].col;
            if (dr * dr + dc * dc < COLLISION_THRESHOLD_SQ) {
                gamePhase = 'game-over';
                return;
            }
        }
    }

    // ---- Saved games -------------------------------------------------------

    /** Returns `value` as a saved game of this maze, if it is one, with every animal on a tile it can stand on. */
    function parseSavedGame(value: unknown): SavedGame | undefined {
        if (!isRecord(value) || value.version !== SAVED_GAME_VERSION) return undefined;
        const { score, playedMs, eaten, mouse, cats } = value;
        if (!isCount(score) || !isCount(playedMs) || !Array.isArray(eaten) || !Array.isArray(cats)) return undefined;
        if (cats.length !== catSpawns.length) return undefined;
        for (let i = 0; i < eaten.length; i++) {
            const tile: unknown = eaten[i];
            if (!isCount(tile) || !Number.isInteger(tile) || grid[Math.floor(tile / cols)]?.[tile % cols] !== 'crumb') return undefined;
        }
        // The mouse never stands in the pen, and a cat never stands in a hedge
        if (!isAnimalOn(mouse, (kind) => kind !== 'wall' && kind !== 'pen')) return undefined;
        for (let i = 0; i < cats.length; i++) {
            const cat: unknown = cats[i];
            if (!isAnimalOn(cat, (kind) => kind !== 'wall') || !isCount(cat.releaseInMs)) return undefined;
        }
        return value as unknown as SavedGame;
    }

    function isAnimalOn(value: unknown, canStandOn: (kind: TileKind) => boolean): value is Record<string, unknown> {
        if (!isRecord(value) || !Number.isInteger(value.row) || !Number.isInteger(value.col)) return false;
        if (typeof value.direction !== 'string' || !DIRECTIONS.includes(value.direction as Direction)) return false;
        const kind = grid[value.row as number]?.[value.col as number];
        return kind !== undefined && canStandOn(kind);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const CRUMB_POINTS = 10;
const COLLISION_THRESHOLD_SQ = 0.5 * 0.5; // half a tile
const CAT_BEHAVIORS: CatBehavior[] = ['chase', 'ambush', 'flank', 'fickle'];
/** How long each cat waits in the pen before it leaves, so they come out one by one. */
const CAT_RELEASE_DELAYS_MS: readonly number[] = [0, 3000, 7000, 11000];
/**
 * The cats' turns, from the start of a game: how long each lasts, in
 * milliseconds. After the last, they chase until the game ends.
 */
const CAT_MODE_TURNS: readonly { readonly mode: CatMode; readonly ms: number }[] = [
    { mode: 'scatter', ms: 7000 },
    { mode: 'chase', ms: 20000 },
    { mode: 'scatter', ms: 7000 },
    { mode: 'chase', ms: 20000 },
    { mode: 'scatter', ms: 5000 },
    { mode: 'chase', ms: 20000 },
    { mode: 'scatter', ms: 5000 },
];
const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];
/** Marks the shape of a saved game. A change to the shape changes it, so older saves are not loaded. */
const SAVED_GAME_VERSION = 1;

/** Returns what the cats are doing `playedMs` into a game. */
function catModeAt(playedMs: number): CatMode {
    let endMs = 0;
    for (let i = 0; i < CAT_MODE_TURNS.length; i++) {
        endMs += CAT_MODE_TURNS[i].ms;
        if (playedMs < endMs) return CAT_MODE_TURNS[i].mode;
    }
    return 'chase';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    // typeof null is 'object' too
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Whether `value` is a finite number, 0 or more. */
function isCount(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

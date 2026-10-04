import { watch } from '@mvtjs/utils';
import type { TileKind } from '../data';
import { createMazeModel, type MazeModel } from './maze-model';
import { createMouseModel, type MouseModel } from './mouse-model';
import { createCatModel, type CatModel, type CatBehavior } from './cat-model';
import { createPlayerInput, type PlayerInput } from './player-input';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export type GamePhase = 'playing' | 'game-over' | 'won';

export interface GameModel {
    readonly phase: GamePhase;
    readonly maze: MazeModel;
    readonly mouse: MouseModel;
    readonly cats: readonly CatModel[];
    readonly score: number;
    readonly playerInput: PlayerInput;
    reset: () => void;
    update: (deltaMs: number) => void;
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

    let gamePhase: GamePhase = 'playing';

    // ---- Initialise child models -------------------------------------------

    let maze = buildMaze();
    let mouse = buildMouse(maze);
    let cats = buildCats(maze);
    let score = 0;

    // Player input - persists across resets (input device outlives a single game)
    const playerInput = createPlayerInput();
    const watcher = watch({ restart: () => playerInput.restartPressed });

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
        get score() {
            return score;
        },
        get playerInput() {
            return playerInput;
        },

        reset(): void {
            maze = buildMaze();
            mouse = buildMouse(maze);
            cats = buildCats(maze);
            score = 0;
            gamePhase = 'playing';
        },

        update(deltaMs: number): void {
            // Process restart request (allowed from any non-playing phase)
            const watched = watcher.poll();
            if (watched.restart.changed && watched.restart.value) {
                if (gamePhase !== 'playing') {
                    model.reset();
                }
            }

            // Apply current direction every tick (not via watch - a watch
            // would "consume" a direction the player repeats after a failed
            // turn attempt, making input feel unresponsive).
            if (gamePhase === 'playing') {
                mouse.setDirection(playerInput.direction);
            }

            if (gamePhase !== 'playing') return;

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

    function buildMouse(maze: MazeModel): MouseModel {
        return createMouseModel({
            startRow: mouseSpawn[0],
            startCol: mouseSpawn[1],
            speed: mouseSpeed,
            // The pen is the cats' alone
            isWalkable: (r, c) => !maze.isWall(r, c) && maze.tileAt(r, c) !== 'pen',
        });
    }

    function buildCats(maze: MazeModel): CatModel[] {
        const cats: CatModel[] = [];
        for (let i = 0; i < catSpawns.length; i++) {
            cats.push(
                createCatModel({
                    startRow: catSpawns[i][0],
                    startCol: catSpawns[i][1],
                    speed: catSpeed,
                    behavior: CAT_BEHAVIORS[i] ?? 'chase',
                    isWalkable: (r, c) => !maze.isWall(r, c),
                    chaseTarget: mouse,
                    flankPartner: i === 2 ? cats[0] : undefined,
                    scatterTarget: i === 3 ? { row: grid.length - 1, col: 0 } : undefined,
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
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const CRUMB_POINTS = 10;
const COLLISION_THRESHOLD_SQ = 0.5 * 0.5; // half a tile
const CAT_BEHAVIORS: CatBehavior[] = ['chase', 'ambush', 'flank', 'fickle'];

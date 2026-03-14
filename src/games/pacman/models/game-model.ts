import { watch } from '#common';
import type { TileKind } from '../data';
import { createMazeModel, type MazeModel } from './maze-model';
import { createPacmanModel, type PacmanModel } from './pacman-model';
import { createGhostModel, type GhostModel, type GhostBehavior } from './ghost-model';
import { createPlayerInput, type PlayerInput } from './player-input';
import { createScoreModel, type ScoreModel } from './score-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface GameModel {
    readonly phase: GamePhase;
    readonly maze: MazeModel;
    readonly pacman: PacmanModel;
    readonly ghosts: readonly GhostModel[];
    readonly score: ScoreModel;
    readonly playerInput: PlayerInput;
    reset(): void;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GameModelOptions {
    grid: TileKind[][];
    pacmanSpawn: [number, number];
    ghostSpawns: [number, number][];
    ghostColors: number[];
    pacmanSpeed?: number;
    ghostSpeed?: number;
}

export type GamePhase = 'playing' | 'game-over' | 'won';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const DOT_POINTS = 10;
const COLLISION_THRESHOLD_SQ = 0.5 * 0.5; // half a tile
const GHOST_BEHAVIORS: GhostBehavior[] = ['chase', 'ambush', 'flank', 'fickle'];

export function createGameModel(options: GameModelOptions): GameModel {
    const { grid, pacmanSpawn, ghostSpawns, ghostColors, pacmanSpeed = 5, ghostSpeed = 4 } = options;

    let gamePhase: GamePhase = 'playing';

    // ---- Child model construction ------------------------------------------

    function buildMaze(): MazeModel {
        return createMazeModel({ grid });
    }

    function buildPacman(maze: MazeModel): PacmanModel {
        return createPacmanModel({
            startRow: pacmanSpawn[0],
            startCol: pacmanSpawn[1],
            speed: pacmanSpeed,
            isWalkable: (r, c) => !maze.isWall(r, c),
        });
    }

    function buildGhosts(maze: MazeModel): GhostModel[] {
        const ghosts: GhostModel[] = [];
        for (let i = 0; i < ghostSpawns.length; i++) {
            const color = ghostColors[i] ?? 0xff0000;
            ghosts.push(
                createGhostModel({
                    startRow: ghostSpawns[i][0],
                    startCol: ghostSpawns[i][1],
                    color,
                    speed: ghostSpeed,
                    behavior: GHOST_BEHAVIORS[i] ?? 'chase',
                    isWalkable: (r, c) => !maze.isWall(r, c),
                    chaseTarget: pacman,
                    flankPartner: i === 2 ? ghosts[0] : undefined,
                    scatterTarget: i === 3 ? { row: grid.length - 1, col: 0 } : undefined,
                }),
            );
        }
        return ghosts;
    }

    // ---- Initialise child models -------------------------------------------

    let maze = buildMaze();
    let pacman = buildPacman(maze);
    let ghosts = buildGhosts(maze);
    let scoreModel = createScoreModel();

    // Player input - persists across resets (input device outlives a single game)
    const playerInput = createPlayerInput();
    const watcher = watch({ restart: () => playerInput.restartPressed });

    // ---- Collision detection -----------------------------------------------

    function checkCollisions(): void {
        if (gamePhase !== 'playing') return;

        // Pac-Man eats dots
        if (maze.eatDot(Math.round(pacman.row), Math.round(pacman.col))) {
            scoreModel.addPoints(DOT_POINTS);
        }

        // Win if all dots eaten
        if (maze.remainingDots === 0) {
            gamePhase = 'won';
            return;
        }

        // Ghost collisions
        for (let i = 0; i < ghosts.length; i++) {
            const dr = pacman.row - ghosts[i].row;
            const dc = pacman.col - ghosts[i].col;
            if (dr * dr + dc * dc < COLLISION_THRESHOLD_SQ) {
                gamePhase = 'game-over';
                return;
            }
        }
    }

    // ---- Public model record -----------------------------------------------

    const model: GameModel = {
        get phase() {
            return gamePhase;
        },
        get maze() {
            return maze;
        },
        get pacman() {
            return pacman;
        },
        get ghosts() {
            return ghosts;
        },
        get score() {
            return scoreModel;
        },
        get playerInput() {
            return playerInput;
        },

        reset(): void {
            maze = buildMaze();
            pacman = buildPacman(maze);
            ghosts = buildGhosts(maze);
            scoreModel = createScoreModel();
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
                pacman.setDirection(playerInput.direction);
            }

            if (gamePhase !== 'playing') return;

            maze.update(deltaMs);
            pacman.update(deltaMs);
            for (let i = 0; i < ghosts.length; i++) {
                ghosts[i].update(deltaMs);
            }
            scoreModel.update(deltaMs);

            checkCollisions();
        },
    };

    return model;
}

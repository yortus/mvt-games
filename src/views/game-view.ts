import { Container, Graphics, Text } from 'pixi.js';
import type { Direction, TileKind, GamePhase } from '../models';
import { createWatch } from '../utils';
import { createMazeView } from './maze-view';
import { createPacmanView } from './pacman-view';
import { createGhostView } from './ghost-view';
import { createHudView } from './hud-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    // Maze
    getTileSize(): number;
    getRows(): number;
    getCols(): number;
    getTileKind(row: number, col: number): TileKind;
    isDotAt(row: number, col: number): boolean;
    // Pacman
    getPacmanX(): number;
    getPacmanY(): number;
    getPacmanDirection(): Direction;
    getPacmanStepProgress(): number;
    // Ghosts
    getGhostCount(): number;
    getGhostX(index: number): number;
    getGhostY(index: number): number;
    getGhostColor(index: number): number;
    // HUD
    getScore(): number;
    // State
    getGamePhase(): GamePhase;
    // Input events
    onDirectionInput(dir: Direction): void;
    onRestart(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameView(bindings: GameViewBindings): Container {
    // ---- Change detection ---------------------------------------------------
    const watchTileSize = createWatch(bindings.getTileSize);
    const watchRows = createWatch(bindings.getRows);
    const watchCols = createWatch(bindings.getCols);
    const watchGhostCount = createWatch(bindings.getGhostCount);
    const watchPhase = createWatch(bindings.getGamePhase);

    // ---- Scene elements -------------------------------------------------------
    const container = new Container();

    // Maze
    const mazeContainer = createMazeView({
        getTileSize: bindings.getTileSize,
        getRows: bindings.getRows,
        getCols: bindings.getCols,
        getTileKind: bindings.getTileKind,
        isDotAt: bindings.isDotAt,
        getGamePhase: bindings.getGamePhase,
    });
    container.addChild(mazeContainer);

    // Pac-Man
    const pacmanContainer = createPacmanView({
        getX: bindings.getPacmanX,
        getY: bindings.getPacmanY,
        getDirection: bindings.getPacmanDirection,
        getStepProgress: bindings.getPacmanStepProgress,
        getTileSize: bindings.getTileSize,
    });
    container.addChild(pacmanContainer);

    // Ghosts — managed as a dynamic list
    let ghostContainers: Container[] = [];
    buildGhosts();

    // HUD — positioned below the maze
    const hudContainer = createHudView({
        getScore: bindings.getScore,
    });
    container.addChild(hudContainer);

    // Overlay (game over / win)
    const overlay = new Container();
    overlay.visible = false;

    const overlayBg = new Graphics();
    overlay.addChild(overlayBg);

    const overlayText = new Text({
        text: '',
        style: {
            fontFamily: 'monospace',
            fontSize: 28,
            fill: 0xffffff,
            align: 'center',
        },
    });
    overlayText.anchor.set(0.5);
    overlay.addChild(overlayText);
    container.addChild(overlay);

    // ---- Event handling -------------------------------------------------------
    window.addEventListener('keydown', onKeyDown);
    const originalDestroy = container.destroy.bind(container);
    container.destroy = (options) => {
        window.removeEventListener('keydown', onKeyDown);
        originalDestroy(options);
    };

    updateLayout();
    container.onRender = refresh;
    return container;

    function refresh(): void {
        const dimsChanged = watchTileSize.changed() | watchRows.changed() | watchCols.changed();
        if (dimsChanged) updateLayout();

        const ghostCountChanged = watchGhostCount.changed();
        if (ghostCountChanged) buildGhosts();

        const phaseChanged = watchPhase.changed();
        if (phaseChanged) {
            const phase = watchPhase.value;
            if (phase === 'playing') {
                overlay.visible = false;
            } else {
                overlay.visible = true;
                overlayText.text =
                    phase === 'game-over'
                        ? 'GAME OVER\n\nPress Enter to restart'
                        : 'YOU WIN!\n\nPress Enter to restart';
            }
        }
    }

    function updateLayout(): void {
        const ts = watchTileSize.value;
        const rows = watchRows.value;
        const cols = watchCols.value;
        const canvasW = cols * ts;
        const canvasH = rows * ts;

        hudContainer.position.set(0, canvasH);

        overlayBg.clear();
        overlayBg.rect(0, 0, canvasW, canvasH).fill({ color: 0x000000, alpha: 0.6 });
        overlayText.position.set(canvasW / 2, canvasH / 2);
    }

    function buildGhosts(): void {
        for (let i = 0; i < ghostContainers.length; i++) {
            ghostContainers[i].destroy();
        }
        ghostContainers = [];

        const count = watchGhostCount.value;
        for (let i = 0; i < count; i++) {
            const idx = i;
            const ghostContainer = createGhostView({
                getX: () => bindings.getGhostX(idx),
                getY: () => bindings.getGhostY(idx),
                getColor: () => bindings.getGhostColor(idx),
                getTileSize: bindings.getTileSize,
            });
            container.addChild(ghostContainer);
            ghostContainers.push(ghostContainer);
        }
    }

    function onKeyDown(e: KeyboardEvent): void {
        const dir = KEY_MAP[e.key];
        if (dir !== undefined) {
            e.preventDefault();
            bindings.onDirectionInput(dir);
            return;
        }
        if (e.key === 'Enter') {
            bindings.onRestart();
        }
    }
}

const KEY_MAP: Record<string, Direction> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    w: 'up',
    s: 'down',
    a: 'left',
    d: 'right',
};

import { Container } from 'pixi.js';
import { createKeyboardInputView, createOverlayView, watch } from '#common';
import { TILE_SIZE, FIELD_ROWS, FIELD_COLS, DEPTH_LAYERS } from '../data';
import type { GameModel } from '../models';
import { createFieldView } from './field-view';
import { createDiggerView } from './digger-view';
import { createEnemyView } from './enemy-view';
import { createRockView } from './rock-view';
import { createHudView } from './hud-view';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameView(game: GameModel): Container {
    const watcher = watch({
        enemyCount: () => game.enemies.length,
        rockCount: () => game.rocks.length,
    });

    const canvasW = FIELD_COLS * TILE_SIZE;
    const canvasH = FIELD_ROWS * TILE_SIZE;

    let enemyContainers: Container[] = [];
    let rockContainers: Container[] = [];
    let enemyLayer: Container;
    let rockLayer: Container;
    let lastXDir: 'left' | 'none' | 'right' = 'none';
    let lastYDir: 'up' | 'none' | 'down' = 'none';

    const view = new Container();
    initialiseView();
    view.onRender = refresh;
    return view;

    function initialiseView(): void {
        // Field
        view.addChild(
            createFieldView({
                getTileSize: () => TILE_SIZE,
                getRows: () => FIELD_ROWS,
                getCols: () => FIELD_COLS,
                getTileKind: (r, c) => game.field.tileAt(r, c),
                getDepthLayers: () => DEPTH_LAYERS,
                getTunnelCount: () => game.field.tunnelCount,
                getGamePhase: () => game.phase,
            }),
        );

        // Digger
        view.addChild(
            createDiggerView({
                getRow: () => game.digger.row,
                getCol: () => game.digger.col,
                getDirection: () => game.digger.direction,
                isAlive: () => game.digger.alive,
                isHarpoonExtended: () => game.digger.harpoonExtended,
                getHarpoonDistance: () => game.digger.harpoonDistance,
                getTileSize: () => TILE_SIZE,
            }),
        );

        // Enemy & rock layers (children managed by buildEnemies / buildRocks)
        enemyLayer = new Container();
        view.addChild(enemyLayer);
        rockLayer = new Container();
        view.addChild(rockLayer);
        buildEnemies();
        buildRocks();

        // HUD
        const hudContainer = createHudView({
            getScore: () => game.score.score,
            getLives: () => game.score.lives,
            getLevel: () => game.score.level,
            getTileSize: () => TILE_SIZE,
            getCols: () => FIELD_COLS,
        });
        hudContainer.position.set(0, canvasH);
        view.addChild(hudContainer);

        // Overlay
        view.addChild(
            createOverlayView({
                getWidth: () => canvasW,
                getHeight: () => canvasH,
                isVisible: () => game.phase === 'game-over' || game.phase === 'level-clear',
                getText: () => (game.phase === 'game-over' ? 'GAME OVER\n\nPress Enter to restart' : 'LEVEL CLEAR!'),
            }),
        );

        // Keyboard input
        view.addChild(
            createKeyboardInputView({
                onXDirectionChanged: (dir) => {
                    lastXDir = dir;
                    if (dir === 'left') game.playerInput.direction = 'left';
                    else if (dir === 'right') game.playerInput.direction = 'right';
                    else if (lastYDir === 'up') game.playerInput.direction = 'up';
                    else if (lastYDir === 'down') game.playerInput.direction = 'down';
                    else game.playerInput.direction = 'none';
                },
                onYDirectionChanged: (dir) => {
                    lastYDir = dir;
                    if (dir === 'up') game.playerInput.direction = 'up';
                    else if (dir === 'down') game.playerInput.direction = 'down';
                    else if (lastXDir === 'left') game.playerInput.direction = 'left';
                    else if (lastXDir === 'right') game.playerInput.direction = 'right';
                    else game.playerInput.direction = 'none';
                },
                onPrimaryButtonChanged: (pressed) => {
                    game.playerInput.pumpPressed = pressed;
                },
                onRestartButtonChanged: (pressed) => {
                    game.playerInput.restartPressed = pressed;
                },
            }),
        );
    }

    function refresh(): void {
        const watched = watcher.poll();

        if (watched.enemyCount.changed) buildEnemies();
        if (watched.rockCount.changed) buildRocks();
    }

    function buildEnemies(): void {
        for (let i = 0; i < enemyContainers.length; i++) {
            enemyContainers[i].destroy();
        }
        enemyContainers = [];

        const count = game.enemies.length;
        for (let i = 0; i < count; i++) {
            const idx = i;
            const enemyContainer = createEnemyView({
                getRow: () => game.enemies[idx].row,
                getCol: () => game.enemies[idx].col,
                getKind: () => game.enemies[idx].kind,
                getPhase: () => game.enemies[idx].phase,
                getInflationStage: () => game.enemies[idx].inflationStage,
                getDirection: () => game.enemies[idx].direction,
                isFireActive: () => game.enemies[idx].fireActive,
                isFireTelegraph: () => game.enemies[idx].fireTelegraph,
                getTileSize: () => TILE_SIZE,
            });
            enemyLayer.addChild(enemyContainer);
            enemyContainers.push(enemyContainer);
        }
    }

    function buildRocks(): void {
        for (let i = 0; i < rockContainers.length; i++) {
            rockContainers[i].destroy();
        }
        rockContainers = [];

        const count = game.rocks.length;
        for (let i = 0; i < count; i++) {
            const idx = i;
            const rockContainer = createRockView({
                getX: () => game.rocks[idx].x,
                getY: () => game.rocks[idx].y,
                getPhase: () => game.rocks[idx].phase,
                isAlive: () => game.rocks[idx].alive,
                getTileSize: () => TILE_SIZE,
            });
            rockLayer.addChild(rockContainer);
            rockContainers.push(rockContainer);
        }
    }
}

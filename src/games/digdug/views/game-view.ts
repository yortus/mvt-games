import { Container, type Texture } from 'pixi.js';
import { createKeyboardInputView, createOverlayView, watch } from '#common';
import { TILE_SIZE, FIELD_ROWS, FIELD_COLS, DEPTH_LAYERS } from '../data';
import type { GameModel } from '../models';
import { createFieldView } from './field-view';
import { createDiggerView, type DiggerViewTextures } from './digger-view';
import { createEnemyView, type EnemyViewTextures } from './enemy-view';
import { createRockView, type RockViewTextures } from './rock-view';
import { createHudView } from './hud-view';

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

export interface GameViewTextures {
    readonly digger: DiggerViewTextures;
    readonly enemy: EnemyViewTextures;
    readonly rock: RockViewTextures;
    readonly diggerIcon: Texture;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameView(game: GameModel, textures: GameViewTextures): Container {
    const watcher = watch({
        enemyCount: () => game.enemies.length,
        rockCount: () => game.rocks.length,
    });

    const canvasW = FIELD_COLS * TILE_SIZE;
    const canvasH = FIELD_ROWS * TILE_SIZE;

    const view = new Container();

    // Field
    const fieldContainer = createFieldView({
        getTileSize: () => TILE_SIZE,
        getRows: () => FIELD_ROWS,
        getCols: () => FIELD_COLS,
        getTileKind: (r, c) => game.field.tileAt(r, c),
        getDepthLayers: () => DEPTH_LAYERS,
        getTunnelCount: () => game.field.tunnelCount,
        getGamePhase: () => game.phase,
    });
    view.addChild(fieldContainer);

    // Digger
    const diggerContainer = createDiggerView({
        getRow: () => game.digger.row,
        getCol: () => game.digger.col,
        getDirection: () => game.digger.direction,
        isAlive: () => game.digger.alive,
        isHarpoonExtended: () => game.digger.harpoonExtended,
        getHarpoonDistance: () => game.digger.harpoonDistance,
        getTileSize: () => TILE_SIZE,
    }, textures.digger);
    view.addChild(diggerContainer);

    // Enemies - dynamic list
    let enemyContainers: Container[] = [];
    buildEnemies();

    // Rocks - dynamic list
    let rockContainers: Container[] = [];
    buildRocks();

    // HUD
    const hudContainer = createHudView({
        getScore: () => game.score.score,
        getLives: () => game.score.lives,
        getLevel: () => game.score.level,
        getTileSize: () => TILE_SIZE,
        getCols: () => FIELD_COLS,
    }, textures.diggerIcon);
    hudContainer.position.set(0, canvasH);
    view.addChild(hudContainer);

    // Overlay
    const overlayView = createOverlayView({
        getWidth: () => canvasW,
        getHeight: () => canvasH,
        isVisible: () => game.phase === 'game-over' || game.phase === 'level-clear',
        getText: () => game.phase === 'game-over'
            ? 'GAME OVER\n\nPress Enter to restart'
            : 'LEVEL CLEAR!',
    });
    view.addChild(overlayView);

    // Keyboard input
    let lastXDir: 'left' | 'none' | 'right' = 'none';
    let lastYDir: 'up' | 'none' | 'down' = 'none';
    view.addChild(createKeyboardInputView({
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
        onPrimaryButtonChanged: (pressed) => { game.playerInput.pumpPressed = pressed; },
        onRestartButtonChanged: (pressed) => { game.playerInput.restartPressed = pressed; },
    }));

    view.onRender = refresh;
    return view;

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
            }, textures.enemy);
            view.addChild(enemyContainer);
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
            }, textures.rock);
            view.addChild(rockContainer);
            rockContainers.push(rockContainer);
        }
    }
}

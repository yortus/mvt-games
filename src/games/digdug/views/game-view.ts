import { Container } from 'pixi.js';
import { OverlayView, isTouchDevice, watch } from '#common';
import { FIELD_ROWS, FIELD_COLS, DEPTH_LAYERS } from '../data';
import { TILE_SIZE } from './view-constants';
import type { GameModel } from '../models';
import { FieldView } from './field-view';
import { DiggerView } from './digger-view';
import { EnemyView } from './enemy-view';
import { RockView } from './rock-view';
import { HudView } from './hud-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    model: GameModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function GameView(bindings: GameViewBindings): Container {
    const game = bindings.model;
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

    const view = new Container();
    initialiseView();
    view.onRefresh = refresh;
    return view;

    function initialiseView(): void {
        // Field
        view.addChild(
            FieldView({
                tileSize: () => TILE_SIZE,
                rows: () => FIELD_ROWS,
                cols: () => FIELD_COLS,
                tileKindAt: (r, c) => game.field.tileAt(r, c),
                depthLayers: () => DEPTH_LAYERS,
                tunnelCount: () => game.field.tunnelCount,
                gamePhase: () => game.phase,
            }),
        );

        // Digger
        view.addChild(
            DiggerView({
                row: () => game.digger.row,
                col: () => game.digger.col,
                direction: () => game.digger.direction,
                isAlive: () => game.digger.isAlive,
                isHarpoonExtended: () => game.digger.isHarpoonExtended,
                harpoonDistance: () => game.digger.harpoonDistance,
                tileSize: () => TILE_SIZE,
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
        const hudContainer = HudView({
            score: () => game.score,
            lives: () => game.lives,
            level: () => game.level,
            tileSize: () => TILE_SIZE,
            cols: () => FIELD_COLS,
        });
        hudContainer.position.set(0, canvasH);
        view.addChild(hudContainer);

        // Overlay
        const restartHint = isTouchDevice() ? 'Tap to restart' : 'Press Enter to restart';
        view.addChild(
            OverlayView({
                width: canvasW,
                height: canvasH,
                isVisible: () => game.phase === 'game-over' || game.phase === 'level-clear',
                text: () => (game.phase === 'game-over' ? `GAME OVER\n\n${restartHint}` : 'LEVEL CLEAR!'),
                onRestartPressed: (pressed) => {
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
            const enemyContainer = EnemyView({
                row: () => game.enemies[idx].row,
                col: () => game.enemies[idx].col,
                kind: () => game.enemies[idx].kind,
                phase: () => game.enemies[idx].phase,
                inflationStage: () => game.enemies[idx].inflationStage,
                direction: () => game.enemies[idx].direction,
                isFireActive: () => game.enemies[idx].isFireActive,
                isFireTelegraph: () => game.enemies[idx].isFireTelegraph,
                tileSize: () => TILE_SIZE,
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
            const rockContainer = RockView({
                col: () => game.rocks[idx].smoothCol,
                row: () => game.rocks[idx].smoothRow,
                phase: () => game.rocks[idx].phase,
                isAlive: () => game.rocks[idx].isAlive,
                tileSize: () => TILE_SIZE,
            });
            rockLayer.addChild(rockContainer);
            rockContainers.push(rockContainer);
        }
    }
}

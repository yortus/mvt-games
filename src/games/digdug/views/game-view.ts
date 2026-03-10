import { Container, Graphics, Text, type Texture } from 'pixi.js';
import { createWatch } from '#utils';
import { TILE_SIZE, FIELD_ROWS, FIELD_COLS, DEPTH_LAYERS } from '../data';
import type { GameModel } from '../models';
import { createFieldView } from './field-view';
import { createDiggerView, type DiggerViewTextures } from './digger-view';
import { createEnemyView, type EnemyViewTextures } from './enemy-view';
import { createRockView, type RockViewTextures } from './rock-view';
import { createHudView } from './hud-view';
import { createKeyboardPlayerInputView } from './keyboard-player-input-view';

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
    const watchEnemyCount = createWatch(() => game.enemies.length);
    const watchRockCount = createWatch(() => game.rocks.length);
    const watchPhase = createWatch(() => game.phase);

    const canvasW = FIELD_COLS * TILE_SIZE;
    const canvasH = FIELD_ROWS * TILE_SIZE;

    const container = new Container();

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
    container.addChild(fieldContainer);

    // Digger
    const diggerContainer = createDiggerView({
        getX: () => game.digger.x,
        getY: () => game.digger.y,
        getDirection: () => game.digger.direction,
        getStepProgress: () => game.digger.stepProgress,
        isAlive: () => game.digger.alive,
        isHarpoonExtended: () => game.digger.harpoonExtended,
        getHarpoonDistance: () => game.digger.harpoonDistance,
        getTileSize: () => TILE_SIZE,
    }, textures.digger);
    container.addChild(diggerContainer);

    // Enemies — dynamic list
    let enemyContainers: Container[] = [];
    buildEnemies();

    // Rocks — dynamic list
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
    container.addChild(hudContainer);

    // Overlay (game over / level clear)
    const overlay = new Container();
    overlay.visible = false;
    const overlayBg = new Graphics();
    overlayBg.rect(0, 0, canvasW, canvasH).fill({ color: 0x000000, alpha: 0.6 });
    overlay.addChild(overlayBg);
    const overlayText = new Text({
        text: '',
        style: { fontFamily: 'monospace', fontSize: 24, fill: 0xffffff, align: 'center' },
    });
    overlayText.anchor.set(0.5);
    overlayText.position.set(canvasW / 2, canvasH / 2);
    overlay.addChild(overlayText);
    container.addChild(overlay);

    // Keyboard input
    container.addChild(createKeyboardPlayerInputView({
        onDirectionChange: (dir) => { game.playerInput.direction = dir; },
        onPumpChange: (pressed) => { game.playerInput.pumpPressed = pressed; },
        onRestartRequest: () => { game.playerInput.restartRequested = true; },
    }));

    container.onRender = refresh;
    return container;

    function refresh(): void {
        if (watchEnemyCount.changed()) buildEnemies();
        if (watchRockCount.changed()) buildRocks();

        if (watchPhase.changed()) {
            const phase = watchPhase.value;
            if (phase === 'playing' || phase === 'dying') {
                overlay.visible = false;
            } else if (phase === 'game-over') {
                overlay.visible = true;
                overlayText.text = 'GAME OVER\n\nPress Enter to restart';
            } else if (phase === 'level-clear') {
                overlay.visible = true;
                overlayText.text = 'LEVEL CLEAR!';
            }
        }
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
                getX: () => game.enemies[idx].x,
                getY: () => game.enemies[idx].y,
                getKind: () => game.enemies[idx].kind,
                getPhase: () => game.enemies[idx].phase,
                getInflationStage: () => game.enemies[idx].inflationStage,
                getDirection: () => game.enemies[idx].direction,
                isFireActive: () => game.enemies[idx].fireActive,
                isFireTelegraph: () => game.enemies[idx].fireTelegraph,
                getTileSize: () => TILE_SIZE,
            }, textures.enemy);
            container.addChild(enemyContainer);
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
            container.addChild(rockContainer);
            rockContainers.push(rockContainer);
        }
    }
}

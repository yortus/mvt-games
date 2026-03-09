import { Container, Graphics, Text } from 'pixi.js';
import { createWatch } from '#utils';
import type { TileKind, DepthLayer } from '../data';
import type {
    Direction,
    EnemyKind,
    EnemyPhase,
    InflationStage,
    RockPhase,
    GamePhase,
    PlayerInputModel,
} from '../models';
import { createFieldView } from './field-view';
import { createDiggerView } from './digger-view';
import { createEnemyView } from './enemy-view';
import { createRockView } from './rock-view';
import { createHudView } from './hud-view';
import { createKeyboardPlayerInputView } from './keyboard-player-input-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    // Field
    getTileSize(): number;
    getRows(): number;
    getCols(): number;
    getTileKind(row: number, col: number): TileKind;
    getDepthLayers(): readonly DepthLayer[];
    getTunnelCount(): number;
    // Digger
    getDiggerX(): number;
    getDiggerY(): number;
    getDiggerDirection(): Direction;
    getDiggerStepProgress(): number;
    isDiggerAlive(): boolean;
    isHarpoonExtended(): boolean;
    getHarpoonDistance(): number;
    // Enemies
    getEnemyCount(): number;
    getEnemyX(index: number): number;
    getEnemyY(index: number): number;
    getEnemyKind(index: number): EnemyKind;
    getEnemyPhase(index: number): EnemyPhase;
    getInflationStage(index: number): InflationStage;
    getEnemyDirection(index: number): Direction;
    isEnemyFireActive(index: number): boolean;
    isEnemyFireTelegraph(index: number): boolean;
    // Rocks
    getRockCount(): number;
    getRockX(index: number): number;
    getRockY(index: number): number;
    getRockPhase(index: number): RockPhase;
    isRockAlive(index: number): boolean;
    // HUD
    getScore(): number;
    getLives(): number;
    getLevel(): number;
    // State
    getGamePhase(): GamePhase;
    // Input
    getPlayerInput(): PlayerInputModel;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameView(bindings: GameViewBindings): Container {
    const watchTileSize = createWatch(bindings.getTileSize);
    const watchRows = createWatch(bindings.getRows);
    const watchCols = createWatch(bindings.getCols);
    const watchEnemyCount = createWatch(bindings.getEnemyCount);
    const watchRockCount = createWatch(bindings.getRockCount);
    const watchPhase = createWatch(bindings.getGamePhase);

    const container = new Container();

    // Field
    const fieldContainer = createFieldView({
        getTileSize: bindings.getTileSize,
        getRows: bindings.getRows,
        getCols: bindings.getCols,
        getTileKind: bindings.getTileKind,
        getDepthLayers: bindings.getDepthLayers,
        getTunnelCount: bindings.getTunnelCount,
        getGamePhase: bindings.getGamePhase,
    });
    container.addChild(fieldContainer);

    // Digger
    const diggerContainer = createDiggerView({
        getX: bindings.getDiggerX,
        getY: bindings.getDiggerY,
        getDirection: bindings.getDiggerDirection,
        getStepProgress: bindings.getDiggerStepProgress,
        isAlive: bindings.isDiggerAlive,
        isHarpoonExtended: bindings.isHarpoonExtended,
        getHarpoonDistance: bindings.getHarpoonDistance,
        getTileSize: bindings.getTileSize,
    });
    container.addChild(diggerContainer);

    // Enemies — dynamic list
    let enemyContainers: Container[] = [];
    buildEnemies();

    // Rocks — dynamic list
    let rockContainers: Container[] = [];
    buildRocks();

    // HUD
    const hudContainer = createHudView({
        getScore: bindings.getScore,
        getLives: bindings.getLives,
        getLevel: bindings.getLevel,
        getTileSize: bindings.getTileSize,
        getCols: bindings.getCols,
    });
    container.addChild(hudContainer);

    // Overlay (game over / level clear)
    const overlay = new Container();
    overlay.visible = false;
    const overlayBg = new Graphics();
    overlay.addChild(overlayBg);
    const overlayText = new Text({
        text: '',
        style: { fontFamily: 'monospace', fontSize: 24, fill: 0xffffff, align: 'center' },
    });
    overlayText.anchor.set(0.5);
    overlay.addChild(overlayText);
    container.addChild(overlay);

    // Keyboard input
    container.addChild(createKeyboardPlayerInputView(bindings.getPlayerInput()));

    updateLayout();
    container.onRender = refresh;
    return container;

    function refresh(): void {
        const dimsChanged = watchTileSize.changed() | watchRows.changed() | watchCols.changed();
        if (dimsChanged) updateLayout();

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

    function buildEnemies(): void {
        for (let i = 0; i < enemyContainers.length; i++) {
            enemyContainers[i].destroy();
        }
        enemyContainers = [];

        const count = bindings.getEnemyCount();
        for (let i = 0; i < count; i++) {
            const idx = i;
            const enemyContainer = createEnemyView({
                getX: () => bindings.getEnemyX(idx),
                getY: () => bindings.getEnemyY(idx),
                getKind: () => bindings.getEnemyKind(idx),
                getPhase: () => bindings.getEnemyPhase(idx),
                getInflationStage: () => bindings.getInflationStage(idx),
                getDirection: () => bindings.getEnemyDirection(idx),
                isFireActive: () => bindings.isEnemyFireActive(idx),
                isFireTelegraph: () => bindings.isEnemyFireTelegraph(idx),
                getTileSize: bindings.getTileSize,
            });
            container.addChild(enemyContainer);
            enemyContainers.push(enemyContainer);
        }
    }

    function buildRocks(): void {
        for (let i = 0; i < rockContainers.length; i++) {
            rockContainers[i].destroy();
        }
        rockContainers = [];

        const count = bindings.getRockCount();
        for (let i = 0; i < count; i++) {
            const idx = i;
            const rockContainer = createRockView({
                getX: () => bindings.getRockX(idx),
                getY: () => bindings.getRockY(idx),
                getPhase: () => bindings.getRockPhase(idx),
                isAlive: () => bindings.isRockAlive(idx),
                getTileSize: bindings.getTileSize,
            });
            container.addChild(rockContainer);
            rockContainers.push(rockContainer);
        }
    }
}

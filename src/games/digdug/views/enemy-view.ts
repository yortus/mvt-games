import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { createWatch } from '#utils';
import { type EnemyKind, type EnemyPhase, type InflationStage, type Direction } from '../models';

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

export interface EnemyViewTextures {
    readonly pooka: Texture;
    readonly 'pooka-inflate1': Texture;
    readonly 'pooka-inflate2': Texture;
    readonly 'pooka-inflate3': Texture;
    readonly 'pooka-crushed': Texture;
    readonly fygar: Texture;
    readonly 'fygar-inflate1': Texture;
    readonly 'fygar-inflate2': Texture;
    readonly 'fygar-inflate3': Texture;
    readonly 'fygar-crushed': Texture;
    readonly 'ghost-eyes': Texture;
}

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface EnemyViewBindings {
    getRow(): number;
    getCol(): number;
    getKind(): EnemyKind;
    getPhase(): EnemyPhase;
    getInflationStage(): InflationStage;
    getDirection(): Direction;
    isFireActive(): boolean;
    isFireTelegraph(): boolean;
    getTileSize(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createEnemyView(
    bindings: EnemyViewBindings,
    textures: EnemyViewTextures,
): Container {
    const watchKind = createWatch(bindings.getKind);
    const watchPhase = createWatch(bindings.getPhase);
    const watchInflation = createWatch(bindings.getInflationStage);
    const watchTileSize = createWatch(bindings.getTileSize);
    const watchDirection = createWatch(bindings.getDirection);
    const watchFire = createWatch(bindings.isFireActive);
    const watchTelegraph = createWatch(bindings.isFireTelegraph);

    const container = new Container();
    const sprite = new Sprite({ texture: textures[bindings.getKind()], anchor: 0.5 });
    const fireGfx = new Graphics();
    const telegraphGfx = new Graphics();
    container.addChild(sprite);
    container.addChild(telegraphGfx);
    container.addChild(fireGfx);

    sprite.scale.set(watchTileSize.value / 20);
    container.onRender = refresh;
    return container;

    function refresh(): void {
        const ts = watchTileSize.value;
        const col = bindings.getCol();
        const row = bindings.getRow();
        const x = col * ts + ts / 2;
        const y = row * ts + ts / 2;
        container.position.set(x, y);

        const phaseChanged = watchPhase.changed();
        const inflationChanged = watchInflation.changed();
        const kindChanged = watchKind.changed();
        const tsChanged = watchTileSize.changed();
        const dirChanged = watchDirection.changed();
        const fireChanged = watchFire.changed();
        const telegraphChanged = watchTelegraph.changed();

        const phase = bindings.getPhase();

        if (phase === 'popped') {
            container.visible = false;
            return;
        }
        container.visible = true;

        if (phase === 'ghosting') {
            if (phaseChanged || tsChanged) {
                sprite.texture = textures['ghost-eyes'];
                updateScale(0);
            }
            container.scale.x = bindings.getDirection() === 'left' ? -1 : 1;
            fireGfx.clear();
            telegraphGfx.clear();
            return;
        }

        if (phaseChanged || inflationChanged || kindChanged || tsChanged) {
            const kind = bindings.getKind();
            const inflation = bindings.getInflationStage();
            sprite.texture = pickTexture(kind, phase, inflation);
            updateScale(inflation);
        }

        // Direction flip
        container.scale.x = bindings.getDirection() === 'left' ? -1 : 1;

        // Fygar fire (stays procedural — variable shape)
        if (fireChanged || dirChanged || tsChanged) {
            fireGfx.clear();
            if (bindings.isFireActive() && bindings.getKind() === 'fygar') {
                const dir = bindings.getDirection();
                if (dir === 'left' || dir === 'right') {
                    const fireLen = 3 * ts;
                    fireGfx.rect(ts * 0.3, -ts * 0.2, fireLen, ts * 0.4).fill(0xff6600);
                    fireGfx.rect(ts * 0.5, -ts * 0.15, fireLen * 0.7, ts * 0.3).fill(0xff3300);
                }
            }
        }

        // Fygar fire telegraph
        if (telegraphChanged || dirChanged || tsChanged) {
            telegraphGfx.clear();
            if (bindings.isFireTelegraph() && bindings.getKind() === 'fygar') {
                const mr = ts * 0.4;
                telegraphGfx.circle(mr * 0.8, -mr * 0.35, mr * 0.2).fill({ color: 0xff4400, alpha: 0.7 });
                telegraphGfx.circle(mr * 0.8, -mr * 0.35, mr * 0.3).fill({ color: 0xff6600, alpha: 0.3 });
            }
        }
    }

    function pickTexture(kind: EnemyKind, phase: EnemyPhase, inflation: InflationStage): Texture {
        if (phase === 'crushed') {
            return textures[kind === 'pooka' ? 'pooka-crushed' : 'fygar-crushed'];
        }
        if (inflation === 0) return textures[kind];
        return inflateTexture(kind, inflation) ?? textures[kind];
    }

    function inflateTexture(kind: EnemyKind, stage: InflationStage): Texture | undefined {
        if (kind === 'pooka') {
            if (stage === 1) return textures['pooka-inflate1'];
            if (stage === 2) return textures['pooka-inflate2'];
            if (stage === 3) return textures['pooka-inflate3'];
        } else {
            if (stage === 1) return textures['fygar-inflate1'];
            if (stage === 2) return textures['fygar-inflate2'];
            if (stage === 3) return textures['fygar-inflate3'];
        }
        return undefined;
    }

    function updateScale(inflation: InflationStage): void {
        const base = watchTileSize.value / 20;
        const inflScale = 1.0 + inflation * 0.3;
        sprite.scale.set(base * inflScale);
    }
}

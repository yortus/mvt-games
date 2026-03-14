import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { watch } from '#common';
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
    const watcher = watch({
        kind: bindings.getKind,
        phase: bindings.getPhase,
        inflation: bindings.getInflationStage,
        tileSize: bindings.getTileSize,
        direction: bindings.getDirection,
        fire: bindings.isFireActive,
        telegraph: bindings.isFireTelegraph,
    });

    const view = new Container();
    const sprite = new Sprite({ texture: textures[bindings.getKind()], anchor: 0.5 });
    const fireGfx = new Graphics();
    const telegraphGfx = new Graphics();
    view.addChild(sprite);
    view.addChild(telegraphGfx);
    view.addChild(fireGfx);

    view.onRender = refresh;
    return view;

    function refresh(): void {
        const watched = watcher.poll();
        const ts = bindings.getTileSize();
        const col = bindings.getCol();
        const row = bindings.getRow();
        const x = col * ts + ts / 2;
        const y = row * ts + ts / 2;
        view.position.set(x, y);

        const phase = bindings.getPhase();
        view.visible = phase !== 'popped';
        if (phase === 'popped') return;

        if (phase === 'ghosting') {
            if (watched.phase.changed || watched.tileSize.changed) {
                sprite.texture = textures['ghost-eyes'];
                updateScale(0);
            }
            view.scale.x = bindings.getDirection() === 'left' ? -1 : 1;
            fireGfx.clear();
            telegraphGfx.clear();
            return;
        }

        if (watched.phase.changed || watched.inflation.changed || watched.kind.changed || watched.tileSize.changed) {
            const kind = bindings.getKind();
            const inflation = bindings.getInflationStage();
            sprite.texture = pickTexture(kind, phase, inflation);
            updateScale(inflation);
        }

        // Direction flip
        view.scale.x = bindings.getDirection() === 'left' ? -1 : 1;

        // Fygar fire (stays procedural - variable shape)
        if (watched.fire.changed || watched.direction.changed || watched.tileSize.changed) {
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
        if (watched.telegraph.changed || watched.direction.changed || watched.tileSize.changed) {
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
        const base = bindings.getTileSize() / 20;
        const inflScale = 1.0 + inflation * 0.3;
        sprite.scale.set(base * inflScale);
    }
}

import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { watch } from '#common';
import { type EnemyKind, type EnemyPhase, type InflationStage, type Direction } from '../models';
import { getTexture } from '../data';

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

export function createEnemyView(bindings: EnemyViewBindings): Container {
    const watcher = watch({
        kind: bindings.getKind,
        phase: bindings.getPhase,
        inflation: bindings.getInflationStage,
        tileSize: bindings.getTileSize,
        direction: bindings.getDirection,
        fire: bindings.isFireActive,
        telegraph: bindings.isFireTelegraph,
    });

    let sprite: Sprite;
    let fireGfx: Graphics;
    let telegraphGfx: Graphics;

    let pookaTextures: EnemyTextures;
    let fygarTextures: EnemyTextures;
    let ghostEyesTex: Texture;

    const view = new Container();
    initialiseView();
    view.onRender = refresh;
    return view;

    function initialiseView(): void {
        pookaTextures = {
            normal: getTexture('pooka'),
            inflate1: getTexture('pooka-inflate1'),
            inflate2: getTexture('pooka-inflate2'),
            inflate3: getTexture('pooka-inflate3'),
            crushed: getTexture('pooka-crushed'),
        };
        fygarTextures = {
            normal: getTexture('fygar'),
            inflate1: getTexture('fygar-inflate1'),
            inflate2: getTexture('fygar-inflate2'),
            inflate3: getTexture('fygar-inflate3'),
            crushed: getTexture('fygar-crushed'),
        };
        ghostEyesTex = getTexture('ghost-eyes');

        const kind = bindings.getKind();
        sprite = new Sprite({ texture: kindTexturesFor(kind).normal, anchor: 0.5 });
        fireGfx = new Graphics();
        telegraphGfx = new Graphics();
        view.addChild(sprite);
        view.addChild(telegraphGfx);
        view.addChild(fireGfx);
    }

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
                sprite.texture = ghostEyesTex;
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

    function kindTexturesFor(kind: EnemyKind): EnemyTextures {
        return kind === 'pooka' ? pookaTextures : fygarTextures;
    }

    function pickTexture(kind: EnemyKind, phase: EnemyPhase, inflation: InflationStage): Texture {
        const kt = kindTexturesFor(kind);
        if (phase === 'crushed') return kt.crushed;
        if (inflation === 0) return kt.normal;
        return inflateTexture(kt, inflation) ?? kt.normal;
    }

    function inflateTexture(kt: EnemyTextures, stage: InflationStage): Texture | undefined {
        if (stage === 1) return kt.inflate1;
        if (stage === 2) return kt.inflate2;
        if (stage === 3) return kt.inflate3;
        return undefined;
    }

    function updateScale(inflation: InflationStage): void {
        const base = bindings.getTileSize() / 20;
        const inflScale = 1.0 + inflation * 0.3;
        sprite.scale.set(base * inflScale);
    }
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface EnemyTextures {
    readonly normal: Texture;
    readonly inflate1: Texture;
    readonly inflate2: Texture;
    readonly inflate3: Texture;
    readonly crushed: Texture;
}

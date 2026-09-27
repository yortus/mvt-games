import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { watch } from '#common';
import { textures } from '../data';
import { type EnemyKind, type EnemyPhase, type InflationStage, type Direction } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface EnemyViewBindings {
    row: () => number;
    col: () => number;
    kind: () => EnemyKind;
    phase: () => EnemyPhase;
    inflationStage: () => InflationStage;
    direction: () => Direction;
    isFireActive: () => boolean;
    isFireTelegraph: () => boolean;
    tileSize: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function EnemyView(bindings: EnemyViewBindings): Container {
    const watcher = watch({
        kind: bindings.kind,
        phase: bindings.phase,
        inflation: bindings.inflationStage,
        tileSize: bindings.tileSize,
        direction: bindings.direction,
        fire: bindings.isFireActive,
        telegraph: bindings.isFireTelegraph,
    });

    const tx = textures.get();
    let sprite: Sprite;
    let fireGfx: Graphics;
    let telegraphGfx: Graphics;

    const view = new Container();
    initialiseView();
    view.onRefresh = refresh;
    return view;

    function initialiseView(): void {
        // No texture yet: the view may be built before it has an enemy (in a
        // list slot, say). The first refresh sets it, since the watcher reports
        // every value as changed on its first poll.
        sprite = new Sprite({ anchor: 0.5 });
        fireGfx = new Graphics();
        telegraphGfx = new Graphics();
        view.addChild(sprite);
        view.addChild(telegraphGfx);
        view.addChild(fireGfx);
    }

    function refresh(): void {
        const watched = watcher.poll();
        const ts = bindings.tileSize();
        const col = bindings.col();
        const row = bindings.row();
        const x = col * ts + ts / 2;
        const y = row * ts + ts / 2;
        view.position.set(x, y);

        const phase = bindings.phase();
        view.visible = phase !== 'popped';
        if (phase === 'popped') return;

        if (phase === 'ghosting') {
            if (watched.phase.changed || watched.tileSize.changed) {
                sprite.texture = tx.ghostEyes;
                updateScale(0);
            }
            view.scale.x = bindings.direction() === 'left' ? -1 : 1;
            fireGfx.clear();
            telegraphGfx.clear();
            return;
        }

        if (watched.phase.changed || watched.inflation.changed || watched.kind.changed || watched.tileSize.changed) {
            const kind = bindings.kind();
            const inflation = bindings.inflationStage();
            sprite.texture = pickTexture(kind, phase, inflation);
            updateScale(inflation);
        }

        // Direction flip
        view.scale.x = bindings.direction() === 'left' ? -1 : 1;

        // Fygar fire (stays procedural - variable shape)
        if (watched.fire.changed || watched.direction.changed || watched.tileSize.changed) {
            fireGfx.clear();
            if (bindings.isFireActive() && bindings.kind() === 'fygar') {
                const dir = bindings.direction();
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
            if (bindings.isFireTelegraph() && bindings.kind() === 'fygar') {
                const mr = ts * 0.4;
                telegraphGfx.circle(mr * 0.8, -mr * 0.35, mr * 0.2).fill({ color: 0xff4400, alpha: 0.7 });
                telegraphGfx.circle(mr * 0.8, -mr * 0.35, mr * 0.3).fill({ color: 0xff6600, alpha: 0.3 });
            }
        }
    }

    function pickTexture(kind: EnemyKind, phase: EnemyPhase, inflation: InflationStage): Texture {
        const kt = tx[kind];
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
        const base = bindings.tileSize() / 20;
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

import { Container, Graphics } from 'pixi.js';
import { createWatch } from '#utils';
import type { EnemyKind, EnemyPhase, InflationStage, Direction } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface EnemyViewBindings {
    getX(): number;
    getY(): number;
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
    const watchKind = createWatch(bindings.getKind);
    const watchPhase = createWatch(bindings.getPhase);
    const watchInflation = createWatch(bindings.getInflationStage);
    const watchTileSize = createWatch(bindings.getTileSize);
    const watchDirection = createWatch(bindings.getDirection);
    const watchFire = createWatch(bindings.isFireActive);
    const watchTelegraph = createWatch(bindings.isFireTelegraph);

    const container = new Container();
    const bodyGfx = new Graphics();
    const fireGfx = new Graphics();
    const telegraphGfx = new Graphics();
    container.addChild(bodyGfx);
    container.addChild(telegraphGfx);
    container.addChild(fireGfx);

    drawEnemy();
    container.onRender = refresh;
    return container;

    function refresh(): void {
        const ts = watchTileSize.value;
        const x = bindings.getX() * ts + ts / 2;
        const y = bindings.getY() * ts + ts / 2;
        container.position.set(x, y);

        const phaseChanged = watchPhase.changed();
        const inflationChanged = watchInflation.changed();
        const kindChanged = watchKind.changed();
        const tsChanged = watchTileSize.changed();
        const dirChanged = watchDirection.changed();
        const fireChanged = watchFire.changed();
        const telegraphChanged = watchTelegraph.changed();

        const phase = bindings.getPhase();

        // Hide if popped
        if (phase === 'popped') {
            container.visible = false;
            return;
        }
        container.visible = true;

        // Ghosting — just a pair of eyes
        if (phase === 'ghosting') {
            container.alpha = 1.0;
            if (phaseChanged || tsChanged) drawGhost();
            container.scale.x = bindings.getDirection() === 'left' ? -1 : 1;
            return;
        }
        container.alpha = 1.0;

        if (phaseChanged || inflationChanged || kindChanged || tsChanged || dirChanged) {
            drawEnemy();
        }

        // Direction flip
        container.scale.x = bindings.getDirection() === 'left' ? -1 : 1;

        // Fygar fire
        if (fireChanged || dirChanged || tsChanged) {
            fireGfx.clear();
            if (bindings.isFireActive() && bindings.getKind() === 'fygar') {
                const dir = bindings.getDirection();
                if (dir === 'left' || dir === 'right') {
                    const fireLen = 3 * ts;
                    const dc = 1; // always draw to the right, flip handles left
                    fireGfx.rect(ts * 0.3 * dc, -ts * 0.2, fireLen, ts * 0.4).fill(0xff6600);
                    fireGfx.rect(ts * 0.5 * dc, -ts * 0.15, fireLen * 0.7, ts * 0.3).fill(0xff3300);
                }
            }
        }

        // Fygar fire telegraph — glowing mouth
        if (telegraphChanged || dirChanged || tsChanged) {
            telegraphGfx.clear();
            if (bindings.isFireTelegraph() && bindings.getKind() === 'fygar') {
                const mr = ts * 0.4;
                telegraphGfx.circle(mr * 0.8, -mr * 0.35, mr * 0.2).fill({ color: 0xff4400, alpha: 0.7 });
                telegraphGfx.circle(mr * 0.8, -mr * 0.35, mr * 0.3).fill({ color: 0xff6600, alpha: 0.3 });
            }
        }
    }

    function drawEnemy(): void {
        bodyGfx.clear();
        const ts = watchTileSize.value;
        const r = ts * 0.4;
        const kind = bindings.getKind();
        const inflation = bindings.getInflationStage();
        const phase = bindings.getPhase();

        // Inflation scaling
        const scale = 1.0 + inflation * 0.3;
        const sr = r * scale;

        if (phase === 'crushed') {
            // Flattened
            bodyGfx.rect(-sr, -sr * 0.1, sr * 2, sr * 0.2).fill(kind === 'pooka' ? 0xff4444 : 0x44cc44);
            return;
        }

        if (kind === 'pooka') {
            drawPooka(sr, inflation);
        } else {
            drawFygar(sr, inflation);
        }
    }

    function drawPooka(sr: number, inflation: InflationStage): void {
        // Teardrop / blob body — wider bottom, narrower top
        const baseColor = lerpColor(0xff4444, 0xffaaaa, inflation / 4);

        // Main body — rounded bottom rectangle with a dome top
        const bodyW = sr * 1.6;
        const bodyH = sr * 1.4;
        // Bottom round blob
        bodyGfx.roundRect(-bodyW / 2, -bodyH * 0.2, bodyW, bodyH, sr * 0.5).fill(baseColor);
        // Top dome — slightly narrower
        bodyGfx.ellipse(0, -bodyH * 0.25, bodyW * 0.4, sr * 0.6).fill(baseColor);

        // Goggles
        const eyeR = sr * 0.22;
        const eyeY = -sr * 0.25;
        // Goggle strap
        bodyGfx.rect(-sr * 0.65, eyeY - eyeR * 0.5, sr * 1.3, eyeR * 1.1).fill(0xffffff);
        // Lenses — big round eyes
        bodyGfx.circle(-sr * 0.25, eyeY, eyeR * 1.1).fill(0xffffff);
        bodyGfx.circle(sr * 0.25, eyeY, eyeR * 1.1).fill(0xffffff);
        // Pupils — looking sideways for cuteness
        const pupilR = eyeR * 0.55;
        bodyGfx.circle(-sr * 0.18, eyeY, pupilR).fill(0x000000);
        bodyGfx.circle(sr * 0.32, eyeY, pupilR).fill(0x000000);

        // Cheeks — rosy spots for cuteness
        bodyGfx.circle(-sr * 0.55, sr * 0.05, sr * 0.15).fill({ color: 0xff8888, alpha: 0.5 });
        bodyGfx.circle(sr * 0.55, sr * 0.05, sr * 0.15).fill({ color: 0xff8888, alpha: 0.5 });

        // Feet (two little nubs at bottom)
        if (inflation === 0) {
            bodyGfx.ellipse(-sr * 0.35, sr * 1.0, sr * 0.2, sr * 0.12).fill(baseColor);
            bodyGfx.ellipse(sr * 0.35, sr * 1.0, sr * 0.2, sr * 0.12).fill(baseColor);
        }
    }

    function drawFygar(sr: number, inflation: InflationStage): void {
        const baseColor = lerpColor(0x44cc44, 0xaaffaa, inflation / 4);
        const bellyColor = lerpColor(0xccee88, 0xeeffcc, inflation / 4);

        // Chunky rounded body — cute dragon
        bodyGfx.roundRect(-sr * 0.7, -sr * 0.6, sr * 1.4, sr * 1.3, sr * 0.45).fill(baseColor);

        // Lighter belly patch
        bodyGfx.ellipse(0, sr * 0.15, sr * 0.45, sr * 0.4).fill(bellyColor);

        // Head bump — slightly raised from body
        bodyGfx.ellipse(sr * 0.2, -sr * 0.55, sr * 0.5, sr * 0.4).fill(baseColor);

        // Snout — short rounded muzzle
        bodyGfx.ellipse(sr * 0.65, -sr * 0.4, sr * 0.25, sr * 0.2).fill(baseColor);
        // Nostril
        bodyGfx.circle(sr * 0.8, -sr * 0.45, sr * 0.06).fill(0x226622);

        // Big cute eyes
        const eyeR = sr * 0.22;
        const eyeY = -sr * 0.55;
        bodyGfx.circle(sr * 0.15, eyeY, eyeR).fill(0xffffff);
        bodyGfx.circle(sr * 0.45, eyeY, eyeR * 0.8).fill(0xffffff);
        // Pupils
        bodyGfx.circle(sr * 0.2, eyeY, eyeR * 0.45).fill(0x000000);
        bodyGfx.circle(sr * 0.48, eyeY, eyeR * 0.35).fill(0x000000);
        // Eye shine
        bodyGfx.circle(sr * 0.12, eyeY - eyeR * 0.3, eyeR * 0.18).fill(0xffffff);
        bodyGfx.circle(sr * 0.42, eyeY - eyeR * 0.25, eyeR * 0.14).fill(0xffffff);

        if (inflation === 0) {
            // Small wings on back
            bodyGfx.moveTo(-sr * 0.4, -sr * 0.5)
                .lineTo(-sr * 0.7, -sr * 1.0)
                .lineTo(-sr * 0.15, -sr * 0.55)
                .closePath().fill(lerpColor(baseColor, 0x66dd66, 0.3));
            bodyGfx.moveTo(-sr * 0.55, -sr * 0.4)
                .lineTo(-sr * 0.9, -sr * 0.85)
                .lineTo(-sr * 0.3, -sr * 0.45)
                .closePath().fill(lerpColor(baseColor, 0x66dd66, 0.3));

            // Stubby tail
            bodyGfx.moveTo(-sr * 0.7, sr * 0.3)
                .lineTo(-sr * 1.1, sr * 0.15)
                .lineTo(-sr * 1.0, sr * 0.45)
                .lineTo(-sr * 0.7, sr * 0.5)
                .closePath().fill(baseColor);

            // Little feet
            bodyGfx.ellipse(-sr * 0.35, sr * 0.7, sr * 0.18, sr * 0.1).fill(baseColor);
            bodyGfx.ellipse(sr * 0.2, sr * 0.7, sr * 0.18, sr * 0.1).fill(baseColor);
        }
    }

    function drawGhost(): void {
        bodyGfx.clear();
        const ts = watchTileSize.value;
        const r = ts * 0.35;

        // Just a pair of eyes — same for both pooka and fygar
        const eyeR = r * 0.35;
        const eyeY = -r * 0.1;

        // White eyeballs
        bodyGfx.circle(-r * 0.3, eyeY, eyeR).fill(0xffffff);
        bodyGfx.circle(r * 0.3, eyeY, eyeR).fill(0xffffff);

        // Pupils — looking toward their facing direction
        const pupilR = eyeR * 0.55;
        bodyGfx.circle(-r * 0.22, eyeY, pupilR).fill(0x000000);
        bodyGfx.circle(r * 0.38, eyeY, pupilR).fill(0x000000);
    }

    function lerpColor(c1: number, c2: number, t: number): number {
        const r1 = (c1 >> 16) & 0xff;
        const g1 = (c1 >> 8) & 0xff;
        const b1 = c1 & 0xff;
        const r2 = (c2 >> 16) & 0xff;
        const g2 = (c2 >> 8) & 0xff;
        const b2 = c2 & 0xff;
        const r = (r1 + (r2 - r1) * t) | 0;
        const g = (g1 + (g2 - g1) * t) | 0;
        const b = (b1 + (b2 - b1) * t) | 0;
        return (r << 16) | (g << 8) | b;
    }
}

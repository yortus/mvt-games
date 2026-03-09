import { Container, Graphics } from 'pixi.js';
import { createWatch } from '#utils';
import type { EnemyKind, EnemyPhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface EnemyViewBindings {
    getX(): number;
    getY(): number;
    getKind(): EnemyKind;
    getPhase(): EnemyPhase;
    isAlive(): boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createEnemyView(bindings: EnemyViewBindings): Container {
    const watchKind = createWatch(bindings.getKind);
    const watchPhase = createWatch(bindings.getPhase);

    const container = new Container();
    const bodyGfx = new Graphics();
    container.addChild(bodyGfx);

    drawEnemy();
    container.onRender = refresh;
    return container;

    function refresh(): void {
        const phase = bindings.getPhase();

        if (phase === 'dead' || phase === 'entering') {
            container.visible = false;
            watchPhase.changed();
            watchKind.changed();
            return;
        }
        container.visible = true;

        container.position.set(bindings.getX(), bindings.getY());

        if (watchPhase.changed() | watchKind.changed()) {
            drawEnemy();
        }
    }

    function drawEnemy(): void {
        bodyGfx.clear();
        const kind = bindings.getKind();

        switch (kind) {
            case 'boss':
                drawBoss();
                break;
            case 'butterfly':
                drawButterfly();
                break;
            case 'bee':
                drawBee();
                break;
        }
    }

    function drawBoss(): void {
        // Large blue/purple commander — beetle-like

        // Main body
        bodyGfx.roundRect(-8, -6, 16, 14, 4).fill(0x4444cc);

        // Crown / helmet top
        bodyGfx
            .moveTo(-6, -6)
            .lineTo(-8, -12)
            .lineTo(-3, -8)
            .lineTo(0, -14)
            .lineTo(3, -8)
            .lineTo(8, -12)
            .lineTo(6, -6)
            .closePath()
            .fill(0x6666ff);

        // Face plate
        bodyGfx.roundRect(-6, -5, 12, 8, 3).fill(0x5555dd);

        // Eyes — large, menacing
        bodyGfx.circle(-3, -2, 3).fill(0xffffff);
        bodyGfx.circle(3, -2, 3).fill(0xffffff);
        bodyGfx.circle(-3, -1.5, 1.5).fill(0xff0000);
        bodyGfx.circle(3, -1.5, 1.5).fill(0xff0000);

        // Jaw
        bodyGfx.rect(-4, 3, 8, 3).fill(0x3333aa);

        // Wings / side panels
        bodyGfx
            .moveTo(-8, 0)
            .lineTo(-13, -4)
            .lineTo(-13, 6)
            .lineTo(-8, 8)
            .closePath()
            .fill(0x5555cc);
        bodyGfx
            .moveTo(8, 0)
            .lineTo(13, -4)
            .lineTo(13, 6)
            .lineTo(8, 8)
            .closePath()
            .fill(0x5555cc);
    }

    function drawButterfly(): void {
        // Red/pink angular butterfly

        // Body — slim vertical
        bodyGfx.roundRect(-2, -7, 4, 14, 2).fill(0xcc3344);

        // Upper wings — angular
        bodyGfx
            .moveTo(-2, -5)
            .lineTo(-10, -10)
            .lineTo(-12, -2)
            .lineTo(-2, 0)
            .closePath()
            .fill(0xff4466);
        bodyGfx
            .moveTo(2, -5)
            .lineTo(10, -10)
            .lineTo(12, -2)
            .lineTo(2, 0)
            .closePath()
            .fill(0xff4466);

        // Lower wings — smaller
        bodyGfx
            .moveTo(-2, 1)
            .lineTo(-8, 4)
            .lineTo(-6, 8)
            .lineTo(-2, 5)
            .closePath()
            .fill(0xdd3355);
        bodyGfx
            .moveTo(2, 1)
            .lineTo(8, 4)
            .lineTo(6, 8)
            .lineTo(2, 5)
            .closePath()
            .fill(0xdd3355);

        // Wing spots
        bodyGfx.circle(-7, -5, 2).fill(0xffaa88);
        bodyGfx.circle(7, -5, 2).fill(0xffaa88);

        // Eyes
        bodyGfx.circle(-2, -6, 1.5).fill(0xffffff);
        bodyGfx.circle(2, -6, 1.5).fill(0xffffff);
        bodyGfx.circle(-2, -5.5, 0.8).fill(0x000000);
        bodyGfx.circle(2, -5.5, 0.8).fill(0x000000);

        // Antennae
        bodyGfx.moveTo(-1, -7).lineTo(-4, -12).stroke({ color: 0xff4466, width: 1 });
        bodyGfx.moveTo(1, -7).lineTo(4, -12).stroke({ color: 0xff4466, width: 1 });
        bodyGfx.circle(-4, -12, 1).fill(0xff6688);
        bodyGfx.circle(4, -12, 1).fill(0xff6688);
    }

    function drawBee(): void {
        // Yellow/black compact bee

        // Body — oval
        bodyGfx.ellipse(0, 0, 6, 8).fill(0xffcc00);

        // Stripes
        bodyGfx.rect(-6, -2, 12, 3).fill(0x222200);
        bodyGfx.rect(-5, 3, 10, 2).fill(0x222200);

        // Head
        bodyGfx.ellipse(0, -7, 4, 3).fill(0xffdd44);

        // Eyes
        bodyGfx.circle(-2, -7, 1.5).fill(0xffffff);
        bodyGfx.circle(2, -7, 1.5).fill(0xffffff);
        bodyGfx.circle(-2, -6.5, 0.8).fill(0x000000);
        bodyGfx.circle(2, -6.5, 0.8).fill(0x000000);

        // Wings — small translucent
        bodyGfx.ellipse(-6, -3, 4, 3).fill({ color: 0xaaddff, alpha: 0.5 });
        bodyGfx.ellipse(6, -3, 4, 3).fill({ color: 0xaaddff, alpha: 0.5 });

        // Stinger
        bodyGfx
            .moveTo(-1, 8)
            .lineTo(0, 11)
            .lineTo(1, 8)
            .closePath()
            .fill(0xddaa00);

        // Antennae
        bodyGfx.moveTo(-1, -10).lineTo(-3, -13).stroke({ color: 0xffcc00, width: 1 });
        bodyGfx.moveTo(1, -10).lineTo(3, -13).stroke({ color: 0xffcc00, width: 1 });
    }
}

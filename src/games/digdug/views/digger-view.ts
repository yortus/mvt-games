import { Container, Graphics } from 'pixi.js';
import { createWatch } from '#utils';
import type { Direction } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DiggerViewBindings {
    getX(): number;
    getY(): number;
    getDirection(): Direction;
    getStepProgress(): number;
    isAlive(): boolean;
    isHarpoonExtended(): boolean;
    getHarpoonDistance(): number;
    getTileSize(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDiggerView(bindings: DiggerViewBindings): Container {
    const watchDirection = createWatch(bindings.getDirection);
    const watchTileSize = createWatch(bindings.getTileSize);
    const watchAlive = createWatch(bindings.isAlive);
    const watchHarpoon = createWatch(bindings.isHarpoonExtended);

    const container = new Container();
    const bodyGfx = new Graphics();
    const harpoonGfx = new Graphics();
    container.addChild(bodyGfx);
    container.addChild(harpoonGfx);

    let prevPose: 'idle' | 'walk-a' | 'walk-b' | 'pump' = 'idle';
    let prevVertical = false;

    drawBody();
    container.onRender = refresh;
    return container;

    function refresh(): void {
        const ts = watchTileSize.value;
        const x = bindings.getX() * ts + ts / 2;
        const y = bindings.getY() * ts + ts / 2;
        container.position.set(x, y);

        const aliveChanged = watchAlive.changed();
        if (aliveChanged) {
            container.visible = watchAlive.value;
        }

        if (!bindings.isAlive()) return;

        // Determine pose
        const harpoonChanged = watchHarpoon.changed();
        const dirChanged = watchDirection.changed();
        const tsChanged = watchTileSize.changed();
        const progress = bindings.getStepProgress();
        const isHarpoon = bindings.isHarpoonExtended();
        const dir = watchDirection.value;
        const vertical = dir === 'up' || dir === 'down';

        let pose: 'idle' | 'walk-a' | 'walk-b' | 'pump';
        if (isHarpoon) {
            pose = 'pump';
        } else if (progress < 0.01) {
            pose = 'idle';
        } else {
            pose = Math.sin(progress * Math.PI * 4) > 0 ? 'walk-b' : 'walk-a';
        }

        if (pose !== prevPose || dirChanged || tsChanged || harpoonChanged || vertical !== prevVertical) {
            prevPose = pose;
            prevVertical = vertical;
            drawBody();
        }

        // Horizontal flip via scale.x — never rotate for left/right
        if (dir === 'left') {
            container.scale.x = -1;
            container.rotation = 0;
        } else if (dir === 'up') {
            container.scale.x = 1;
            container.rotation = -Math.PI / 2;
        } else if (dir === 'down') {
            container.scale.x = 1;
            container.rotation = Math.PI / 2;
        } else {
            // 'right' or 'none' — default facing
            container.scale.x = 1;
            container.rotation = 0;
        }

        // Harpoon line
        drawHarpoon();
    }

    function drawHarpoon(): void {
        harpoonGfx.clear();
        if (!bindings.isHarpoonExtended()) return;

        const ts = watchTileSize.value;
        const dist = bindings.getHarpoonDistance();
        const harpoonLen = dist * ts;
        if (harpoonLen < 1) return;

        const startX = ts * 0.35;
        // Draw harpoon rope
        harpoonGfx
            .moveTo(startX, -1)
            .lineTo(startX + harpoonLen, -1)
            .moveTo(startX, 1)
            .lineTo(startX + harpoonLen, 1)
            .stroke({ color: 0xffffff, width: 1 });

        // Harpoon tip — arrow shape
        const tipX = startX + harpoonLen;
        harpoonGfx
            .moveTo(tipX, -4)
            .lineTo(tipX + 6, 0)
            .lineTo(tipX, 4)
            .closePath()
            .fill(0xff2222);

        // Harpoon tip barbs
        harpoonGfx
            .moveTo(tipX + 3, -3)
            .lineTo(tipX + 1, -6)
            .stroke({ color: 0xff2222, width: 1.5 });
        harpoonGfx
            .moveTo(tipX + 3, 3)
            .lineTo(tipX + 1, 6)
            .stroke({ color: 0xff2222, width: 1.5 });
    }

    function drawBody(): void {
        bodyGfx.clear();
        const ts = watchTileSize.value;
        const r = ts * 0.4;
        const isHarpoon = bindings.isHarpoonExtended();

        // --- Side-view character drawn facing RIGHT ---
        // Everything is drawn relative to center (0,0)

        // Head — slightly oblong, not a perfect circle
        bodyGfx.ellipse(0, -r * 0.35, r * 0.5, r * 0.55).fill(0xfce4b8);

        // Helmet — white cap on top of head
        bodyGfx
            .moveTo(-r * 0.5, -r * 0.45)
            .arcTo(-r * 0.5, -r * 0.95, 0, -r * 0.95, r * 0.4)
            .arcTo(r * 0.5, -r * 0.95, r * 0.5, -r * 0.45, r * 0.4)
            .lineTo(r * 0.5, -r * 0.45)
            .closePath()
            .fill(0xffffff);

        // Eye (simple dot)
        bodyGfx.circle(r * 0.15, -r * 0.4, r * 0.1).fill(0x000000);

        // Visor — blue strip across face
        bodyGfx.rect(-r * 0.05, -r * 0.55, r * 0.55, r * 0.15).fill(0x4488ff);

        // Body / suit — white torso
        bodyGfx.roundRect(-r * 0.4, r * 0.1, r * 0.8, r * 0.65, r * 0.1).fill(0xffffff);

        // Belt
        bodyGfx.rect(-r * 0.4, r * 0.55, r * 0.8, r * 0.12).fill(0x3366cc);

        // Arms
        if (isHarpoon) {
            // Pump pose — both arms extended forward
            bodyGfx.rect(r * 0.2, r * 0.1, r * 0.5, r * 0.18).fill(0xffffff);
            bodyGfx.rect(r * 0.2, r * 0.3, r * 0.5, r * 0.18).fill(0xffffff);
            // Hands
            bodyGfx.circle(r * 0.7, r * 0.19, r * 0.08).fill(0xfce4b8);
            bodyGfx.circle(r * 0.7, r * 0.39, r * 0.08).fill(0xfce4b8);
        } else if (prevPose === 'walk-b') {
            // Arms swinging — one forward, one back
            bodyGfx.rect(r * 0.15, r * 0.12, r * 0.4, r * 0.15).fill(0xffffff);
            bodyGfx.rect(-r * 0.55, r * 0.32, r * 0.4, r * 0.15).fill(0xffffff);
        } else if (prevPose === 'walk-a') {
            bodyGfx.rect(-r * 0.55, r * 0.12, r * 0.4, r * 0.15).fill(0xffffff);
            bodyGfx.rect(r * 0.15, r * 0.32, r * 0.4, r * 0.15).fill(0xffffff);
        } else {
            // Idle — arms at sides
            bodyGfx.rect(-r * 0.6, r * 0.12, r * 0.22, r * 0.35).fill(0xffffff);
            bodyGfx.rect(r * 0.38, r * 0.12, r * 0.22, r * 0.35).fill(0xffffff);
        }

        // Legs
        const legY = r * 0.68;
        const legH = r * 0.45;
        if (prevPose === 'walk-b') {
            // Legs spread
            bodyGfx.rect(-r * 0.35, legY, r * 0.25, legH).fill(0xffffff);
            bodyGfx.rect(r * 0.1, legY, r * 0.25, legH).fill(0xffffff);
            // Feet — blue boots, spread
            bodyGfx.roundRect(-r * 0.4, legY + legH - r * 0.08, r * 0.38, r * 0.18, r * 0.05).fill(0x3366cc);
            bodyGfx.roundRect(r * 0.05, legY + legH - r * 0.08, r * 0.38, r * 0.18, r * 0.05).fill(0x3366cc);
        } else if (prevPose === 'walk-a') {
            // Legs together-ish
            bodyGfx.rect(-r * 0.25, legY, r * 0.22, legH).fill(0xffffff);
            bodyGfx.rect(r * 0.03, legY, r * 0.22, legH).fill(0xffffff);
            // Feet
            bodyGfx.roundRect(-r * 0.3, legY + legH - r * 0.08, r * 0.35, r * 0.18, r * 0.05).fill(0x3366cc);
            bodyGfx.roundRect(-r * 0.02, legY + legH - r * 0.08, r * 0.35, r * 0.18, r * 0.05).fill(0x3366cc);
        } else {
            // Idle — standing straight
            bodyGfx.rect(-r * 0.3, legY, r * 0.25, legH).fill(0xffffff);
            bodyGfx.rect(r * 0.05, legY, r * 0.25, legH).fill(0xffffff);
            // Feet
            bodyGfx.roundRect(-r * 0.35, legY + legH - r * 0.08, r * 0.35, r * 0.18, r * 0.05).fill(0x3366cc);
            bodyGfx.roundRect(0, legY + legH - r * 0.08, r * 0.35, r * 0.18, r * 0.05).fill(0x3366cc);
        }
    }
}

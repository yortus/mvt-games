/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';
import { isTouchDevice, OverlayView } from '#shared';
import { List } from '@mvtjs/pixi/jsx';
import type { GameModel } from '../models';
import { ARENA_WIDTH, ARENA_HEIGHT } from '../data';
import { ShipView } from './ship-view';
import { EnemyView } from './enemy-view';
import { BulletView } from './bullet-view';
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

/**
 * The whole game: a star backdrop, the enemies, both players' bullets and the
 * ship, then the HUD below and the overlay above. Each collection is a
 * `<List>`, whose item views are reused as the collection changes.
 */
export function GameView(bindings: GameViewBindings): Container {
    const { model } = bindings;
    const restartHint = isTouchDevice() ? 'Tap to restart' : 'Press Enter to restart';
    const gameOverText = `GAME OVER\n\n${restartHint}`;

    return (
        <container>
            <graphics ref={(g) => drawStars(g, ARENA_WIDTH, ARENA_HEIGHT)} />
            <List items={() => model.enemies}>
                {(enemy) => (
                    <EnemyView
                        x={() => enemy().x}
                        y={() => enemy().y}
                        kind={() => enemy().kind}
                        phase={() => enemy().phase}
                        isAlive={() => enemy().isAlive}
                    />
                )}
            </List>
            <List items={() => model.playerBullets}>
                {(bullet) => (
                    <BulletView
                        x={() => bullet().x}
                        y={() => bullet().y}
                        isActive={() => bullet().isActive}
                        color={() => PLAYER_BULLET_COLOR}
                    />
                )}
            </List>
            <List items={() => model.enemyBullets}>
                {(bullet) => (
                    <BulletView
                        x={() => bullet().x}
                        y={() => bullet().y}
                        isActive={() => bullet().isActive}
                        color={() => ENEMY_BULLET_COLOR}
                    />
                )}
            </List>
            <ShipView x={() => model.ship.x} y={() => model.ship.y} isAlive={() => model.ship.isAlive} />
            <container y={ARENA_HEIGHT}>
                <HudView
                    score={() => model.score}
                    lives={() => model.lives}
                    stage={() => model.stage}
                    screenWidth={() => ARENA_WIDTH}
                />
            </container>
            <OverlayView
                width={ARENA_WIDTH}
                height={ARENA_HEIGHT}
                isVisible={() => model.phase === 'game-over' || model.phase === 'stage-clear'}
                text={() => (model.phase === 'game-over' ? gameOverText : 'STAGE CLEAR!')}
                onRestartPressed={(pressed) => { model.playerInput.restartPressed = pressed; }}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const PLAYER_BULLET_COLOR = 0xffffff;
const ENEMY_BULLET_COLOR = 0xff4444;

function drawStars(gfx: Graphics, width: number, height: number): void {
    // Deterministic pseudo-random via simple LCG seeded at 42
    let seed = 42;
    function rand(): number {
        seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
        return seed / 0x7fffffff;
    }

    for (let i = 0; i < 50; i++) {
        const x = rand() * width;
        const y = rand() * height;
        const brightness = 0.3 + rand() * 0.7;
        const gray = (brightness * 255) | 0;
        const color = (gray << 16) | (gray << 8) | gray;
        gfx.circle(x, y, 0.5 + rand() * 0.8).fill(color);
    }
}

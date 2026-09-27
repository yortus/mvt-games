/** @jsxImportSource #pixi-jsx */

import type { Container, Graphics } from 'pixi.js';
import { isTouchDevice, OverlayView } from '#common';
import { List } from '#pixi-jsx';
import type { GameModel } from '../models';
import { ARENA_WIDTH, ARENA_HEIGHT } from '../data';
import { ShipView } from './ship-view';
import { AsteroidView } from './asteroid-view';
import { BulletView } from './bullet-view';
import { DebrisView } from './debris-view';
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
 * The whole game: a star backdrop, the asteroids, the bullets, the ship and
 * its debris, then the HUD below and the overlay above. The asteroids are a
 * `<List>` over their `SlotList`, whose empty slots hide themselves; the
 * bullets are a `<List>` over their array.
 */
export function GameView(bindings: GameViewBindings): Container {
    const { model } = bindings;
    const restartHint = isTouchDevice() ? 'Tap to restart' : 'Press Enter to restart';
    const gameOverText = `GAME OVER\n\n${restartHint}`;

    return (
        <container>
            <graphics ref={(g) => drawStars(g, ARENA_WIDTH, ARENA_HEIGHT)} />
            <List items={model.asteroids.slots}>
                {(slot) => (
                    <AsteroidView
                        x={() => slot().value.x}
                        y={() => slot().value.y}
                        angle={() => slot().value.angle}
                        size={() => slot().value.size}
                        radius={() => slot().value.radius}
                        isAlive={() => slot().value.isAlive}
                        shapeSeed={() => slot().value.shapeSeed}
                    />
                )}
            </List>
            <List items={() => model.bullets}>
                {(bullet) => (
                    <BulletView x={() => bullet().x} y={() => bullet().y} isActive={() => bullet().isActive} />
                )}
            </List>
            <ShipView
                x={() => model.ship.x}
                y={() => model.ship.y}
                angle={() => model.ship.angle}
                isAlive={() => model.ship.isAlive}
                isThrusting={() => model.ship.isThrusting}
            />
            {/* Debris, drawn above the ship */}
            <DebrisView particles={() => model.debris.particles} isActive={() => model.debris.isActive} />
            <container y={ARENA_HEIGHT}>
                <HudView
                    score={() => model.score}
                    lives={() => model.lives}
                    wave={() => model.wave}
                    screenWidth={() => ARENA_WIDTH}
                />
            </container>
            <OverlayView
                width={ARENA_WIDTH}
                height={ARENA_HEIGHT}
                isVisible={() => model.phase === 'game-over' || model.phase === 'wave-clear'}
                text={() => (model.phase === 'game-over' ? gameOverText : 'WAVE CLEAR!')}
                onRestartPressed={(pressed) => { model.playerInput.restartPressed = pressed; }}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function drawStars(gfx: Graphics, width: number, height: number): void {
    // Deterministic pseudo-random via simple LCG seeded at 99
    let seed = 99;
    function rand(): number {
        seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
        return seed / 0x7fffffff;
    }

    for (let i = 0; i < 60; i++) {
        const x = rand() * width;
        const y = rand() * height;
        const brightness = 0.3 + rand() * 0.7;
        const gray = (brightness * 255) | 0;
        const color = (gray << 16) | (gray << 8) | gray;
        gfx.circle(x, y, 0.5 + rand() * 0.8).fill(color);
    }
}

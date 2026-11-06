/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';
import { createMetronome } from '@mvtjs/utils';
import { isTouchDevice, OverlayView, type SfxChip } from '@mvtjs/site-kit/shared';
import { List } from '@mvtjs/pixi';
import type { GameModel } from '../models';
import { ARENA_WIDTH, ARENA_HEIGHT } from '../data';
import { AudioView } from './audio-view';
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
    /** The chip the game's sound effects play on, read once as `music` is. */
    sfx: SfxChip<'audio80'>;
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
    const { model, sfx } = bindings;
    const isTouch = isTouchDevice();
    const restartHint = isTouch ? 'Tap to restart' : 'Press Enter to restart';
    // On a touch screen, the ship fires on its own, so the thumbs are free to fly it
    const fireBeat = createMetronome();
    fireBeat.periodMs = isTouch ? AUTO_FIRE_MS : 0;
    let shotsAsked = 0;
    const gameOverText = `GAME OVER\n\n${restartHint}`;

    return (
        <container onUpdate={fireOnEachBeat}>
            <AudioView
                sfx={sfx}
                phase={() => model.phase}
                shotsFired={() => model.shotsFired}
                rocksBroken={() => model.rocksBroken}
                lastBrokenRockSize={() => model.lastBrokenRockSize}
                breaksLeft={() => model.breaksLeft}
                isThrusting={() => model.ship.isThrusting}
            />
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
                font="pixel"
                width={ARENA_WIDTH}
                height={ARENA_HEIGHT}
                isVisible={() => model.phase === 'game-over' || model.phase === 'wave-clear'}
                text={() => (model.phase === 'game-over' ? gameOverText : 'WAVE CLEAR!')}
                onPressed={model.startNewRun}
            />
        </container>
    );

    /** Asks for a shot on each beat. A shot asked for while the game isn't playing is dropped. */
    function fireOnEachBeat(deltaMs: number): void {
        fireBeat.update(deltaMs);
        if (fireBeat.count === shotsAsked) return;
        shotsAsked = fireBeat.count;
        model.fire();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How often the ship fires on its own on a touch screen, in ms. */
const AUTO_FIRE_MS = 200;

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

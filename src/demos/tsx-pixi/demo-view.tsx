/** @jsxImportSource #pixi-jsx */

import { Container, Graphics } from 'pixi.js';
import type { CoinModel, StarModel } from './demo-model';
import { List } from './list';
import { memo } from './memo';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DemoViewBindings {
    getScore(): number;
    getPlayerX(): number;
    getPlayerY(): number;
    getPlayerAngle(): number;
    getCoins(): readonly CoinModel[];
    getStars(): readonly StarModel[];
    getMessage(): string;
    onCoinTap?(index: number): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDemoView(bindings: DemoViewBindings): Container {
    const { getMessage, getPlayerX, getPlayerY, getPlayerAngle, getCoins, getStars } = bindings;

    const getScoreText = memo(bindings, b => `Score: ${b.getScore()}`);

    // ref captures the player container for imperative access (debug bounds)
    let playerRef: Container | undefined;

    return (
        <container label="demo-root">
            {/* ---- Title ---- */}
            <text
                text={getScoreText}
                x={12}
                y={8}
                style={{ fill: 0xffffff, fontSize: 20, fontFamily: 'monospace' }}
            />

            {/* ---- Coins (static list, tap-to-collect) ---- */}
            {getCoins().map((coin, i) => (
                <container
                    x={coin.x}
                    y={coin.y}
                    visible={() => !coin.isCollected}
                    onPointerTap={() => bindings.onCoinTap?.(i)}
                >
                    <graphics ref={drawCoin} />
                </container>
            ))}

            {/* ---- Stars (dynamic list) ---- */}
            <List
                of={getStars}
                to={star => (
                    <container x={() => star.x} y={() => star.y} alpha={() => star.alpha}>
                        <graphics ref={drawStar} />
                    </container>
                )}
            />

            {/* ---- Player ---- */}
            <container
                ref={(el) => { playerRef = el; }}
                x={getPlayerX}
                y={getPlayerY}
                rotation={getPlayerAngle}
            >
                <graphics ref={drawPlayer} />
            </container>

            {/* ---- Debug bounding box around player (uses ref) ---- */}
            <graphics
                ref={(g) => {
                    g.onRender = () => {
                        g.clear();
                        if (!playerRef) return;
                        const b = playerRef.getBounds();
                        g.rect(b.x, b.y, b.width, b.height).stroke({ color: 0xff0000, width: 1 });
                    };
                }}
            />

            {/* ---- Win message ---- */}
            <text
                text={getMessage}
                x={200}
                y={140}
                style={{ fill: 0x44ff88, fontSize: 28, fontFamily: 'monospace', fontWeight: 'bold' }}
                alpha={() => getMessage() ? 1 : 0}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function drawPlayer(g: Graphics): void {
    g.circle(0, 0, 12).fill(0x44aaff);
    g.moveTo(0, -14).lineTo(6, 6).lineTo(-6, 6).closePath().fill(0x88ccff);
}

function drawCoin(g: Graphics): void {
    g.circle(0, 0, 8).fill(0xffcc00);
    g.circle(0, 0, 5).fill(0xffee66);
}

function drawStar(g: Graphics): void {
    const points: number[] = [];
    for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? 8 : 4;
        points.push(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    g.poly(points).fill(0xff66ff);
}

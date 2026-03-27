// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface DemoModel {
    readonly score: number;
    readonly playerX: number;
    readonly playerY: number;
    readonly playerAngle: number;
    readonly coins: readonly CoinModel[];
    readonly stars: readonly StarModel[];
    readonly message: string;
    collectCoin(index: number): void;
    update(deltaMs: number): void;
}

export interface CoinModel {
    readonly x: number;
    readonly y: number;
    readonly isCollected: boolean;
}

export interface StarModel {
    readonly id: number;
    readonly x: number;
    readonly y: number;
    readonly alpha: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

interface DemoModelOptions {
    readonly arenaWidth: number;
    readonly arenaHeight: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDemoModel(options: DemoModelOptions): DemoModel {
    const { arenaWidth, arenaHeight } = options;
    const margin = 16;

    let score = 0;
    let playerX = arenaWidth / 2;
    let playerY = arenaHeight / 2;
    let playerAngle = 0;
    let vx = 120;
    let vy = 90;
    let message = '';
    let starTimer = 0;

    const coins: MutableCoin[] = [];
    for (let i = 0; i < 6; i++) {
        coins.push({
            x: margin + 30 + Math.floor((arenaWidth - margin * 2 - 60) * ((i + 0.5) / 6)),
            y: margin + 40 + Math.floor((arenaHeight - margin * 2 - 80) * ((i % 3) / 2.5)),
            isCollected: false,
        });
    }

    const stars: MutableStar[] = [];
    let nextStarId = 0;

    const model: DemoModel = {
        get score() { return score; },
        get playerX() { return playerX; },
        get playerY() { return playerY; },
        get playerAngle() { return playerAngle; },
        get coins() { return coins; },
        get stars() { return stars; },
        get message() { return message; },
        collectCoin(index: number) {
            const coin = coins[index];
            if (coin && !coin.isCollected) {
                coin.isCollected = true;
                score++;
            }
        },
        update,
    };

    return model;

    function update(deltaMs: number): void {
        const dt = deltaMs / 1000;

        // Move player
        playerX += vx * dt;
        playerY += vy * dt;
        playerAngle += 3 * dt;

        // Bounce off walls
        if (playerX < margin + 12 || playerX > arenaWidth - margin - 12) vx = -vx;
        if (playerY < margin + 12 || playerY > arenaHeight - margin - 12) vy = -vy;
        playerX = Math.max(margin + 12, Math.min(arenaWidth - margin - 12, playerX));
        playerY = Math.max(margin + 12, Math.min(arenaHeight - margin - 12, playerY));

        // Collect coins
        for (let i = 0; i < coins.length; i++) {
            const coin = coins[i];
            if (!coin.isCollected && distSq(playerX, playerY, coin.x, coin.y) < 22 * 22) {
                coin.isCollected = true;
                score++;
            }
        }

        // Spawn stars periodically
        starTimer += deltaMs;
        if (starTimer > 1500 && stars.length < 10) {
            starTimer = 0;
            stars.push({
                id: nextStarId++,
                x: margin + 20 + Math.floor(Math.random() * (arenaWidth - margin * 2 - 40)),
                y: margin + 20 + Math.floor(Math.random() * (arenaHeight - margin * 2 - 40)),
                lifetime: 4000,
                alpha: 1,
            });
        }

        // Age stars and collect
        for (let i = stars.length - 1; i >= 0; i--) {
            const star = stars[i];
            star.lifetime -= deltaMs;
            star.alpha = Math.max(0, star.lifetime / 4000);
            if (star.lifetime <= 0) {
                stars.splice(i, 1);
                continue;
            }
            if (distSq(playerX, playerY, star.x, star.y) < 20 * 20) {
                stars.splice(i, 1);
                score += 3;
            }
        }

        // Message
        const allCoins = coins.every((c) => c.isCollected);
        message = allCoins ? 'ALL COINS COLLECTED!' : '';
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface MutableCoin {
    readonly x: number;
    readonly y: number;
    isCollected: boolean;
}

interface MutableStar {
    readonly id: number;
    readonly x: number;
    readonly y: number;
    lifetime: number;
    alpha: number;
}

function distSq(ax: number, ay: number, bx: number, by: number): number {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
}

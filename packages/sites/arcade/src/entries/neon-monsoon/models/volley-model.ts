import type { SlotList } from '@mvtjs/utils';
import type { BulletKind } from '../data';
import type { BossModel } from './boss-model';
import type { BulletField } from './bullet-field';
import type { EnemyModel } from './enemy-model';
import {
    VOLLEY_BOSS_DAMAGE,
    VOLLEY_BURST_RADIUS,
    VOLLEY_CHARGE_MS,
    VOLLEY_DAMAGE,
    VOLLEY_FLIGHT_MS,
    VOLLEY_LOCK_MS,
    VOLLEY_RING_FORM_MS,
    VOLLEY_RING_RADIUS,
    VOLLEY_RING_SPIN,
    VOLLEY_SHOT_RADIUS,
    VOLLEY_SHOTS,
} from './model-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * - `'charging'`: the bar is filling, while the ship flies close to bullets.
 * - `'ready'`: the bar is full. Focusing starts a lock, if there is anything
 *   to lock onto.
 * - `'locking'`: the ship is focused, and the lock is closing on the
 *   toughest target on screen.
 * - `'locked'`: the lock is complete. Releasing it now fires the volley.
 * - `'flying'`: the volley is on its way. It bursts on the target when its
 *   flight ends.
 */
export type VolleyPhase = 'charging' | 'ready' | 'locking' | 'locked' | 'flying';

/**
 * The ship's volley. Its bar fills for as long as the ship flies within
 * grazing distance of any bullet. Once the bar is full, it is a set of shots.
 *
 * While the bar is full and the ship is focused, the shots circle the ship
 * in a ring, which shields it. A shot that touches a bullet destroys it, and
 * is lost. The ring also locks onto the toughest target on screen: the boss
 * while it can be hurt, or else the enemy with the most health left.
 * Releasing the lock fires the shots that are left, and they burst on the
 * target. The burst does a share of its damage for each shot.
 *
 * The model keeps the ring's shots, since they collide with bullets, and
 * where the target is. The shots in flight have no positions of their own
 * here, since only the burst does damage. A view draws their flight from
 * where the ring was at the release, the target and the flight's progress.
 */
export interface VolleyModel {
    readonly phase: VolleyPhase;
    /**
     * How full the bar is, from 0 to 1. While charging, it is how far the bar
     * has filled. Once charged, it is the share of the shots left. While
     * flying, it is 0.
     */
    readonly charge: number;
    /** Whether the bar filled in the last step, because the ship was near a bullet. */
    readonly isFilling: boolean;

    /** How many shots a full volley has. Shot `i` is numbered from 0 to `shotCount - 1`. */
    readonly shotCount: number;
    /** How many shots are left, in the ring or in flight. */
    readonly shotsLeft: number;
    /** Whether shot `i` is left. A shot lost to a bullet is gone until the bar fills again. */
    hasShotAt: (i: number) => boolean;
    /** Whether the shots are circling the ship: the bar is full and the ship is focused. */
    readonly isRingUp: boolean;
    /** How far from the ship the ring is, in world-units. It spreads out from 0 as the ring forms. */
    readonly ringRadius: number;
    /** How far the ring has turned, in radians. Shot `i` is at `ringAngle + i * 2 * PI / shotCount`. */
    readonly ringAngle: number;
    /** Bullets the ring has stopped this game. Each rise is a shot lost. */
    readonly shieldHits: number;
    /** Where the ring last stopped a bullet, in world-units. */
    readonly shieldHitX: number;
    readonly shieldHitY: number;
    /** Milliseconds since the ring last stopped a bullet, or Infinity if it has not. */
    readonly msSinceShieldHit: number;

    /** How far the lock has closed, from 0 to 1. It is 1 once locked, and 0 when there is no lock. */
    readonly lockProgress: number;
    /**
     * Where the target is, in world-units, while locking, locked or flying.
     * The volley follows its target while the target lives. If the target
     * dies or leaves while the volley flies, this stays where it was last,
     * and the volley bursts there.
     */
    readonly targetX: number;
    readonly targetY: number;
    /** The target's hit radius, in world-units. */
    readonly targetRadius: number;

    /** Where the ship was when it released the volley, in world-units. Meaningful while flying. */
    readonly launchX: number;
    readonly launchY: number;
    /** The ring's angle and radius when the ship released the volley, which the shots fly out from. */
    readonly launchAngle: number;
    readonly launchRadius: number;
    /** How far the volley has flown, from 0 at release to 1 at the burst. */
    readonly flightProgress: number;
    /** Volleys fired this game. Each rise is a release. */
    readonly volleysFired: number;
    /** Volleys that have burst this game. Each rise is a burst. */
    readonly burstCount: number;
    /** Where the last burst was, in world-units. */
    readonly burstX: number;
    readonly burstY: number;
    /** Milliseconds since the last burst, or Infinity if there has not been one. */
    readonly msSinceBurst: number;

    /**
     * Fill the bar by `ms` of grazing: time spent with a bullet within
     * grazing distance. It fills only while it is charging.
     */
    addGrazeTime: (ms: number) => void;
    /** Fire the volley, if it is locked on. If not, nothing happens. */
    release: () => void;
    /** Empty the bar and drop any lock or volley in flight, as when the ship is lost. */
    empty: () => void;
    /** Empty the bar, and start the counts again, for a new game. */
    reset: () => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface VolleyModelOptions {
    readonly airEnemies: SlotList<EnemyModel>;
    readonly groundEnemies: SlotList<EnemyModel>;
    readonly boss: BossModel;
    /** The enemies' bullets, which the ring stops. */
    readonly bullets: BulletField<BulletKind>;
    /** The ship: what the ring circles, where the volley flies from, and whether it is focused, which raises the ring and locks on. */
    readonly ship: { readonly x: number; readonly y: number; readonly isFocused: boolean };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a volley with its bar empty. */
export function createVolleyModel(options: VolleyModelOptions): VolleyModel {
    const { airEnemies, groundEnemies, boss, bullets, ship } = options;

    let phase: VolleyPhase = 'charging';
    let chargeMs = 0;
    let isFilling = false;

    // The shots: which are left, and the ring's place
    const hasShot = new Uint8Array(VOLLEY_SHOTS).fill(1);
    const shotXs = new Float64Array(VOLLEY_SHOTS);
    const shotYs = new Float64Array(VOLLEY_SHOTS);
    let shotsLeft = VOLLEY_SHOTS;
    let isRingUp = false;
    let ringMs = 0;
    let ringRadius = 0;
    let ringAngle = 0;
    let shieldHits = 0;
    let shieldHitX = 0;
    let shieldHitY = 0;
    let msSinceShieldHit = Infinity;

    let target: EnemyModel | BossModel | undefined;
    let targetX = 0;
    let targetY = 0;
    let targetRadius = 0;
    let lockMs = 0;

    let launchX = 0;
    let launchY = 0;
    let launchAngle = 0;
    let launchRadius = 0;
    let flightMs = 0;
    let volleysFired = 0;
    let burstCount = 0;
    let burstX = 0;
    let burstY = 0;
    let msSinceBurst = Infinity;

    const model: VolleyModel = {
        get phase() {
            return phase;
        },
        get charge() {
            if (phase === 'charging') return chargeMs / VOLLEY_CHARGE_MS;
            return phase === 'flying' ? 0 : shotsLeft / VOLLEY_SHOTS;
        },
        get isFilling() {
            return isFilling;
        },
        shotCount: VOLLEY_SHOTS,
        get shotsLeft() {
            return shotsLeft;
        },
        hasShotAt: (i) => hasShot[i] === 1,
        get isRingUp() {
            return isRingUp;
        },
        get ringRadius() {
            return ringRadius;
        },
        get ringAngle() {
            return ringAngle;
        },
        get shieldHits() {
            return shieldHits;
        },
        get shieldHitX() {
            return shieldHitX;
        },
        get shieldHitY() {
            return shieldHitY;
        },
        get msSinceShieldHit() {
            return msSinceShieldHit;
        },
        get lockProgress() {
            return phase === 'locking' ? lockMs / VOLLEY_LOCK_MS : phase === 'locked' || phase === 'flying' ? 1 : 0;
        },
        get targetX() {
            return targetX;
        },
        get targetY() {
            return targetY;
        },
        get targetRadius() {
            return targetRadius;
        },
        get launchX() {
            return launchX;
        },
        get launchY() {
            return launchY;
        },
        get launchAngle() {
            return launchAngle;
        },
        get launchRadius() {
            return launchRadius;
        },
        get flightProgress() {
            return phase === 'flying' ? flightMs / VOLLEY_FLIGHT_MS : 0;
        },
        get volleysFired() {
            return volleysFired;
        },
        get burstCount() {
            return burstCount;
        },
        get burstX() {
            return burstX;
        },
        get burstY() {
            return burstY;
        },
        get msSinceBurst() {
            return msSinceBurst;
        },

        addGrazeTime(ms) {
            if (phase !== 'charging') return;
            isFilling = true;
            chargeMs = Math.min(VOLLEY_CHARGE_MS, chargeMs + ms);
            if (chargeMs >= VOLLEY_CHARGE_MS - TIME_TOLERANCE_MS) {
                chargeMs = VOLLEY_CHARGE_MS;
                phase = 'ready';
            }
        },

        release() {
            if (phase !== 'locked') return;
            phase = 'flying';
            flightMs = 0;
            launchX = ship.x;
            launchY = ship.y;
            launchAngle = ringAngle;
            launchRadius = ringRadius;
            lowerRing();
            volleysFired++;
        },

        empty() {
            phase = 'charging';
            chargeMs = 0;
            target = undefined;
            lockMs = 0;
            hasShot.fill(1);
            shotsLeft = VOLLEY_SHOTS;
            lowerRing();
        },

        reset() {
            model.empty();
            volleysFired = 0;
            burstCount = 0;
            shieldHits = 0;
            msSinceBurst = Infinity;
            msSinceShieldHit = Infinity;
        },

        update(deltaMs) {
            msSinceBurst += deltaMs;
            msSinceShieldHit += deltaMs;
            // The bar fills again in this step, if the ship is near a bullet
            isFilling = false;

            if (phase === 'ready') {
                if (ship.isFocused) startLock();
            }
            else if (phase === 'locking' || phase === 'locked') {
                if (!ship.isFocused) dropLock();
                else if (!isTargetValid()) startLock();
            }

            const isCharged = phase === 'ready' || phase === 'locking' || phase === 'locked';
            if (isCharged && ship.isFocused) advanceRing(deltaMs);
            else lowerRing();

            if (phase === 'locking' || phase === 'locked') advanceLock(deltaMs);
            else if (phase === 'flying') fly(deltaMs);
        },
    };

    return model;

    // ---- The ring ----------------------------------------------------------

    /** Turn the ring, spread it out as it forms, and stop the bullets its shots touch. */
    function advanceRing(deltaMs: number): void {
        isRingUp = true;
        ringMs += deltaMs;
        ringRadius = VOLLEY_RING_RADIUS * Math.min(1, ringMs / VOLLEY_RING_FORM_MS);
        ringAngle = (ringAngle + VOLLEY_RING_SPIN * deltaMs * 0.001) % TAU;
        for (let i = 0; i < VOLLEY_SHOTS; i++) {
            const angle = ringAngle + (i * TAU) / VOLLEY_SHOTS;
            shotXs[i] = ship.x + Math.cos(angle) * ringRadius;
            shotYs[i] = ship.y + Math.sin(angle) * ringRadius;
        }
        shieldShip();
    }

    /** The shots stop circling. They keep their places in the ring for when it forms again. */
    function lowerRing(): void {
        isRingUp = false;
        ringMs = 0;
        ringRadius = 0;
    }

    /**
     * Destroy each bullet a shot touches, with the shot. One pass over the
     * bullets: only those as far from the ship as the ring, give or take
     * their reach, are checked against the shots.
     */
    function shieldShip(): void {
        // Backwards, so the bullet a removal moves into `b` has already been checked
        for (let b = bullets.count - 1; b >= 0; b--) {
            const x = bullets.xOf(b);
            const y = bullets.yOf(b);
            const reach = VOLLEY_SHOT_RADIUS + bullets.radiusOf(b);
            const distance = measureDistanceSquared(x, y, ship.x, ship.y);
            const outer = ringRadius + reach;
            if (distance >= outer * outer) continue;
            const inner = ringRadius - reach;
            if (inner > 0 && distance <= inner * inner) continue;

            const shot = findShotTouching(x, y, reach);
            if (shot < 0) continue;
            hasShot[shot] = 0;
            shotsLeft--;
            shieldHits++;
            shieldHitX = x;
            shieldHitY = y;
            msSinceShieldHit = 0;
            bullets.remove(b);
            if (shotsLeft === 0) {
                // The last shot is spent, so the bar starts filling again
                model.empty();
                return;
            }
        }
    }

    function findShotTouching(x: number, y: number, reach: number): number {
        for (let i = 0; i < VOLLEY_SHOTS; i++) {
            if (hasShot[i] === 1 && measureDistanceSquared(x, y, shotXs[i], shotYs[i]) < reach * reach) return i;
        }
        return -1;
    }

    // ---- Locking -----------------------------------------------------------

    function advanceLock(deltaMs: number): void {
        followTarget();
        lockMs = Math.min(VOLLEY_LOCK_MS, lockMs + deltaMs);
        if (lockMs >= VOLLEY_LOCK_MS - TIME_TOLERANCE_MS) {
            lockMs = VOLLEY_LOCK_MS;
            phase = 'locked';
        }
    }

    /** Lock onto the toughest target from the start, or wait, ready, if there is none. */
    function startLock(): void {
        target = findToughestTarget();
        lockMs = 0;
        if (target === undefined) {
            phase = 'ready';
            return;
        }
        phase = 'locking';
        followTarget();
    }

    function dropLock(): void {
        target = undefined;
        lockMs = 0;
        phase = 'ready';
    }

    /**
     * Returns the boss, if it can be hurt. Otherwise it returns the enemy on
     * screen with the most health left, the nearest to the ship of any that
     * tie, or undefined if there is none.
     */
    function findToughestTarget(): EnemyModel | BossModel | undefined {
        if (boss.isVulnerable) return boss;
        let best: EnemyModel | undefined;
        let bestDistance = Infinity;
        for (let list = 0; list < 2; list++) {
            const slots = list === 0 ? airEnemies.slots : groundEnemies.slots;
            for (let i = 0; i < slots.length; i++) {
                const slot = slots.at(i);
                if (!slot?.isLive) continue;
                const enemy = slot.value;
                if (!enemy.isAlive || !enemy.isOnScreen) continue;
                const distance = measureDistanceSquared(enemy.x, enemy.y, ship.x, ship.y);
                if (best === undefined || enemy.health > best.health || (enemy.health === best.health && distance < bestDistance)) {
                    best = enemy;
                    bestDistance = distance;
                }
            }
        }
        return best;
    }

    /** Whether the target is still worth hitting: the boss while it can be hurt, or an enemy alive on screen. */
    function isTargetValid(): boolean {
        if (target === undefined) return false;
        // Only an enemy has `isAlive`. The boss's attacks have their own health
        if ('isAlive' in target) return target.isAlive && target.isOnScreen;
        return boss.isVulnerable;
    }

    function followTarget(): void {
        if (target === undefined) return;
        targetX = target.x;
        targetY = target.y;
        targetRadius = target.radius;
    }

    // ---- The flight and the burst ------------------------------------------

    function fly(deltaMs: number): void {
        if (isTargetValid()) followTarget();
        flightMs += deltaMs;
        if (flightMs >= VOLLEY_FLIGHT_MS - TIME_TOLERANCE_MS) burst();
    }

    /** Damage everything the burst reaches, a share for each shot left, and start filling the bar again. */
    function burst(): void {
        burstX = targetX;
        burstY = targetY;
        const share = shotsLeft / VOLLEY_SHOTS;
        for (let list = 0; list < 2; list++) {
            const slots = list === 0 ? airEnemies.slots : groundEnemies.slots;
            for (let i = 0; i < slots.length; i++) {
                const slot = slots.at(i);
                if (!slot?.isLive) continue;
                const enemy = slot.value;
                if (enemy.isOnScreen && isInReach(enemy.x, enemy.y, enemy.radius)) enemy.takeDamage(VOLLEY_DAMAGE * share);
            }
        }
        if (boss.isVulnerable && isInReach(boss.x, boss.y, boss.radius)) boss.takeDamage(VOLLEY_BOSS_DAMAGE * share);
        burstCount++;
        msSinceBurst = 0;
        model.empty();
    }

    /** Whether something at (x, y) with this radius is inside the burst. */
    function isInReach(x: number, y: number, radius: number): boolean {
        const reach = VOLLEY_BURST_RADIUS + radius;
        return measureDistanceSquared(x, y, burstX, burstY) < reach * reach;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;

/**
 * Leeway when comparing time with a length: steps of 1000 / 60 ms are not
 * exact in floating point, so a second of them may fall a hair short of 1000.
 */
const TIME_TOLERANCE_MS = 0.01;

function measureDistanceSquared(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
}

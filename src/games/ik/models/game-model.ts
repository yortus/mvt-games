import gsap from 'gsap';
import { watch } from '#common';
import {
    type DefeatVariant,
    type FighterMove,
    type GamePhase,
    type MoveKind,
    MOVE_DATA,
    FIGHTER_START_LEFT_X,
    FIGHTER_START_RIGHT_X,
    ARENA_MIN_X,
    ARENA_MAX_X,
    ROUND_TIMER_MS,
    ROUND_INTRO_DELAY_MS,
    POINT_SCORED_DELAY_MS,
    ROUND_OVER_DELAY_MS,
    resolveInputDirection,
    resolveMove,
} from '../data';
import { createAiModel, type AiModel } from './ai-model';
import { createFighterModel, type FighterModel } from './fighter-model';
import { createPlayerInput, type PlayerInput } from './player-input';
import { createMatchModel, type MatchModel } from './match-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface GameModel {
    readonly phase: GamePhase;
    readonly player: FighterModel;
    readonly opponent: FighterModel;
    readonly match: MatchModel;
    readonly playerInput: PlayerInput;
    readonly roundTimeRemainingMs: number;
    reset(): void;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameModel(): GameModel {
    const player = createFighterModel({
        startX: FIGHTER_START_LEFT_X,
        startFacing: 'right',
        arenaMinX: ARENA_MIN_X,
        arenaMaxX: ARENA_MAX_X,
    });

    const opponent = createFighterModel({
        startX: FIGHTER_START_RIGHT_X,
        startFacing: 'left',
        arenaMinX: ARENA_MIN_X,
        arenaMaxX: ARENA_MAX_X,
    });

    const matchModel = createMatchModel();
    const playerInput = createPlayerInput();
    const ai: AiModel = createAiModel();

    let gamePhase: GamePhase = 'round-intro';
    let roundTimeRemainingMs = ROUND_TIMER_MS;

    // Input settle state (same pattern as playtest-model)
    let settledMove: FighterMove = 'idle';
    let pendingMove: FighterMove = 'idle';
    let settleAccumMs = 0;
    let lastAcceptedMove: FighterMove = 'idle';
    let lastPlayerFacing = player.facing;

    const INPUT_SETTLE_MS = 50;

    const phaseTimeline = gsap.timeline({ paused: true });
    const watcher = watch({ restart: () => playerInput.restartPressed });

    // Schedule the initial round-intro delay
    scheduleRoundIntro();

    const model: GameModel = {
        get phase() {
            return gamePhase;
        },
        get player() {
            return player;
        },
        get opponent() {
            return opponent;
        },
        get match() {
            return matchModel;
        },
        get playerInput() {
            return playerInput;
        },
        get roundTimeRemainingMs() {
            return roundTimeRemainingMs;
        },

        reset(): void {
            matchModel.reset();
            resetFighters();
            resetInputSettle();
            roundTimeRemainingMs = ROUND_TIMER_MS;
            scheduleRoundIntro();
        },

        update(deltaMs: number): void {
            // Snapshot phase before timeline advance so that transitions
            // mid-tick don't cause the new phase's logic to run with the
            // full deltaMs of the transition tick.
            const phaseBefore = gamePhase;

            // Advance phase timeline (handles delays/transitions)
            phaseTimeline.time(phaseTimeline.time() + deltaMs * 0.001);

            // Restart handling
            const watched = watcher.poll();
            if (watched.restart.changed && watched.restart.value) {
                if (gamePhase === 'match-over') {
                    model.reset();
                    return;
                }
            }

            if (gamePhase === 'fighting' && phaseBefore === 'fighting') {
                // Decrement round timer
                roundTimeRemainingMs -= deltaMs;

                // Resolve and apply player input with settle logic
                applyPlayerInput(deltaMs);

                // AI updates and applies move to opponent
                ai.update(deltaMs, player, opponent);
                opponent.tryMove(ai.move);

                // Update fighters
                player.update(deltaMs);
                opponent.update(deltaMs);

                // Collision detection
                checkCollisions();

                // Timer expiry
                if (roundTimeRemainingMs <= 0) {
                    roundTimeRemainingMs = 0;
                    handleTimerExpiry();
                }
            }
            else if (gamePhase === 'round-intro' || gamePhase === 'point-scored' ||
                gamePhase === 'round-over' || gamePhase === 'match-over') {
                // Update fighters for ongoing animations (won/lost/defeated poses)
                player.update(deltaMs);
                opponent.update(deltaMs);
            }
        },
    };

    return model;

    // -----------------------------------------------------------------------
    // Input handling (same settle pattern as playtest-model)
    // -----------------------------------------------------------------------

    function resetInputSettle(): void {
        settledMove = 'idle';
        pendingMove = 'idle';
        settleAccumMs = 0;
        lastAcceptedMove = 'idle';
        lastPlayerFacing = player.facing;
    }

    function applyPlayerInput(deltaMs: number): void {
        const rawDir = resolveInputDirection(
            playerInput.xDirection,
            playerInput.yDirection,
            player.facing,
        );
        const rawMove = resolveMove(rawDir, playerInput.attackPressed);

        // Neutral move applies immediately
        if (rawMove === 'idle') {
            settledMove = 'idle';
            pendingMove = 'idle';
            settleAccumMs = 0;
        }
        else if (rawMove !== pendingMove) {
            pendingMove = rawMove;
            settleAccumMs = deltaMs;
            settledMove = 'idle';
        }
        else {
            settleAccumMs += deltaMs;
        }

        if (settleAccumMs >= INPUT_SETTLE_MS) {
            settledMove = pendingMove;
        }

        if (settledMove !== lastAcceptedMove) {
            if (player.tryMove(settledMove)) {
                lastAcceptedMove = settledMove;
            }
        }

        // Re-resolve after facing change (auto-turn moves)
        if (player.facing !== lastPlayerFacing) {
            lastPlayerFacing = player.facing;
            const updatedDir = resolveInputDirection(
                playerInput.xDirection,
                playerInput.yDirection,
                player.facing,
            );
            const updatedMove = resolveMove(updatedDir, playerInput.attackPressed);
            settledMove = updatedMove;
            pendingMove = updatedMove;
            lastAcceptedMove = updatedMove;
        }
    }

    // -----------------------------------------------------------------------
    // Collision detection
    // -----------------------------------------------------------------------

    function rectsOverlap(
        a: { x: number; y: number; w: number; h: number },
        b: { x: number; y: number; w: number; h: number },
    ): boolean {
        return a.x < b.x + b.w &&
            a.x + a.w > b.x &&
            a.y < b.y + b.h &&
            a.y + a.h > b.y;
    }

    function checkCollisions(): void {
        // Check player attacking opponent
        checkAttack(player, opponent, 'player');
        // Check opponent attacking player
        checkAttack(opponent, player, 'opponent');
    }

    function checkAttack(
        attacker: FighterModel,
        defender: FighterModel,
        attackerSide: 'player' | 'opponent',
    ): void {
        if (!attacker.isHitboxActive) return;

        const hitbox = attacker.hitbox;
        const bodyBox = defender.bodyBox;

        if (!rectsOverlap(hitbox, bodyBox)) return;

        // Get the move data for blocking check
        const moveKind = attacker.move;
        if (!moveKind) return;
        const moveData = MOVE_DATA[moveKind];

        // Check for passive block
        const defenderCanBlock = defender.phase === 'idle' || defender.phase === 'walking';
        if (defenderCanBlock && defender.isFacing(attacker.x) && moveData.isBlockable) {
            defender.block();
            // Clear hitbox to prevent re-triggering (fighter returns to idle from block)
            return;
        }

        // Hit connects - opponent is knocked down
        matchModel.scorePoint(attackerSide);
        defender.defeat(defeatVariantForMove(moveKind));

        // Transition to point-scored if the game was fighting
        if (gamePhase === 'fighting') {
            schedulePointScored();
        }
    }

    // -----------------------------------------------------------------------
    // Phase transitions
    // -----------------------------------------------------------------------

    function resetFighters(): void {
        player.reset(FIGHTER_START_LEFT_X, 'right');
        opponent.reset(FIGHTER_START_RIGHT_X, 'left');
    }

    function scheduleRoundIntro(): void {
        gamePhase = 'round-intro';
        phaseTimeline.clear().time(0);
        phaseTimeline.call(
            () => {
                gamePhase = 'fighting';
                roundTimeRemainingMs = ROUND_TIMER_MS;
                resetInputSettle();
            },
            undefined,
            ROUND_INTRO_DELAY_MS * 0.001,
        );
    }

    function schedulePointScored(): void {
        gamePhase = 'point-scored';
        phaseTimeline.clear().time(0);
        phaseTimeline.call(
            () => {
                if (matchModel.isRoundOver()) {
                    scheduleRoundOver();
                }
                else {
                    // Reset positions and resume fighting
                    resetFighters();
                    resetInputSettle();
                    gamePhase = 'fighting';
                    roundTimeRemainingMs = ROUND_TIMER_MS;
                }
            },
            undefined,
            POINT_SCORED_DELAY_MS * 0.001,
        );
    }

    function scheduleRoundOver(): void {
        gamePhase = 'round-over';
        phaseTimeline.clear().time(0);

        // Play won/lost poses
        const roundWinner = matchModel.getRoundWinner();
        if (roundWinner === 'player') {
            player.won();
            opponent.lost();
        }
        else if (roundWinner === 'opponent') {
            opponent.won();
            player.lost();
        }

        phaseTimeline.call(
            () => {
                matchModel.nextRound();
                if (matchModel.isMatchOver()) {
                    scheduleMatchOver();
                }
                else {
                    resetFighters();
                    resetInputSettle();
                    scheduleRoundIntro();
                }
            },
            undefined,
            ROUND_OVER_DELAY_MS * 0.001,
        );
    }

    function scheduleMatchOver(): void {
        gamePhase = 'match-over';
        phaseTimeline.clear().time(0);
        // Wait for restart input (handled in update loop)
    }

    function handleTimerExpiry(): void {
        if (matchModel.playerPoints > matchModel.opponentPoints) {
            // Player wins the round by points
            // Award enough points to trigger round-over
            while (!matchModel.isRoundOver()) {
                matchModel.scorePoint('player');
            }
            scheduleRoundOver();
        }
        else if (matchModel.opponentPoints > matchModel.playerPoints) {
            while (!matchModel.isRoundOver()) {
                matchModel.scorePoint('opponent');
            }
            scheduleRoundOver();
        }
        else {
            // Draw - no round point, start new round
            matchModel.nextRound();
            resetFighters();
            resetInputSettle();
            scheduleRoundIntro();
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Maps an attacking move to the most appropriate defeat animation.
 *  a = falling forward (low hits, back-attacks)
 *  b = falling backward (mid-height)
 *  c = falling backward (high / flying)
 *  d = curling up forward (crouch punch from front) */
function defeatVariantForMove(moveKind: MoveKind): DefeatVariant {
    switch (moveKind) {
        // Low hits / back-attacks -> falling forward
        case 'foot-sweep':
        case 'low-kick':
        case 'back-lunge-punch':
        case 'back-crouch-punch':
        case 'back-low-kick':
        case 'back-somersault':
            return 'a';

        // Mid-height -> falling backward
        case 'mid-kick':
        case 'high-punch':
        case 'roundhouse':
            return 'b';

        // High or flying -> falling backward (variant c)
        case 'high-kick':
        case 'flying-kick':
        case 'front-somersault':
            return 'c';

        // Crouch punch from front -> curling up
        case 'crouch-punch':
            return 'd';

        // Fallback
        default:
            return 'b';
    }
}

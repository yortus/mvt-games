import gsap from 'gsap';
import { watch } from '#common';
import {
    type DefeatVariant,
    type FighterMove,
    type GamePhase,
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
import { createFighterModel, type FighterModel } from './fighter-model';
import { createPlayerInput, type PlayerInput } from './player-input';
import { createScoreModel, type ScoreModel } from './score-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface GameModel {
    readonly phase: GamePhase;
    readonly player: FighterModel;
    readonly opponent: FighterModel;
    readonly score: ScoreModel;
    readonly playerInput: PlayerInput;
    readonly roundTimeRemainingMs: number;
    reset(): void;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// AI stub (Stage 7 placeholder)
// ---------------------------------------------------------------------------

interface AiStub {
    update(deltaMs: number, opponent: FighterModel, self: FighterModel): void;
    readonly inputDirection: 'none';
    readonly attackPressed: false;
}

function createAiStub(): AiStub {
    return {
        update(_deltaMs: number, _opponent: FighterModel, _self: FighterModel): void {
            // No-op until Stage 7
        },
        inputDirection: 'none',
        attackPressed: false,
    };
}

// ---------------------------------------------------------------------------
// Defeat variant helpers
// ---------------------------------------------------------------------------

const DEFEAT_VARIANTS: readonly DefeatVariant[] = ['a', 'b', 'c', 'd'];
let defeatVariantIndex = 0;

function nextDefeatVariant(): DefeatVariant {
    const variant = DEFEAT_VARIANTS[defeatVariantIndex];
    defeatVariantIndex = (defeatVariantIndex + 1) % DEFEAT_VARIANTS.length;
    return variant;
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

    const scoreModel = createScoreModel();
    const playerInput = createPlayerInput();
    const ai = createAiStub();

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
        get score() {
            return scoreModel;
        },
        get playerInput() {
            return playerInput;
        },
        get roundTimeRemainingMs() {
            return roundTimeRemainingMs;
        },

        reset(): void {
            scoreModel.reset();
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

                // AI updates and applies input to opponent
                ai.update(deltaMs, player, opponent);
                const aiDir = resolveInputDirection(
                    ai.inputDirection === 'none' ? 'none' : ai.inputDirection,
                    'none',
                    opponent.facing,
                );
                const aiMove = resolveMove(aiDir, ai.attackPressed);
                opponent.tryMove(aiMove);

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
        if (!attacker.hitboxActive) return;

        const hitbox = attacker.hitbox;
        const bodyBox = defender.bodyBox;

        if (!rectsOverlap(hitbox, bodyBox)) return;

        // Get the move data for blocking check
        const moveKind = attacker.move;
        if (!moveKind) return;
        const moveData = MOVE_DATA[moveKind];

        // Check for passive block
        const defenderCanBlock = defender.phase === 'idle' || defender.phase === 'walking';
        if (defenderCanBlock && defender.isFacing(attacker.x) && moveData.blockable) {
            defender.block();
            // Clear hitbox to prevent re-triggering (fighter returns to idle from block)
            return;
        }

        // Hit connects
        scoreModel.scorePoint(attackerSide);
        defender.hit(moveData.knockback);

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
                if (scoreModel.isRoundOver()) {
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
        const roundWinner = scoreModel.getRoundWinner();
        if (roundWinner === 'player') {
            player.won();
            opponent.defeat(nextDefeatVariant());
        }
        else if (roundWinner === 'opponent') {
            opponent.won();
            player.defeat(nextDefeatVariant());
        }

        phaseTimeline.call(
            () => {
                scoreModel.nextRound();
                if (scoreModel.isMatchOver()) {
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
        if (scoreModel.playerPoints > scoreModel.opponentPoints) {
            // Player wins the round by points
            // Award enough points to trigger round-over
            while (!scoreModel.isRoundOver()) {
                scoreModel.scorePoint('player');
            }
            scheduleRoundOver();
        }
        else if (scoreModel.opponentPoints > scoreModel.playerPoints) {
            while (!scoreModel.isRoundOver()) {
                scoreModel.scorePoint('opponent');
            }
            scheduleRoundOver();
        }
        else {
            // Draw - no round point, start new round
            scoreModel.nextRound();
            resetFighters();
            resetInputSettle();
            scheduleRoundIntro();
        }
    }
}

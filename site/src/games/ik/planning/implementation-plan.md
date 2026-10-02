# International Karate (IK) - Implementation Plan

A 1v1 karate fighting game inspired by the C64 classic, implemented as a new
game module under `src/games/ik/`. Player vs tinted AI opponent. Best-of-3
rounds, first to 3 points per round, with a 30-second round timer. Manual
facing via an 8-direction + attack button input system.

The design centres on two architectural concerns:

- **Clean model-side sequences** - paused GSAP timelines with `schedule*()`
  helpers, per the MVT guide's "advance then orchestrate" pattern.
- **Clean view-side animation** - stateless sprite selection driven by model
  `moveKind` + `frameIndex` bindings. No view-side timers or animation logic.

---

## Table of Contents

- [Stage Overview](#stage-overview)
- [Control Scheme (Authoritative)](#control-scheme-authoritative)
- [Move-to-Animation Mapping](#move-to-animation-mapping)
- [Stage 1: Texture Extraction Script](#stage-1-texture-extraction-script)
- [Stage 2: Data Layer](#stage-2-data-layer)
- [Stage 3: Fighter Model](#stage-3-fighter-model)
- [Stage 4: Fighter Playtest Harness](#stage-4-fighter-playtest-harness)
- [Stage 5: Game Model and Score](#stage-5-game-model-and-score)
- [Stage 6: Full Views](#stage-6-full-views)
- [Stage 7: AI Model and Polish](#stage-7-ai-model-and-polish)
- [Open Decisions](#open-decisions)
- [Verification Checklist](#verification-checklist)

---

## Stage Overview

| Stage | Scope                                       | Key outputs                                       | Testable?         |
| ----- | ------------------------------------------- | ------------------------------------------------- | ----------------- |
| 1     | Texture extraction script                   | ~77 individual frame PNGs in `assets/`            | Visual inspection |
| 2     | Data layer (types, constants, move defs)    | `data/` module with full type system              | Compile check     |
| 3     | Fighter model (state machine, sequences)    | `FighterModel` with GSAP-driven moves             | Unit tests        |
| 4     | Fighter playtest harness                    | `FighterView`, `PlayerInput`, minimal `GameEntry` | Manual play test  |
| 5     | Game model (orchestration, scoring, phases) | `GameModel` composing fighters + score            | Unit tests        |
| 6     | Full views (arena, HUD, game view)          | Full visual rendering                             | Visual / snapshot |
| 7     | AI model, entry polish, registration        | Playable game in cabinet                          | Manual play test  |

Stages 1-3 and 5 are independently unit-testable without any views.
Stage 4 provides a minimal visual harness for iterating on fighter feel
before building the full game model or opponent AI.

---

## Control Scheme (Authoritative)

All directions below are **relative to current facing**. "Forward" means toward
the opponent; "backward" means away. The model resolves raw left/right input
into forward/backward based on the fighter's `facing` property.

### Without attack button

| Direction    | #   | Move                  | Notes                        |
| ------------ | --- | --------------------- | ---------------------------- |
| Up           | 1   | Jump                  | Vertical arc, no attack      |
| Up-Forward   | 2   | High Punch (1,3)      |                              |
| Forward      | 3   | Walk Forward          | 8-frame walk cycle           |
| Down-Forward | 4   | High Kick (1,6,7)     |                              |
| Down         | 5   | Foot Sweep            | Low attack                   |
| Down-Back    | 6   | Crouch Punch          | Low punch                    |
| Backward     | 7   | Walk Backward         | 8-frame walk cycle, reversed |
| Up-Back      | 8   | Back High Punch (1,3) | **Auto-turns** then punches  |

### With attack button

| Direction    | #   | Move                  | Notes                     |
| ------------ | --- | --------------------- | ------------------------- |
| Up           | 9   | Flying Kick           | Airborne kick             |
| Up-Forward   | 10  | Front Somersault      | Airborne flip-kick        |
| Forward      | 11  | Mid Kick (1,2,3)      |                           |
| Down-Forward | 12  | Low Kick (1,4,5)      |                           |
| Down         | 13  | Back Crouch Punch     | **Auto-turns**, low punch |
| Down-Back    | 14  | Back Low Kick (1,4,5) | **Auto-turns**, back-kick |
| Backward     | 15  | Roundhouse            | Spinning back kick        |
| Up-Back      | 16  | Back Somersault       | Airborne back flip        |

### Neutral input

| Input                     | Result                |
| ------------------------- | --------------------- |
| No direction, no button   | Idle (standing pose)  |
| No direction, button only | Ignored (remain idle) |

### Auto-turn moves

Moves 8, 13, and 14 cause the fighter to turn and face the opposite direction.
The sequence is: play turning frames (5 frames), flip `facing`, then play the
attack animation, then return to idle facing the new direction.

### Blocking

Blocking is **passive/automatic**. There is no explicit block input. When a
fighter is in `'idle'` or `'walking'` phase and is hit by a `blockable` attack
while facing the opponent, the hit is blocked. The blocking animation (3 frames)
plays as a reaction, no damage is dealt, and there is no pushback. The block
animation is a brief interrupt before returning to idle.

---

## Move-to-Animation Mapping

Each control input maps to a `MoveKind`, and each `MoveKind` uses specific
animation frames from the spritesheet. Some MoveKinds share the same sprite
row and cycle through variants for visual variety.

### Spritesheet rows and frame names

| Row | y-start | Count | Frame names                                                          | Sprite content                   |
| --- | ------- | ----- | -------------------------------------------------------------------- | -------------------------------- |
| 0   | 14      | 8     | `walk-1` .. `walk-8`                                                 | Walk cycle                       |
| 1   | 70      | 1+6   | `jump-1`, `fwd-sault-1` .. `fwd-sault-6`                             | Jump pose + front somersault     |
| 2   | 126     | 6     | `back-sault-1` .. `back-sault-6`                                     | Back somersault                  |
| 3   | 182     | 7     | `kick-1` .. `kick-7`                                                 | 3 kick variants (shared frames)  |
| 4   | 238     | 6     | `punch-1` .. `punch-6`                                               | 4 punch variants (shared frames) |
| 5   | 294     | 3+4   | `back-kick-1` .. `back-kick-3`, `roundhouse-1` .. `roundhouse-4`     | Back kick + roundhouse           |
| 6   | 350     | 6+2   | `footsweep-1` .. `footsweep-6`, `crouch-punch-1` .. `crouch-punch-2` | Foot sweep + crouch punch        |
| 7   | 406     | 5     | `flying-kick-1` .. `flying-kick-5`                                   | Flying kick                      |
| 8   | 462     | 5+3   | `turn-1` .. `turn-5`, `block-1` .. `block-3`                         | Turning + blocking               |
| 9   | 518     | 3+3   | `defeat-a-1` .. `defeat-a-3`, `defeat-b-1` .. `defeat-b-3`           | Defeat variants A, B             |
| 10  | 566     | 3+3   | `defeat-c-1` .. `defeat-c-3`, `defeat-d-1` .. `defeat-d-3`           | Defeat variants C, D             |
| 11  | 622     | 2+1   | `won-1`, `won-2`, `lost-1`                                           | Won pose (2 frames) + lost pose  |

**Total: 77 individual frame PNGs.** Row 12 (bonus stage) is skipped.

All frames are **48 x 42 pixels**, arranged with a horizontal stride of 52px
(4px gap) starting at x=4. Vertical stride is 56px for rows 0-8. Rows 9-11
have reduced vertical spacing (48px, 44px) - the extraction script must use
the y-starts listed above, **not** assume uniform stride.

### Kick variants (row 3, 7 frames)

The 7 kick frames form 3 variants that share windup frames:

| Variant | Frame indices (0-based into row) | Sequence                           |
| ------- | -------------------------------- | ---------------------------------- |
| A       | 0, 1, 2                          | Windup, strike A, follow-through A |
| B       | 0, 3, 4                          | Windup, strike B, follow-through B |
| C       | 0, 5, 6                          | Windup, strike C, follow-through C |

Kick-using moves (4, 11, 12) cycle through variants A, B, C on each use.

### Punch variants (row 4, 6 frames)

The 6 punch frames form 4 variants with two different windup poses:

| Variant | Frame indices (0-based into row) | Sequence              |
| ------- | -------------------------------- | --------------------- |
| A       | 0, 1                             | Windup-high, strike A |
| B       | 0, 2                             | Windup-high, strike B |
| C       | 3, 4                             | Windup-low, strike C  |
| D       | 3, 5                             | Windup-low, strike D  |

Punch-using moves (2, 8) cycle through variants A, B, C, D on each use.

### Crouch punch sequence

The crouch punch uses only 2 frames but plays as a 4-frame sequence:
frame indices `[0, 1, 0, 0]` (strike out then retract).

### MoveKind-to-animation mapping

| MoveKind              | Animation source                    | Variant cycling | Airborne |
| --------------------- | ----------------------------------- | --------------- | -------- |
| `'jump'`              | `jump-1` (single frame)             | No              | Yes      |
| `'front-lunge-punch'` | punch row (row 4)                   | 4 variants      | No       |
| `'chest-kick'`        | kick row (row 3)                    | 3 variants      | No       |
| `'foot-sweep'`        | footsweep (row 6, first 6 frames)   | No              | No       |
| `'crouch-punch'`      | crouch-punch (row 6, last 2 frames) | No              | No       |
| `'back-lunge-punch'`  | punch row (row 4)                   | 4 variants      | No       |
| `'flying-kick'`       | flying-kick (row 7)                 | No              | Yes      |
| `'front-somersault'`  | fwd-sault (row 1, last 6 frames)    | No              | Yes      |
| `'front-kick'`        | kick row (row 3)                    | 3 variants      | No       |
| `'front-side-kick'`   | back-kick (row 5, first 3 frames)   | No              | No       |
| `'back-crouch-punch'` | crouch-punch (row 6, last 2 frames) | No              | No       |
| `'back-side-kick'`    | back-kick (row 5, first 3 frames)   | No              | No       |
| `'roundhouse'`        | roundhouse (row 5, last 4 frames)   | No              | No       |
| `'back-somersault'`   | back-sault (row 2)                  | No              | Yes      |

The `'walk'` phase is not a `MoveKind` - it is a separate `FighterPhase` that
cycles through the 8 walk frames in the model.

---

## Stage 1: Texture Extraction Script

**File:** `scripts/generate-ik-textures.ts`

**Source:** `src/games/ik/planning/ik-c64-textures.png` (master spritesheet,
stays in `planning/` - never placed in `assets/` to avoid the vite plugin
packing it as a frame).

**Output:** Individual PNGs written to `src/games/ik/assets/`.

### Steps

1. Read the master spritesheet PNG via `pngjs`.
2. For each frame (using the coordinate table above):
    - Extract a 48x42 region at the computed `(x, y)` position.
    - Replace the **frame background colour** with full transparency.
      The frame background is a flat grey `(149, 149, 149)` - verified.
      The script samples a known background position programmatically to
      confirm, rather than hardcoding.
    - Write the result as `<frame-name>.png` to the output directory.
3. Do **not** extract row 12 (bonus stage, starting around y=677).
4. Log the count of extracted frames and any frames where the background colour
   was not found (for debugging).

### Frame coordinate formula

```
x = 4 + (frameIndexInRow * 52)
y = ROW_Y_STARTS[rowIndex]
width = 48
height = 42
```

Where `ROW_Y_STARTS = [14, 70, 126, 182, 238, 294, 350, 406, 462, 518, 566, 622]`.

> **Note:** Row 11 contains 7 frames total, but only the first 3 (won/lost
> poses) are fighter frames. The remaining 4 are HUD/bonus indicator elements
> and are intentionally skipped.

### Frame naming per row

Use the kebab-case names from the "Spritesheet rows and frame names" table.
The names must exactly match what the texture registry in Stage 2 references.

### Verification

Run `npx tsx scripts/generate-ik-textures.ts` and visually inspect the output
in `src/games/ik/assets/`. Confirm:

- 77 PNGs exist with correct names.
- Frame backgrounds are transparent (no grey rectangles).
- The greenish spritesheet border (220, 254, 186) is not included in frames.
- Fighter silhouettes are intact (no colour channels removed erroneously).

---

## Stage 2: Data Layer

**Directory:** `src/games/ik/data/`

### Files

#### `common.ts` - Domain types

```ts
type Facing = 'left' | 'right';

type FighterPhase =
    | 'idle'
    | 'walking'
    | 'turning' // playing turn animation before a back-move
    | 'attacking' // executing a move sequence
    | 'blocking' // passive block reaction
    | 'airborne' // jump, somersault, flying kick
    | 'hit-reacting' // brief stagger after being hit
    | 'defeated' // playing a defeat animation
    | 'won' // round-win pose
    | 'lost'; // round-loss pose

type MoveKind =
    | 'front-lunge-punch'
    | 'chest-kick'
    | 'foot-sweep'
    | 'crouch-punch'
    | 'back-lunge-punch' // auto-turns
    | 'flying-kick'
    | 'front-somersault'
    | 'front-kick'
    | 'front-side-kick'
    | 'back-crouch-punch' // auto-turns
    | 'back-side-kick' // auto-turns
    | 'roundhouse'
    | 'back-somersault'
    | 'jump'; // non-attacking airborne move

type DefeatVariant = 'a' | 'b' | 'c' | 'd';

type GamePhase = 'round-intro' | 'fighting' | 'point-scored' | 'round-over' | 'match-over';

type InputDirection =
    | 'none'
    | 'forward'
    | 'backward'
    | 'up'
    | 'down'
    | 'up-forward'
    | 'up-backward'
    | 'down-forward'
    | 'down-backward';
```

Include helper functions:

- `resolveInputDirection(xDir, yDir, facing)` - converts raw
  `'left'|'none'|'right'` + `'up'|'none'|'down'` + current `Facing` into a
  relative `InputDirection`. "Forward" = toward the direction the fighter faces.
- `resolveMove(inputDir, attackPressed)` - maps an `InputDirection` + attack
  boolean to a `MoveResolution`: either `{ action: 'move', moveKind: MoveKind }`,
  `{ action: 'walk', direction: 'forward' | 'backward' }`,
  `{ action: 'jump' }`, or `{ action: 'idle' }`. This encodes the full control
  scheme table.

#### `arena-data.ts` - Constants

| Constant                | Value   | Description                                         |
| ----------------------- | ------- | --------------------------------------------------- |
| `ARENA_WIDTH`           | `10.0`  | Arena width in world units                          |
| `ARENA_MIN_X`           | `0.5`   | Left boundary (centre of leftmost fighter position) |
| `ARENA_MAX_X`           | `9.5`   | Right boundary                                      |
| `FIGHTER_BODY_WIDTH`    | `0.8`   | Fighter hittable body width in world units          |
| `FIGHTER_START_LEFT_X`  | `2.5`   | Player starting position                            |
| `FIGHTER_START_RIGHT_X` | `7.5`   | Opponent starting position                          |
| `SCREEN_WIDTH`          | `384`   | Pixel width of rendered game                        |
| `SCREEN_HEIGHT`         | `270`   | Pixel height (play area + HUD)                      |
| `HUD_HEIGHT`            | `30`    | Pixel height of HUD bar                             |
| `GROUND_Y_PX`           | `210`   | Pixel Y for ground line                             |
| `FRAME_WIDTH`           | `48`    | Sprite frame pixel width                            |
| `FRAME_HEIGHT`          | `42`    | Sprite frame pixel height                           |
| `WALK_SPEED`            | `2.0`   | World units per second                              |
| `JUMP_DURATION_MS`      | `500`   | Full jump arc duration                              |
| `JUMP_HEIGHT`           | `2.5`   | Peak jump height in world units                     |
| `ROUND_TIMER_MS`        | `30000` | 30-second round timer                               |
| `POINTS_TO_WIN_ROUND`   | `3`     | Points needed to win one round                      |
| `ROUNDS_TO_WIN_MATCH`   | `2`     | Rounds needed to win the match (best of 3)          |
| `ROUND_INTRO_DELAY_MS`  | `2000`  | Pause before fighting starts                        |
| `POINT_SCORED_DELAY_MS` | `1500`  | Pause after a point is scored                       |
| `ROUND_OVER_DELAY_MS`   | `3000`  | Pause showing winner/loser poses                    |
| `HIT_REACTION_MS`       | `400`   | Duration of hit stagger                             |
| `BLOCK_REACTION_MS`     | `300`   | Duration of block animation                         |

Pixel constants (`SCREEN_WIDTH`, `SCREEN_HEIGHT`, etc.) are for view-layer use
only. The model references only world-unit constants. The view computes a scale
factor: `SCREEN_WIDTH / ARENA_WIDTH` to convert world positions to pixels.

#### `move-data.ts` - Static move definitions

```ts
interface MoveData {
    /** Duration in ms for each frame in the sequence. */
    frameDurationMs: readonly number[];
    /** Which entries in `frames` have an active hitbox (0-based frame indices). */
    hitFrameIndices: readonly number[];
    /** Points scored on hit. */
    damage: number;
    /** Hitbox offset and size relative to fighter centre, in world units.
     *  dx is in the fighter's forward direction (model flips for facing). */
    hitbox: { dx: number; dy: number; w: number; h: number };
    /** Forward lunge distance during the move (world units). */
    lunge: number;
    /** Whether this attack can be passively blocked. */
    blockable: boolean;
    /** Pushback applied to the defender on hit (world units). */
    knockback: number;
    /** Whether the fighter is airborne during this move. */
    airborne: boolean;
    /** Whether the fighter auto-turns before executing (moves 8, 13, 14). */
    autoTurn: boolean;
}
```

Export `MOVE_DATA: Record<MoveKind, MoveData>`.

Note: `MoveData` does not include a `frames` array because moves with variant
cycling have multiple possible frame sequences. Frame sequences are resolved at
runtime from the separate `MOVE_VARIANTS` table (for cycling moves) or are
implicit for non-cycling moves (the full animation source in order).

For moves with **variant cycling** (kicks, punches), export:

```ts
interface MoveVariants {
    /** One frame-index sequence per variant. Indices are 0-based into the
     *  animation source's texture array (e.g. kick-1 through kick-7). */
    sequences: readonly (readonly number[])[];
}

// MOVE_VARIANTS: Partial<Record<MoveKind, MoveVariants>>
```

`MOVE_VARIANTS` has entries only for `'chest-kick'`, `'front-kick'`,
`'front-lunge-punch'`, and `'back-lunge-punch'`. Other moves use their full
frame list in order.

Frame durations, hitbox sizes, damage values, and lunge distances are tuning
parameters. Start with reasonable defaults and refine during play-testing:

- Frame duration: ~80ms per frame.
- Damage: 1 point per hit for all moves.
- Lunge: 0.3 world units for grounded attacks, 0 for airborne.
- Knockback: 0.5 world units.
- All grounded attacks are blockable; airborne attacks are not blockable.

#### `textures.ts` - Texture registry

```ts
export const textures = createTextureRegistry('assets/ik-textures.json', {
    walk: {
        1: 'walk-1',
        2: 'walk-2',
        3: 'walk-3',
        4: 'walk-4',
        5: 'walk-5',
        6: 'walk-6',
        7: 'walk-7',
        8: 'walk-8',
    },
    jump: { 1: 'jump-1' },
    fwdSault: {
        1: 'fwd-sault-1',
        2: 'fwd-sault-2',
        3: 'fwd-sault-3',
        4: 'fwd-sault-4',
        5: 'fwd-sault-5',
        6: 'fwd-sault-6',
    },
    backSault: {
        1: 'back-sault-1',
        2: 'back-sault-2',
        3: 'back-sault-3',
        4: 'back-sault-4',
        5: 'back-sault-5',
        6: 'back-sault-6',
    },
    kick: {
        1: 'kick-1',
        2: 'kick-2',
        3: 'kick-3',
        4: 'kick-4',
        5: 'kick-5',
        6: 'kick-6',
        7: 'kick-7',
    },
    punch: {
        1: 'punch-1',
        2: 'punch-2',
        3: 'punch-3',
        4: 'punch-4',
        5: 'punch-5',
        6: 'punch-6',
    },
    backKick: { 1: 'back-kick-1', 2: 'back-kick-2', 3: 'back-kick-3' },
    roundhouse: {
        1: 'roundhouse-1',
        2: 'roundhouse-2',
        3: 'roundhouse-3',
        4: 'roundhouse-4',
    },
    footsweep: {
        1: 'footsweep-1',
        2: 'footsweep-2',
        3: 'footsweep-3',
        4: 'footsweep-4',
        5: 'footsweep-5',
        6: 'footsweep-6',
    },
    crouchPunch: { 1: 'crouch-punch-1', 2: 'crouch-punch-2' },
    flyingKick: {
        1: 'flying-kick-1',
        2: 'flying-kick-2',
        3: 'flying-kick-3',
        4: 'flying-kick-4',
        5: 'flying-kick-5',
    },
    turn: {
        1: 'turn-1',
        2: 'turn-2',
        3: 'turn-3',
        4: 'turn-4',
        5: 'turn-5',
    },
    block: { 1: 'block-1', 2: 'block-2', 3: 'block-3' },
    defeatA: { 1: 'defeat-a-1', 2: 'defeat-a-2', 3: 'defeat-a-3' },
    defeatB: { 1: 'defeat-b-1', 2: 'defeat-b-2', 3: 'defeat-b-3' },
    defeatC: { 1: 'defeat-c-1', 2: 'defeat-c-2', 3: 'defeat-c-3' },
    defeatD: { 1: 'defeat-d-1', 2: 'defeat-d-2', 3: 'defeat-d-3' },
    won: { 1: 'won-1', 2: 'won-2' },
    lost: { 1: 'lost-1' },
});
```

Leaf string values must match the filenames (sans `.png`) produced by the
extraction script.

#### `index.ts` - Barrel

Re-exports all types, constants, move data, and `textures`.

---

## Stage 3: Fighter Model

**File:** `src/games/ik/models/fighter-model.ts`

The fighter model is the core sequence-driven entity. It manages one fighter's
position, facing, phase, current move, and animation frame index. All state
transitions use paused GSAP timelines.

### Interface

```ts
interface FighterModel {
    /** Horizontal position in world units. */
    readonly x: number;
    /** Vertical offset above ground in world units (0 = grounded). */
    readonly jumpHeight: number;
    /** Which direction the fighter faces. */
    readonly facing: Facing;
    /** Current high-level phase. */
    readonly phase: FighterPhase;
    /** Current move being executed (undefined when idle/walking). */
    readonly moveKind: MoveKind | undefined;
    /** Current frame index within the active animation sequence (0-based). */
    readonly frameIndex: number;
    /** Whether the move's hitbox is currently active this frame. */
    readonly hitboxActive: boolean;
    /** World-space hitbox rectangle (only meaningful when hitboxActive). */
    readonly hitbox: { x: number; y: number; w: number; h: number };
    /** World-space body box (always valid; used for receiving hits). */
    readonly bodyBox: { x: number; y: number; w: number; h: number };
    /** Whether this fighter is facing the given x position. */
    isFacing(targetX: number): boolean;
    /** Apply a directional input + attack state. Called by game model each tick. */
    applyInput(inputDir: InputDirection, attackPressed: boolean): void;
    /** External command: take a hit with the given knockback. */
    applyHit(knockback: number): void;
    /** External command: passively block an incoming attack. */
    applyBlock(): void;
    /** External command: play a defeat animation. */
    applyDefeat(variant: DefeatVariant): void;
    /** External command: play the round-won pose. */
    applyWon(): void;
    /** External command: play the round-lost pose. */
    applyLost(): void;
    /** Reset to starting position and idle state. */
    reset(startX: number, facing: Facing): void;
    /** Advance timelines by deltaMs. */
    update(deltaMs: number): void;
}
```

### Options

```ts
interface FighterModelOptions {
    startX: number;
    startFacing: Facing;
    arenaMinX: number;
    arenaMaxX: number;
}
```

### Factory: `createFighterModel(options): FighterModel`

**Internal state** (closure-scoped):

- Position: `x`, `jumpHeight`
- Identity: `facing`
- Animation: `phase`, `moveKind`, `frameIndex`, `hitboxActive`
- Variant tracking: `kickVariantIndex`, `punchVariantIndex` (cycle
  independently, incrementing after each use)
- A single paused GSAP timeline:
  `gsap.timeline({ paused: true, autoRemoveChildren: true })`

**`update(deltaMs)` pattern** - advance then orchestrate:

1. Advance timeline: `timeline.time(timeline.time() + 0.001 * deltaMs)`
2. Clamp `x` to `[arenaMinX, arenaMaxX]`.
3. No further orchestration in `update()` - input is applied externally via
   `applyInput()`.

**`applyInput(inputDir, attackPressed)`:**

- Only acts when `phase` is `'idle'` or `'walking'` (mid-move is ignored).
- Uses `resolveMove(inputDir, attackPressed)` from the data layer.
- Walk: sets `phase = 'walking'`, starts continuous `x` tween at `WALK_SPEED`.
  Walk `frameIndex` increments based on distance covered (not elapsed time),
  cycling 0-7.
- Idle: sets `phase = 'idle'`, clears walk tween.
- Jump: calls `scheduleJump()`.
- Move: calls `scheduleAttack(moveKind)` or `scheduleAutoTurnAttack(moveKind)`.

### `schedule*()` helpers

These build GSAP timeline sequences. Each clears the timeline first.

- **`scheduleAttack(moveKind)`**: Resolves current variant if applicable
  (via `MOVE_VARIANTS`). Sets `phase = 'attacking'` (or `'airborne'` if
  `moveData.airborne`), sets `moveKind`. Steps through frame sequence:
  `timeline.set(state, { frameIndex: i }, t)` at cumulative time offsets.
  On hit frames, sets `hitboxActive = true`; on non-hit frames, sets it
  false. Applies `lunge` as a forward `x` tween over the move's duration.
  If airborne, also tweens `jumpHeight` in a parabolic arc. On completion,
  resets to `phase = 'idle'`, `moveKind = undefined`, `hitboxActive = false`,
  `jumpHeight = 0`.

- **`scheduleAutoTurnAttack(moveKind)`**: For moves 8, 13, 14. Clears
  timeline. Sets `phase = 'turning'`. Steps through 5 turn frames (~80ms
  each, 400ms total). At the end of the turn, flips `facing` via
  `timeline.call()`. Then chains the attack sequence.

- **`scheduleJump()`**: Sets `phase = 'airborne'`, `moveKind = 'jump'`.
  Tweens `jumpHeight` from 0 to `JUMP_HEIGHT` and back using two sequential
  tweens (`power1.out` up, `power1.in` down) over `JUMP_DURATION_MS`. On
  completion: `jumpHeight = 0`, `phase = 'idle'`.

- **`scheduleBlock()`**: Sets `phase = 'blocking'`. Steps through 3 block
  frames over `BLOCK_REACTION_MS` (300ms). Returns to `phase = 'idle'`.

- **`scheduleHitReaction(knockback)`**: Sets `phase = 'hit-reacting'`.
  Tweens `x` by `knockback` away from the attacker direction. Holds for
  `HIT_REACTION_MS` (400ms). Returns to `phase = 'idle'`.

- **`scheduleDefeat(variant)`**: Sets `phase = 'defeated'`. Plays 3 frames
  of the selected variant. Remains in `'defeated'` (does not auto-return).

- **`scheduleWon()` / `scheduleLost()`**: Sets `phase = 'won'` / `'lost'`.
  Won: cycles `won-1` and `won-2`. Lost: shows `lost-1`. Remains in phase.

### Key rules

- Moves can only be initiated from `'idle'` or `'walking'` phase. No
  move-cancelling.
- Position is clamped to `[arenaMinX, arenaMaxX]` after every timeline advance.
- `bodyBox` is always a fixed rectangle centred on the fighter's `(x, jumpHeight)`.
- `hitbox` is computed from the current `MoveData.hitbox` offset, with `dx`
  sign flipped for `facing === 'left'`, then shifted by `x` and `jumpHeight`.
- Walk `frameIndex` cycles 0-7 based on cumulative distance moved, not time.
  Walking into a wall produces no animation cycling.

### Unit tests

- From idle, applying each input direction with/without attack triggers the
  correct `moveKind` and `phase`.
- Advancing time through a move sequence produces the expected `frameIndex`
  progression.
- `hitboxActive` is only true during the specified hit frames.
- Auto-turn moves flip `facing` after the turn frames complete.
- `applyInput` is ignored while a move is active.
- Position stays within arena bounds.
- Variant cycling increments correctly and wraps around.

---

## Stage 4: Fighter Playtest Harness

**Goal:** Allow human playtesting of the `FighterModel` with keyboard input,
a rendered sprite, and a minimal game entry - so we can iterate on movement
feel, animation timing, and frame sequences before building the full game model
or opponent AI. No opponent, no scoring, no AI at this stage.

### Files

#### `models/player-input.ts` - Mutable input record

Same pattern as Dig Dug:

```ts
interface PlayerInput {
    xDirection: 'left' | 'none' | 'right';
    yDirection: 'up' | 'none' | 'down';
    attackPressed: boolean;
    restartPressed: boolean;
}
```

Created via `createPlayerInput()` returning the record with all fields
initialised to neutral/false.

#### `views/fighter-view.ts` - Reusable leaf view

Used for both player and opponent (differentiated by `tint` binding).

**Bindings:**

```ts
interface FighterViewBindings {
    getX(): number;
    getJumpHeight(): number;
    getFacing(): Facing;
    getPhase(): FighterPhase;
    getMoveKind(): MoveKind | undefined;
    getFrameIndex(): number;
    getDefeatVariant(): DefeatVariant;
    getTint(): number;
}
```

**Rendering logic:**

A `Sprite` inside a `Container`. Anchor at bottom-centre.

In `refresh()`:

- **Position:** `sprite.x = getX() * scale` where
  `scale = SCREEN_WIDTH / ARENA_WIDTH`.
  `sprite.y = GROUND_Y_PX - getJumpHeight() * scale`.
- **Facing:** `sprite.scale.x` is positive for right-facing, negative for
  left-facing. (Verify which direction the source sprites face after texture
  extraction; invert if needed.)
- **Tint:** `sprite.tint = getTint()`.
- **Texture selection:** Map `(phase, moveKind, frameIndex)` to a `Texture`
  via a lookup structure built at construction from the texture registry:
    - `phase = 'idle'` -> `walk.1` (neutral standing pose)
    - `phase = 'walking'` -> `walk[frameIndex + 1]`
    - `phase = 'turning'` -> `turn[frameIndex + 1]`
    - `phase = 'blocking'` -> `block[frameIndex + 1]`
    - `phase = 'attacking'` or `'airborne'` -> resolve from `moveKind` using
      the MoveKind-to-texture-group mapping
    - `phase = 'hit-reacting'` -> `walk.1` (or a distinct recoil frame if
      desired)
    - `phase = 'defeated'` -> `defeat[variant][frameIndex + 1]`
    - `phase = 'won'` -> `won[frameIndex + 1]`
    - `phase = 'lost'` -> `lost.1`

Use `watch()` on the composite of `(phase, moveKind, frameIndex)` so the
texture is only swapped when the animation state actually changes (avoiding
per-frame texture assignment on the hot path).

#### `views/arena-view.ts` - Simple background

Minimal background for context during playtesting:

- Solid colour background rectangle (sky blue or similar C64 colour).
- Ground rectangle at and below `GROUND_Y_PX`.
- Purely decorative. Accept `width` and `height` as parameters. No bindings.

#### `views/playtest-view.ts` - Temporary top-level harness view

A simplified top-level view that wires one fighter + keyboard input. This file
is temporary and will be replaced by the full `game-view.ts` in Stage 6.

```ts
function createPlaytestView(fighter: FighterModel, playerInput: PlayerInput): Container;
```

Composes:

- `createArenaView(SCREEN_WIDTH, SCREEN_HEIGHT)`
- `createFighterView({ ... bindings from fighter ... })`
- `createKeyboardInputView({ ... wires to playerInput ... })`
- Optional: a debug text overlay showing current `phase`, `moveKind`,
  `frameIndex`, `facing` for development convenience.

#### `ik-entry.ts` - Minimal game entry (playtest)

A cut-down entry that creates a single fighter, wires keyboard input, and
runs the update loop. No opponent, no scoring, no game phases.

```ts
function createIkEntry(): GameEntry;
```

- `load()`: loads textures.
- `start(stage)`: creates `FighterModel`, `PlayerInput`, `PlaytestView`.
  Wires the ticker: each frame resolves `resolveInputDirection()` from
  `PlayerInput`, calls `fighter.applyInput()`, then `fighter.update(deltaMs)`.
- Returns a `GameSession` with `update()` and `destroy()`.

#### `src/games/ik/index.ts` - Barrel

Re-exports `createIkEntry`.

#### Registration

- `src/games/index.ts` - add `export { createIkEntry } from './ik'`.
- `src/main.ts` - add `createIkEntry()` to the games array.

### Verification

- [ ] Game appears in the cabinet menu and loads without errors.
- [ ] Fighter renders at the correct position with the idle sprite.
- [ ] Arrow keys + spacebar produce all 16 moves with correct animations.
- [ ] Walk animation cycles frames based on movement.
- [ ] Jump arcs the fighter up and back down.
- [ ] Auto-turn moves visually flip the sprite partway through.
- [ ] Moves complete and return to idle.
- [ ] Input is ignored during active moves (no move-cancelling).
- [ ] Fighter is clamped to arena boundaries.
- [ ] Iterate on frame timing, lunge distances, and jump feel.

---

## Stage 5: Game Model and Score

### `models/score-model.ts`

```ts
interface ScoreModel {
    readonly playerPoints: number;
    readonly opponentPoints: number;
    readonly playerRounds: number;
    readonly opponentRounds: number;
    readonly round: number;
    scorePoint(scorer: 'player' | 'opponent'): void;
    isRoundOver(): boolean;
    isMatchOver(): boolean;
    getRoundWinner(): 'player' | 'opponent' | undefined;
    getMatchWinner(): 'player' | 'opponent' | undefined;
    nextRound(): void;
    reset(): void;
}
```

Points per round: first to `POINTS_TO_WIN_ROUND` (3). Match: first to
`ROUNDS_TO_WIN_MATCH` (2) rounds won. `nextRound()` resets per-round points
and increments the round counter.

### `models/game-model.ts`

**Interface:**

```ts
interface GameModel {
    readonly phase: GamePhase;
    readonly player: FighterModel;
    readonly opponent: FighterModel;
    readonly score: ScoreModel;
    readonly playerInput: PlayerInput;
    readonly roundTimeRemainingMs: number;
    reset(): void;
    update(deltaMs: number): void;
}
```

**Factory: `createGameModel(options): GameModel`**

Composes:

- `player` - `createFighterModel({ startX: FIGHTER_START_LEFT_X, startFacing: 'right', ... })`
- `opponent` - `createFighterModel({ startX: FIGHTER_START_RIGHT_X, startFacing: 'left', ... })`
- `ai` - `createAiModel(...)` (Stage 7; use a no-op stub until then so the
  opponent stands idle)
- `playerInput` - `createPlayerInput()`
- `score` - `createScoreModel()`
- `roundTimeRemainingMs` - starts at `ROUND_TIMER_MS`

**Phase timeline** (paused GSAP timeline for delays):

**`update(deltaMs)` - advance then orchestrate:**

1. Advance phase timeline.
2. Detect restart input via `watch()` on `playerInput.restartPressed`.

3. **`'round-intro'`:** Fighters at starting positions. Timer counts down
   from `ROUND_INTRO_DELAY_MS`. When elapsed, transition to `'fighting'`
   and reset `roundTimeRemainingMs` to `ROUND_TIMER_MS`.

4. **`'fighting'`:**
   a. Decrement `roundTimeRemainingMs` by `deltaMs`.
   b. Resolve player input: `resolveInputDirection(playerInput.xDirection,
   playerInput.yDirection, player.facing)` then
   `player.applyInput(inputDir, playerInput.attackPressed)`.
   c. AI updates and applies input to opponent (Stage 7).
   d. Call `player.update(deltaMs)` and `opponent.update(deltaMs)`.
   e. **Collision detection** (see below).
   f. If `roundTimeRemainingMs <= 0`: timer expired, determine round winner
   by point count (draw = no round point), transition to `'round-over'`.

5. **`'point-scored'`:** Waiting `POINT_SCORED_DELAY_MS`. When elapsed:
   if the round is decided (`score.isRoundOver()`), transition to
   `'round-over'`; otherwise reset fighter positions, transition to
   `'fighting'`.

6. **`'round-over'`:** Winner plays won pose, loser plays lost/defeated
   pose. Wait `ROUND_OVER_DELAY_MS` or restart input. Then: if
   `score.isMatchOver()`, transition to `'match-over'`; otherwise
   `score.nextRound()`, reset fighters, transition to `'round-intro'`.

7. **`'match-over'`:** Waiting for restart input. On restart: `score.reset()`,
   reset fighters, transition to `'round-intro'`.

### Collision detection

Each tick during `'fighting'`, check both fighters as potential attackers:

1. If `attacker.hitboxActive`, test rectangle overlap between
   `attacker.hitbox` and `defender.bodyBox`.
2. On overlap:
   a. If defender's `phase` is `'idle'` or `'walking'`, defender `isFacing(attacker.x)`,
   and the move's `blockable` flag is true: **blocked**. Call
   `defender.applyBlock()`. Clear attacker's `hitboxActive` to prevent
   re-triggering.
   b. Otherwise: **hit**. Call `score.scorePoint(attackerSide)`. Call
   `defender.applyHit(moveData.knockback)`. Clear attacker's
   `hitboxActive`. Transition to `'point-scored'`.
3. Both fighters can hit each other on the same tick (simultaneous trades
   are valid; both score a point).

### Round timer

`roundTimeRemainingMs` starts at `ROUND_TIMER_MS` (30000) when entering
`'fighting'` phase and decrements each tick. The view displays this as a
countdown in seconds. When it reaches 0:

- If points are unequal, the leader wins the round.
- If points are equal, the round is a draw (no round point awarded) and a
  new round begins.

### Unit tests

- Phase transitions follow the expected sequence.
- Collision detection correctly identifies hits and blocks.
- Blocked attacks: no points scored, defender plays block animation.
- Scoring increments correctly. Round and match win conditions work.
- Timer expiry triggers round-over with the correct winner.
- Timer draw handling: no round point, new round starts.
- Restart input resets match correctly from every phase.
- Fighters are repositioned after point-scored delay.

---

## Stage 6: Full Views

**Directory:** `src/games/ik/views/`

This stage replaces the temporary `playtest-view.ts` with the full game view
and adds the HUD and overlay.

### `views/hud-view.ts` - Score and timer display

**Bindings:**

```ts
interface HudViewBindings {
    getPlayerPoints(): number;
    getOpponentPoints(): number;
    getPlayerRounds(): number;
    getOpponentRounds(): number;
    getRound(): number;
    getRoundTimeRemainingMs(): number;
    getGamePhase(): GamePhase;
}
```

**Layout:**

- Player score on the left (e.g. filled circles or pips for points).
- Opponent score on the right.
- Round indicators (won rounds) as icons or markers.
- Countdown timer displayed as whole seconds in the top centre.
- Text updates for phase: "Round N" during `'round-intro'`, "TIME" when
  timer expires, "Game Over" during `'match-over'`.

Use `watch()` on each binding to avoid redundant `Text` updates.

### `views/game-view.ts` - Full top-level application view

Accepts `GameModel` directly (application-specific, never reused).
Replaces the temporary `playtest-view.ts`.

**Composition:**

```ts
function createGameView(game: GameModel): Container {
    const container = new Container();

    // Background
    container.addChild(createArenaView(SCREEN_WIDTH, SCREEN_HEIGHT - HUD_HEIGHT));

    // Player fighter
    container.addChild(
        createFighterView({
            getX: () => game.player.x,
            getJumpHeight: () => game.player.jumpHeight,
            getFacing: () => game.player.facing,
            getPhase: () => game.player.phase,
            getMoveKind: () => game.player.moveKind,
            getFrameIndex: () => game.player.frameIndex,
            getDefeatVariant: () => game.player.defeatVariant,
            getTint: () => 0xffffff, // no tint (original colours)
        }),
    );

    // Opponent fighter
    container.addChild(
        createFighterView({
            getX: () => game.opponent.x,
            getJumpHeight: () => game.opponent.jumpHeight,
            getFacing: () => game.opponent.facing,
            getPhase: () => game.opponent.phase,
            getMoveKind: () => game.opponent.moveKind,
            getFrameIndex: () => game.opponent.frameIndex,
            getDefeatVariant: () => game.opponent.defeatVariant,
            getTint: () => 0xff6666, // red tint for opponent
        }),
    );

    // HUD
    container.addChild(
        createHudView({
            getPlayerPoints: () => game.score.playerPoints,
            getOpponentPoints: () => game.score.opponentPoints,
            getPlayerRounds: () => game.score.playerRounds,
            getOpponentRounds: () => game.score.opponentRounds,
            getRound: () => game.score.round,
            getRoundTimeRemainingMs: () => game.roundTimeRemainingMs,
            getGamePhase: () => game.phase,
        }),
    );

    // Overlay for phase messages (round intro, game over, etc.)
    container.addChild(
        createOverlayView({
            getPhase: () => game.phase,
            getRound: () => game.score.round,
            getMatchWinner: () => game.score.getMatchWinner(),
        }),
    );

    // Keyboard input wiring
    container.addChild(
        createKeyboardInputView({
            onXDirectionChanged: (dir) => {
                game.playerInput.xDirection = dir;
            },
            onYDirectionChanged: (dir) => {
                game.playerInput.yDirection = dir;
            },
            onPrimaryButtonChanged: (pressed) => {
                game.playerInput.attackPressed = pressed;
            },
            onRestartButtonChanged: (pressed) => {
                game.playerInput.restartPressed = pressed;
            },
        }),
    );

    return container;
}
```

### Update `ik-entry.ts`

Replace the playtest harness with the full game entry wiring `GameModel` +
`GameView`. Remove the temporary `playtest-view.ts`.

### `views/index.ts` - Barrel

Re-exports `createGameView`, `createFighterView`, `createArenaView`,
`createHudView`.

### Verification

- [ ] Fighters render with correct sprites for every move and phase.
- [ ] Opponent is visibly tinted a different colour.
- [ ] Sprite flips correctly for both facing directions.
- [ ] Jump height offsets sprites vertically.
- [ ] HUD displays scores, round count, and countdown timer.
- [ ] Overlay shows appropriate text per game phase.
- [ ] Keyboard input controls the player fighter.
- [ ] Full loop: round intro -> fight -> score -> round end -> match end -> restart.

---

## Stage 7: AI Model and Polish

### `models/ai-model.ts`

**Interface:**

```ts
interface AiModel {
    update(deltaMs: number, opponent: FighterModel, self: FighterModel): void;
    readonly inputDirection: InputDirection;
    readonly attackPressed: boolean;
}
```

**Factory: `createAiModel(options): AiModel`**

Options:

- `reactionMs: number` - how often the AI re-evaluates (default 250ms)
- `aggressionPct: number` - probability of attacking when in range (default 0.4)
- `blockChancePct: number` - probability of facing the opponent to enable
  passive blocking (default 0.3)

**Internal state:**

- `thinkTimer` - counts down, re-evaluates when hitting 0.
- `inputDirection`, `attackPressed` - output fields read by game model.

**Decision tree** (evaluated when `thinkTimer` expires):

1. Compute distance to opponent (`Math.abs(self.x - opponent.x)`).
2. If opponent is `'attacking'` or `'airborne'` and within range: face the
   opponent to enable passive blocking (set `inputDirection = 'none'`,
   `attackPressed = false`). With probability `1 - blockChancePct`, retreat
   backward instead.
3. If distance is too large (> attack range): walk forward.
4. If distance is too small (< minimum comfort range): walk backward.
5. If within attack range:
   a. With probability `aggressionPct`: pick a random attack. Weighted
   distribution favours simple moves (chest kick, front kick, foot sweep)
   over complex ones (somersaults, flying kick).
   b. Otherwise: idle or walk slightly to adjust position.
6. Low-probability wildcard: execute a back-move or somersault.
7. Set `thinkTimer` to `reactionMs` (with +-50ms jitter for variation).

### Integration

- Wire `AiModel` into `GameModel` (replace the no-op stub from Stage 5).
- `GameModel.update()` calls `ai.update(deltaMs, player, opponent)` then
  applies `ai.inputDirection` and `ai.attackPressed` to the opponent fighter.

### Polish

- Final tuning of frame durations, hitbox sizes, lunge distances, knockback.
- Defeat variant selection (random or mapped to the killing move type).
- Optional: scene background changes per round.
- Optional: AI difficulty progression (tighten `reactionMs` each round).

### `models/index.ts` - Updated barrel

Re-exports: `FighterModel`, `createFighterModel`, `GameModel`,
`createGameModel`, `AiModel`, `createAiModel`, `PlayerInput`,
`createPlayerInput`, `ScoreModel`, `createScoreModel`.

### Verification

- [ ] AI opponent moves, attacks, and reacts.
- [ ] Full game loop works end-to-end with AI.
- [ ] `npm run build` succeeds.
- [ ] `npm run lint` passes.
- [ ] Manual play-test: controls feel responsive, AI is a reasonable challenge.

---

## Open Decisions

These items have reasonable defaults specified above but may need revisiting
during implementation or play-testing:

| #   | Decision                       | Current default                          | Alternatives                                                                             |
| --- | ------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | Opponent tint colour           | `0xFF6666` (red)                         | `0x6666FF` (blue), `0xFFFF66` (gold) - test which works best with the C64 sprite palette |
| 2   | Half-points vs full-points     | Full points only (1 per hit)             | Original IK had half-points for glancing hits - could add 0.5 scoring                    |
| 3   | Damage per move type           | All hits score 1 point                   | Different `damage` values per `MoveKind` (e.g. somersault = 2)                           |
| 4   | Defeat variant selection       | Random                                   | Map to the killing move type (e.g. foot sweep -> variant A, roundhouse -> variant B)     |
| 5   | Walk frame cycling             | Distance-based in model                  | Timer-based cycling (simpler; animation plays even against a wall)                       |
| 6   | Source sprite facing direction | Assumed right-facing                     | Verify after texture extraction; if left-facing, invert `scale.x` logic                  |
| 7   | AI difficulty progression      | Fixed values                             | Tighten `reactionMs` and raise `aggressionPct` each round                                |
| 8   | Timer-expiry draw handling     | No round point awarded; new round begins | Sudden-death extension (extra 10s)                                                       |
| 9   | Background scenery             | Solid colour                             | Scene changes per round, parallax layers (like original IK)                              |

---

## Verification Checklist

### After Stage 1

- [ ] 77 PNGs in `src/games/ik/assets/` with correct names
- [ ] Frame backgrounds are transparent
- [ ] Fighter silhouettes are complete and undamaged
- [ ] `npm run dev` serves `/assets/ik-textures.json` successfully

### After Stage 2

- [ ] `npm run build` compiles with no type errors
- [ ] `npm run lint` passes
- [ ] `resolveInputDirection` correctly maps all 8 directions for both facings
- [ ] `resolveMove` returns the correct action for every control-scheme entry

### After Stage 3

- [ ] Fighter model unit tests pass
- [ ] Each of the 14 MoveKinds produces correct `phase`, `moveKind`, `frameIndex` progression
- [ ] Variant cycling works for kicks (3 variants) and punches (4 variants)
- [ ] Auto-turn moves (8, 13, 14) flip `facing` after turn frames
- [ ] Position stays clamped within arena bounds
- [ ] `applyInput` is ignored during an active move
- [ ] `applyHit`, `applyBlock`, `applyDefeat` work from relevant phases

### After Stage 4

- [ ] Game appears in the cabinet menu and loads without errors
- [ ] Fighter renders at the correct position with the idle sprite
- [ ] Arrow keys + spacebar produce all 16 moves with correct animations
- [ ] Walk animation cycles frames based on movement
- [ ] Jump arcs the fighter up and back down
- [ ] Auto-turn moves visually flip the sprite partway through
- [ ] Moves complete and return to idle
- [ ] Input is ignored during active moves (no move-cancelling)
- [ ] Fighter is clamped to arena boundaries

### After Stage 5

- [ ] Game model unit tests pass
- [ ] Phase transitions: round-intro -> fighting -> point-scored -> round-over -> match-over
- [ ] Collision detection identifies overlapping hitbox/bodyBox
- [ ] Passive blocking prevents damage when conditions are met
- [ ] Scoring, round wins, and match wins track correctly
- [ ] Timer counts down and triggers round-over at expiry
- [ ] Draw handling (equal points at timer expiry) works correctly
- [ ] Restart input resets from any phase

### After Stage 6

- [ ] Fighters render with correct sprites for every move and phase
- [ ] Opponent is visibly tinted a different colour
- [ ] Sprite flips correctly for both facing directions
- [ ] Jump height offsets sprites vertically
- [ ] HUD displays scores, round count, and countdown timer
- [ ] Overlay shows appropriate text per game phase
- [ ] Keyboard input controls the player fighter
- [ ] Full loop: round intro -> fight -> score -> round end -> match end -> restart

### After Stage 7

- [ ] AI opponent moves, attacks, and reacts
- [ ] Full game loop works end-to-end with AI
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] Manual play-test: controls feel responsive, AI is a reasonable challenge

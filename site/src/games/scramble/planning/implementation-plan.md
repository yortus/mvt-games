## Plan: Add Scramble Game Module

Add a clone of the classic arcade side-scroller "Scramble" (Konami, 1981) to the MVT game cabinet. The game features forced horizontal scrolling over tile-based terrain, forward-firing bullets and gravity-affected bombs, fuel management, and 3 distinct sections. Built with sprite-based textures following the Galaga/Dig Dug pattern.

**Key design decisions:** tile-unit domain coordinates (view converts via `TILE_SIZE`), terrain modeled as a 2D tile grid generated from compact height-profile arrays, ship constrained to left ~30% of screen with forced scroll.

---

### Stage 1: Data Layer, Core Models & Playable Shell

**Goal:** Ship flies over scrolling terrain, fires bullets, drops gravity-affected bombs. Terrain collision kills ship. No enemies/fuel/scoring yet.

**Steps:**

1. **File scaffold + data layer** - Create `src/games/scramble/` directory (28 new files total). Define all tuning constants in stage-data.ts, 3 section terrain height profiles + spawn lists in section-data.ts, texture registry in textures.ts, and a `scripts/generate-scramble-textures.ts` script
2. **Common types + player input** - `TileKind`, `SpawnKind`, `GamePhase`, direction types in `common.ts`; `PlayerInput` record in `player-input.ts` (pattern: Asteroids `createPlayerInput`)
3. **Terrain model** - `createTerrainModel(sections)` expands height profiles into a flat typed array tile grid; exposes `getTile(col, row)`, `isSolid()`, `getSectionIndex()`; reference: Dig Dug `createFieldModel`
4. **Ship model** - `createShipModel(options)` with `worldCol`/`worldRow` in tile units; worldCol advances at scroll speed + player input, clamped to screen bounds; physics: instant velocity, no drag
5. **Bullet + bomb models** - `BulletModel`: pool of 4, fires rightward at `BULLET_SPEED`, auto-expires. `BombModel`: pool of 2, parabolic arc via `BOMB_GRAVITY * dt` accumulation on vertical velocity (new physics not in other games)
6. **Game model (subset)** - Phase machine (`playing`/`dying`/`game-over`) with GSAP paused timeline; manages `scrollCol` advancement, input routing, bullet/bomb firing, terrain collision for ship and bombs; pattern: Asteroids `createGameModel`
7. **Views** - `terrain-view.ts`: ring-buffer of `VISIBLE_COLS + 2` column containers, recycled as scroll advances (hot-path efficient). `ship-view.ts`, `bullet-view.ts`, `bomb-view.ts`: sprite-based, bindings with `getScreenX()`/`getScreenY()`. `game-view.ts`: composition + keyboard input wiring via `createKeyboardInputView` (`onPrimaryButton` = fire, `onSecondaryButton` = bomb)
8. **Entry + registration** - `createScrambleEntry()` with `load()`/`start()` following Galaga pattern; register in index.ts and main.ts

**Verification:** Ship renders over scrolling terrain; arrow keys move ship; space fires bullets; shift drops gravity-affected bombs; terrain collision kills ship; bombs deactivate on terrain contact; appears in cabinet menu; `npm run build` + `npm run lint` pass.

---

### Stage 2: Enemies, Fuel, Collisions & Scoring

**Goal:** Fully playable game through 3 sections with enemies, fuel management, scoring, HUD, and section progression.

**Steps:**

1. **Enemy models** - `RocketModel` (idle/launching/flying phases, triggers when ship within detect range, flies upward), `UfoModel` (leftward movement + vertical sine oscillation), `FuelTankModel` (stationary, kill yields fuel)
2. **Score model with fuel** - Extends Asteroids `ScoreModel` pattern; `fuel` depletes via `FUEL_DEPLETION_RATE * dt` in `update()`; `addFuel()` caps at 1.0; tracks `sectionIndex` and `loop` count; fuel = 0 triggers ship death
3. **Full game model orchestration** - Spawn cursor system: entity spawns sorted by world column, activated as `scrollCol + VISIBLE_COLS + SPAWN_AHEAD` passes their column. Rocket launch trigger based on proximity. Full collision detection (6 checks: ship-terrain, ship-rockets, ship-UFOs, bullets-enemies, bombs-enemies/terrain, fuel-death). Section progression: `scrollCol` past section end triggers `'section-clear'` phase, then next section. After section 3: increment loop, increase scroll speed, restart section 1. Base target in section 3 must be bombed to complete
4. **Enemy views** - `rocket-view.ts`, `ufo-view.ts`, `fuel-tank-view.ts`: sprite-based with bindings, `watch()` on phase/alive for sprite changes
5. **HUD view** - Score (left), lives icons (center), fuel bar (right, color-coded green/yellow/red), section indicator; pattern: Asteroids `createHudView`
6. **Expand game-view.ts** - Dynamic entity view lists (rockets, UFOs, fuel tanks) using `watch()` on list lengths; add HUD at `y = PLAY_HEIGHT`; overlay view for "SECTION CLEAR" / "GAME OVER"

**Verification:** Rockets launch and can be destroyed; UFOs fly and can be shot; fuel tanks refill fuel gauge; fuel depletes to 0 = death; scoring correct per enemy type; 3 lives with game over; section progression 1 → 2 → 3 → loop at higher speed; base target required to complete loop; HUD displays all info; all models have unit tests.

---

### Stage 3: Polish, Testing & Stories

**Goal:** Production-quality - tested, story-booked, tuned, polished.

**Steps:**

1. **Unit tests for all models** - 10 test files covering: terrain tile expansion + boundaries, ship movement + clamping + scroll sync, bullet/bomb lifecycle + physics, rocket phase transitions, UFO oscillation, fuel depletion/refill, score tracking, game model phase machine + collisions + spawn cursor + section progression + loop speed increase + restart
2. **Storybook stories for all views** - 8 story files with mock bindings showing key states (terrain at various scroll positions, ship alive/dead, rocket phases, HUD with various fuel/score levels, etc.)
3. **Visual polish** - Explosion sprite animation on death/kill, terrain color theming per section (brown/green, grey/blue, dark/red), section title announcement overlay, screen flash on death
4. **Edge cases** - Safe respawn position (not inside terrain), scroll past terrain end handled gracefully, entity count caps, difficulty tuning pass

**Verification:** `npx vitest run` passes all tests; Storybook stories render; full playthrough works smoothly; `npm run build` + `npm run lint` clean; maintains 60fps with full entities.

---

### Relevant files

**Modify:** index.ts, main.ts

**Reference patterns from:**
- game-model.ts - Phase machine, GSAP timeline, entity pools, collision detection
- galaga-entry.ts - Entry with texture `load()` + `start()`
- game-model.ts - Wave/stage progression, enemy spawn management
- bullet-model.ts - Bullet pool fire/deactivate lifecycle
- game-view.ts - View composition, dynamic entity lists via `watch()`
- field-model.ts - Tile grid model (closest terrain analogue)
- keyboard-input-view.ts - Input wiring (primary = fire, secondary = bomb)

**28 new files** across `src/games/scramble/` (data: 4, models: 10, views: 9, entry: 2, barrel: 3) plus `scripts/generate-scramble-textures.ts`

---

### Further Considerations

1. **Destructible terrain** - Classic Scramble doesn't have it, but bombs modifying terrain tiles could add depth. Recommend: skip for MVP, consider as optional stage 3 enhancement.
2. **Enemy bullets** - Some classic Scramble enemies fire back. Recommend: add as stage 2 extension using a separate `enemyBullets` pool sharing `BulletModel` (leftward-traveling).
3. **Sprite art source** - The texture generation script needs a master image. Recommend: start with placeholder colored rectangles in the generate script, upgrade to proper pixel art later.
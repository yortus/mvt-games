# Proposal: `SlotList<T>`

> A model-side collection that gives every item a stable slot for its lifetime
> and a liveness flag, and holds a removed item's slot for a configurable delay
> before reusing it. Item identity is object identity, so references held
> elsewhere in the model stay correct without handles or generation counters.
> Designed to be projected directly by an index-addressed `<List>`.

**Status:** core collection **implemented** in `src/common/slot-list/`
(`createSlotList`, `Slot<T>`, `SlotList<T>`, `SlotListOptions<T>`), with full unit
tests. Deviations from this proposal as written:

- Lives in `#common` at `src/common/slot-list/`, not a top-level `#slot-list`
  module (open question 1, resolved).
- `reuseDelayMs` shipped as `releaseDelayMs`; the whole removal lifecycle is
  named off `remove` / `release` (live -> pending release -> released) to keep
  the vocabulary minimal.
- `insert` scans from a cached lowest-free-index hint (amortised ~O(1), O(n)
  worst case); the bitmap in section 7 remains deferred.

Still pending: the `<List>` projection (section 5.3, needs 004). `asteroids`
(step 3), `scramble` (step 4), and a visual demo (`src/demos/ordered-list/`) are
done.

**Related:** [the `<List>` proposal](./004-list-proposal.md) for the view-side
component. [the patterns guide](./006-list-patterns.md) for how the two
compose. [the plugin rework plan](./001-mvt-plugin-rework-plan.md) for the refresh
pass whose `SKIP_DESCENDANTS` sentinel makes hidden slots free.

---

## 1. Summary

`SlotList<T>` is a collection of live items where:

- Every item occupies a **stable slot** for its whole lifetime.
- Slots are addressed by index, and indices are `[0, slotCount)`.
- A removed item's slot is **held for `reuseDelayMs`** before it may be reused,
  so exit effects have something to render.
- Items are **plain values wrapped in a `Slot<T>`**, so `T` is unconstrained
  and identity lives in the wrapper.
- `slotCount` grows on demand and shrinks automatically when the tail frees.

| | Hand-rolled pool today | `SlotList<T>` |
| --- | --- | --- |
| Slot allocation | manual scan for a free index | `insert()` |
| Liveness | per-model `isActive` convention | `slot.isLive`, uniform |
| Cross-references | index, unsafe once reused | slot reference, safe |
| Exit effects | nothing holds the slot | `reuseDelayMs` |
| Bounds | always fixed | optional `maxSlots` |
| Item type | must carry the convention | unconstrained |

It is **not** a general-purpose list. It has no ordering and no addressed
insertion. Section 5 covers what it composes with to cover those.

---

## 2. Motivation

### 2.1 The repo already hand-rolls this, six times in one file

`scramble/views/game-view.ts` builds fixed pools for bullets, bombs, rockets,
UFOs, fuel tanks and explosions. Each is a fixed-length model array, a per-item
`isActive` flag, a view pool bound by index, and a hand-written liveness gate:

```ts
// scramble/views/bullet-view.ts
function refresh(): void {
    const active = bindings.isActive();
    view.visible = active;
    if (!active) return;

    view.position.set(bindings.getScreenX(), bindings.getScreenY());
}
```

The pattern is correct and duplicated. Every model re-implements slot
allocation, every view re-implements the gate, and nothing names the idea.

### 2.2 Index-as-identity breaks for references held elsewhere

A pooled index identifies an item only while that item is alive. Once the slot
is reused, the index silently means something else:

```ts
// Wrong: slot 7 may hold a different creep than the one this tower targeted.
if (creeps[tower.targetIndex].isActive) fireAt(tower.targetIndex);
```

This is the ABA problem. `isActive` answers "is this slot occupied", not "is
this still my item", and those diverge exactly when a slot is recycled.

A reuse delay narrows the window: an observer that revalidates every frame sees
the slot held before it can be reused. That covers most model logic, because
most model logic runs every frame. It does not cover observers slower than the
delay, work deferred across frames, or a frame hitch longer than the delay,
which is a correctness bug that only appears under frame drops.

### 2.3 A wrapper makes identity free and leaves `T` alone

Each `insert()` allocates a fresh `Slot<T>` that holds the value. The wrapper
is unique for that item's lifetime and is never reused, so holding a reference
to it is unambiguous:

```ts
// Correct at any poll rate, across frame hitches, for deferred work.
if (!tower.target.isLive) retarget(tower);
```

The runtime supplies the generation counter through object identity, and it
never wraps. No handle packing, no generation arrays, no stale-handle lookup.

Putting identity in the wrapper rather than in `T` buys three things at once:

- **`T` is unconstrained.** No injected `isLive` or `slot` fields, no
  `T extends` clause, no convention imposed on domain types.
- **One source of truth.** The list owns the wrapper and the wrapper owns the
  liveness fields. There is no second copy on the value to drift.
- **Payloads can be pooled independently.** The wrapper must be fresh; the
  value need not be. A model that wants zero allocation returns values to its
  own pool through `onRelease`, and identity stays sound because it never lived
  in the value.

---

## 3. Interface

### 3.1 `Slot<T>`

```ts
/**
 * A slot's identity is its own object identity, unique for the lifetime of the
 * item it holds. Three plain fields, no getters.
 *
 *   isLive           -> in the live set
 *   !isLive          -> removed, slot still held through its reuse delay
 *   at(index) empty  -> slot freed and available
 */
export interface Slot<T> {
    readonly isLive: boolean;
    readonly index: number;
    readonly value: T;
}
```

### 3.2 `SlotList<T>`

```ts
export interface SlotList<T> {
    /** Slots allocated. Indices are [0, slotCount). Shrinks when the tail frees. */
    readonly slotCount: number;

    /** Items in the live set. */
    readonly liveCount: number;

    /** True when no slot is available, so `insert` would throw. */
    readonly isFull: boolean;

    at(index: number): Slot<T> | undefined;

    /**
     * Places a value in a free slot and returns it. The list chooses the slot.
     * Throws when `isFull`; check it first.
     */
    insert(value: T): Slot<T>;

    /**
     * Removes from the live set. The slot is held for `reuseDelayMs` before it
     * frees, so exit effects have something to render.
     */
    remove(slot: Slot<T>, reuseDelayMs?: number): void;

    clear(): void;

    /** Advances the reuse-delay clock. O(1). */
    update(deltaMs: number): void;
}
```

### 3.3 Options

```ts
export interface SlotListOptions<T> {
    /** A domain bound, not a performance knob. Omit unless the domain has one. */
    maxSlots?: number;

    /** How long a removed item's slot is held before it may be reused. */
    reuseDelayMs?: number;

    /** The list is finished with this value. Return it to a pool, free resources. */
    onRelease?: (value: T) => void;
}

export function createSlotList<T>(options?: SlotListOptions<T>): SlotList<T>;
```

### 3.4 Semantics - settled, do not revisit

1. A live item's slot never changes. The list never moves a live item.
2. `remove` is two-phase. It leaves the live set immediately, and the slot is
   held through `reuseDelayMs` so the view can still read it. With a zero delay
   both happen in the same call.
3. **`insert` throws when full.** Returning `undefined` made exhaustion a
   silent failure that reads as success. Callers test `isFull` first, which
   makes "the pool is exhausted" an explicit branch rather than an accident.
4. `insert` chooses the slot. Callers cannot place a value at a given index.
5. Allocation takes the **lowest free index**. This keeps the live region dense
   and makes automatic trimming well behaved.
6. Trimming is automatic. When the last slot frees, the list walks back over
   any free slots below it and lowers `slotCount`. Amortised O(1), one
   comparison when it does not apply.
7. `slotCount` is therefore **not monotonic**.
8. `update(deltaMs)` is O(1). It advances one clock and iterates nothing.
9. The list has no ordering. Slot order is allocation order.

---

## 4. Examples

### 4.1 Bullets: bounded, payloads pooled, brief hold

```ts
const bulletValues = createObjectPool(() => ({ x: 0, y: 0, vx: 0, vy: 0 }));

const bullets = createSlotList<Bullet>({
    maxSlots: 256,
    reuseDelayMs: 180,
    onRelease: (b) => bulletValues.give(b),
});

function fire(x: number, y: number, angle: number): void {
    // Explicit branch: exhaustion is a real condition, not an error.
    if (bullets.isFull) return;

    const b = bulletValues.take();
    b.x = x;
    b.y = y;
    b.vx = Math.cos(angle) * BULLET_SPEED;
    b.vy = Math.sin(angle) * BULLET_SPEED;

    bullets.insert(b);
}

function update(deltaMs: number): void {
    bullets.update(deltaMs);

    const dt = deltaMs / 1000;
    for (let i = 0; i < bullets.slotCount; i++) {
        const slot = bullets.at(i);
        // isLive, not merely present: a removed bullet must not collide.
        if (slot === undefined || !slot.isLive) continue;

        const b = slot.value;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (isOffScreen(b)) bullets.remove(slot);
    }
}
```

```tsx
<List length={() => bullets.slotCount} item={(i) => bullets.at(i)}>
    {(slot) => (
        <sprite
            texture={bulletTexture}
            anchor={0.5}
            x={() => slot().value.x}
            y={() => slot().value.y}
        />
    )}
</List>
```

No guard prop, and no non-null assertion. `<List>` hides slots whose `item(i)`
is `undefined`, and an empty slot returns `SKIP_DESCENDANTS`, so the refresh
pass skips its subtree and these bindings demonstrably do not run while the slot
is empty.

### 4.2 Creeps: growable, fresh values, referenced by towers

```ts
const creeps = createSlotList<Creep>({ reuseDelayMs: 250 });

function spawn(kind: CreepKind): Slot<Creep> {
    // Caller-supplied, so kinds can differ. Nothing is pooled, so identity is
    // unique for this creep's lifetime at both levels.
    return creeps.insert({ kind, hp: HP[kind], distance: 0 });
}
```

The payoff is references that outlive their target:

```ts
interface Tower {
    target: Slot<Creep> | undefined;
}

function retarget(tower: Tower): void {
    // Correct whatever the poll rate, because `target` is the slot itself.
    if (tower.target !== undefined && tower.target.isLive) return;
    tower.target = findNearest(tower);
}
```

```tsx
<List length={() => creeps.slotCount} item={(i) => creeps.at(i)}>
    {(slot) => (
        <container
            x={() => pathX(slot().value.distance)}
            y={() => pathY(slot().value.distance)}
        >
            <Switch
                kind={() => slot().value.kind}
                cases={{
                    grunt: () => <sprite texture={gruntTexture} anchor={0.5} />,
                    runner: () => <sprite texture={runnerTexture} anchor={0.5} />,
                    brute: () => <sprite texture={bruteTexture} anchor={0.5} />,
                }}
            />
        </container>
    )}
</List>
```

### 4.3 Damage numbers: who owns the exit effect

The list holds the slot; it does not describe the effect. Whoever owns the
effect owns its clock. Here the model does, which keeps the view stateless:

```ts
const numbers = createSlotList<DamageNumber>({ maxSlots: 64, reuseDelayMs: FLOAT_MS });

function showDamage(amount: number, x: number, y: number): void {
    if (numbers.isFull) return;
    const slot = numbers.insert({ amount, x, y, ageMs: 0 });
    numbers.remove(slot);            // born removed: its whole life is the effect
}

function update(deltaMs: number): void {
    numbers.update(deltaMs);
    for (let i = 0; i < numbers.slotCount; i++) {
        const slot = numbers.at(i);
        if (slot !== undefined) slot.value.ageMs += deltaMs;
    }
}
```

```tsx
<bitmapText
    text={() => `${slot().value.amount}`}
    x={() => slot().value.x}
    y={() => slot().value.y - 40 * (slot().value.ageMs / FLOAT_MS)}
    alpha={() => 1 - slot().value.ageMs / FLOAT_MS}
/>
```

A view model could own the clock instead, watching `isLive` go false. Either
way the constraint in section 9 applies: **`reuseDelayMs` must be at least as
long as the effect**, or the slot frees mid-animation.

---

## 5. Collaborations

`SlotList` is deliberately narrow. Three things sit next to it.

### 5.1 Plain arrays, for collections whose contents are permanent

The question is not whether the collection is fixed-size. It is:

> Do items come and go?

If they do not, a plain array is better at any size. A tilemap, a Tetris board,
a hotbar, an inventory grid and a row of parallax layers all hold their
contents for the life of the screen; what changes is what each cell *contains*,
which is plain assignment:

```ts
const cells: (Item | undefined)[] = new Array(ROWS * COLS);
cells[to] = cells[from];
cells[from] = undefined;
```

Those are also the collections where **the index is the domain meaning**, and
`insert` chooses the slot, so `SlotList` could not express them anyway. This is
not a gap to fill later. A grid and a collection are different things, and
conflating them is how `SlotList` acquires an addressed insert and stops being
simple.

A ring is the same story: a fixed array plus a write index. Slot `i` holds one
sample for `N` frames and its age is `(write - i + N) % N`, which the view reads
directly. Trails and chat logs want that, not this.

### 5.2 `OrderedSlotList`, for logical ordering

`SlotList` has no ordering, by design. Where a logical order is needed, use
`OrderedSlotList<T>` (implemented in `src/common/slot-list/`), which composes a
`SlotList` internally and layers an order on top:

```ts
const hand = createOrderedSlotList<Card>({ maxSlots: 12 });

hand.append(card);                 // adds at the end of the order
hand.insertAt(ordinal, card);      // adds at a position, shifting the rest up
hand.move(from, to);
hand.sort(byValue);
hand.remove(slot);                 // detaches now; slot lingers per releaseDelayMs
hand.atOrdinal(ordinal): OrderedSlot<Card> | undefined;
hand.atSlotIndex(index): OrderedSlot<Card> | undefined;   // for <List>
```

Every live item has an `ordinal` in `[0, liveCount)`, written directly onto the
slot: `OrderedSlot<T> extends Slot<T>` adds a `readonly ordinal`. Storage slots
keep their stable `index` for identity and `<List>` projection, so the two index
spaces stay distinct - storage index for identity, ordinal for layout - with one
facade rather than two objects the caller must keep in sync.

The two index spaces living in one container is what made earlier versions of
this design unwieldy - but only because ordering was pushed *into* `SlotList`.
Here `SlotList` stays single-index and untouched; the second index space lives
in the composing `OrderedSlotList`, which owns both sides so they cannot drift.

`remove` detaches the item from the order at once (survivors renumber to close
the gap) while its slot lingers pending release, so the view can still animate
the exit; a detached slot's `ordinal` is -1.

Ordering and **paint order** are separate concerns. Because `<List>` projects by
stable storage index, rows that do not overlap need only
`y={() => slot().ordinal * ROW_H}` and ease toward it, so the reorder animates
for free. Only genuinely overlapping content, such as a fanned card hand, also
needs `zIndex` with `sortableChildren` on the list container.

### 5.3 `<List>`, for projection

```tsx
<List length={() => list.slotCount} item={(i) => list.at(i)}>
```

That is the whole integration. `<List>` owns slot visibility: it hides any slot
where `item(i)` is `undefined` or whose index is past `length`, and an empty
slot returns `SKIP_DESCENDANTS` so the refresh pass skips its subtree. Three
consequences:

- **No guard prop and no `<Show>`** in the slot body. The author cannot forget
  a guard, because there is no guard to write.
- **The slot accessor is non-optional.** Bindings only run while the slot is
  occupied, so `slot().value` needs no assertion.
- **A hidden slot costs one presence check**, not one getter per binding.

This depends on `onRefresh` and the `SKIP_DESCENDANTS` sentinel in
[the plugin rework plan](./001-mvt-plugin-rework-plan.md) section 3.5. Without it,
hidden subtrees still refresh and the guard has to come back.

### 5.4 Parallel data and view models

`slot.index` is stable for an item's lifetime and readable from the slot, so
anything parallel indexes by it with no lookup, no join and no id:

```ts
// Health bars, cosmetic state, spatial buckets: all indexed by slot index.
const flash: number[] = [];
```

Per-item view state becomes a dense array plus one reference comparison for
tenant change:

```ts
const c = cosmetics[i];
if (c.owner !== slot) {
    resetCosmetic(c);
    c.owner = slot;
}
```

No `Map`, no dense integer ids, no generations, no republication step. That
removes two standing complaints about the index-addressed `<List>`: ids leaking
into domain design, and view models translating from item keys to slot indices.

---

## 6. Scenario analysis

Against the 37-scenario survey, with plain arrays for permanent collections and
`Order` for ordering, every scenario has a workable solution in three tiers.

**Tier 1, plain fixed array (10).** The index is the meaning, either a position
or an age. Tilemap, parallax layers, Tetris board, hotbar, settings rows, trail
(ring), virtualised rows, grid resize, kill feed (ring), inventory grid.

**Tier 2, `SlotList` alone (20).** The simulation-shaped half, and the case this
proposal exists for. ECS sprite pool, dialogue buttons, bullets, particles,
explosions, replay ghosts, towers, creeps, loot drops, enemy waves, health bars,
minimap blips, selection rings, nav overlay, filtered results, achievements,
autocomplete, damage numbers, enter/exit transitions, animated enemies.

**Tier 3, plus composition (7).** Leaderboard, sortable table, toast stack, card
hand, kanban and form field array need `Order`. Remote players needs a
`Map<networkId, Slot<Player>>` alongside, for packet routing and reconnection,
cleaned on release.

Two observations worth recording. All seven tier-3 scenarios are UI-shaped and
the repo's seven games contain none of them, so `Order` is a
build-it-when-a-screen-needs-it item. And `clear()` followed by refill gives
slot order equal to insertion order, which is why the re-derived lists sit in
tier 2 rather than tier 3.

---

## 7. Performance

### 7.1 What an external value pool saves

The wrapper must be fresh per item. The value need not be, and `onRelease`
makes pooling it a model-side choice. Measured on Node 22, median of five
trials, small objects with six fields:

| Inserts per frame | Pooled value | Fresh value | Ratio | Fresh as share of 16.67 ms |
| --- | --- | --- | --- | --- |
| 50 | 1.0 us | 1.9 us | 1.9x | 0.01% |
| 200 | 0.6 us | 2.4 us | 3.8x | 0.01% |
| 1,000 | 3.0 us | 9.0 us | 3.0x | 0.05% |
| 5,000 | 36 us | 70 us | 1.9x | 0.42% |
| 20,000 | 148 us | 410 us | 2.8x | 2.46% |

Consistently 2 to 3 times, and consistently irrelevant. At 20,000 inserts per
frame, which no game does, fresh values cost 2.5% of a frame. **Pool values
only when a profile says to**, and note that the wrapper allocation remains
either way.

**Unmeasured, and the honest caveat:** this is allocation *throughput*. GC
*pause distribution* is what affects frame timing and is not captured here.
Short-lived objects die cheaply in the nursery, but a value still referenced by
a tower is promoted to old space, which is exactly the retention case this
design creates. A pause histogram should come before recommending either
policy for very high churn.

### 7.2 Per-frame cost

| Operation | Cost |
| --- | --- |
| `update(deltaMs)` | O(1), one addition |
| `insert` | O(1) amortised, lowest free index from a bitmap or free list |
| `remove` | O(1) |
| Slot freeing and trim | O(1) amortised |
| `at`, `isFull`, field reads | O(1), plain property loads, no getters |
| `<List>` per frame | one `item(i)` call and one visibility write per slot |
| A hidden slot's view cost | one visibility check, subtree pruned |

`Slot<T>` is three plain fields, so hot-loop reads are direct property loads and
slot allocation needs no closure.

### 7.3 Iteration

Simulation loops walk `[0, slotCount)` and skip empty or non-live slots.
Automatic trimming keeps the tail tight; interior holes remain, and allocation
from the lowest free index keeps them rare.

A liveness bitmap with `nextLive(from)` would skip dead runs 32 or 1024 indices
at a time. Deliberately **not** in this proposal: with the refresh pass pruning
hidden subtrees and simulation loops doing one branch per hole, it is a
micro-optimisation. Add it when a profile asks.

---

## 8. Advantages

1. **References are safe.** `slot.isLive` is correct at any poll rate, across
   frame hitches, for deferred work and for periodic observers. No handles, no
   generations, no packing.
2. **References are typed.** Holding a `Slot<Creep>` rather than a `number`
   removes a class of confusion that branding only papers over.
3. **`T` is unconstrained.** No injected fields, no `extends` clause, no
   convention imposed on domain types.
4. **One source of truth.** Liveness lives in the wrapper the list owns, with
   no second copy to drift.
5. **Values can be pooled without losing identity**, because identity was never
   in the value.
6. **Heterogeneous items work.** `insert(value)` takes a caller-constructed
   object, so a union is fine and `<Switch>` composes over it.
7. **Slots are valid map keys.** Unique identity per lifetime makes
   `Map<Slot<T>, State>` sound.
8. **Parallel data indexes by `slot.index`** with no lookup, no join and no id.
9. **Exhaustion is explicit.** `isFull` plus a throwing `insert` turns a silent
   failure into a branch the author writes deliberately.
10. **It names a pattern the repo already has**, six times in one file, and
    removes the duplication.

---

## 9. Tradeoffs and accepted limitations

**`reuseDelayMs` must be at least as long as the longest exit effect** on that
list, or the slot frees mid-animation. This coupling is real and unenforced.
An earlier draft exposed a normalised progress value, which hid the constraint
rather than solving it; stating it plainly is the honest option.

**Pooled values make a stale read wrong rather than merely stale.** With fresh
values, reading `staleSlot.value` gives the dead item's own data. With pooled
values it gives a live object belonging to a different item. The mandatory
`isLive` check catches it either way, but the failure is worse when pooling.

**Stale slot references retain memory.** A dead slot referenced by a forgotten
holder is retained along with its value and everything that points at. An index
retained nothing. Holders should clear on `!isLive`, which they would do
anyway, but that is another unenforced rule and the failure is a slow leak.

**`slotCount` is not monotonic**, so a list hovering at its boundary will shrink
and regrow. Lowest-free allocation makes that rare. If it bites, `<List>` can
keep its own high-water mark of slot views independently, which is a view-side
policy and should not leak into the data structure.

**Serialisation is unsolved.** Object references do not survive a save file. If
saves or replays matter, something still needs stable ids, and it is not this.

**No ordering and no addressed insertion**, by design. Section 5 covers what
composes with it. Both are deliberate and both were the source of the
complexity in earlier versions of this design.

**A forgotten `update(deltaMs)` fails silently and late.** Slots never free, the
list fills, and `insert` starts throwing minutes later with nothing pointing at
the cause. A dev-mode assertion when `isFull` becomes true while held slots
exist and `update` has never been called is the mitigation.

---

## 10. Adoption

1. **Land `onRefresh` with `SKIP_DESCENDANTS`** in the plugin rework - **done**
   (see proposal 001). Section 5.3 depends on it, and it is worth doing on its
   own merits.
2. **Implement `SlotList`** - **done**, in `src/common/slot-list/` with unit
   tests and no Pixi dependency.
3. **Convert one game** - **done**. `asteroids` now stores its variable-length
   asteroid collection in a `SlotList`; the view grows a pool by storage index
   and redraws a slot only when its tenant changes, instead of destroying and
   rebuilding every view on a length change. Its fixed bullet pool was left as-is.
4. **Convert `scramble`** - **done**. Six hand-rolled pools became six `SlotList`
   declarations; the base-fuel-tank index-as-identity became a held `Slot`
   reference whose `isLive` says whether the base stands; explosions use
   `releaseDelayMs` (born removed) for their fade. The entity models dropped
   their pool-era lifecycle (`isActive`, `isAlive`, `activate`, `kill`, ...) and
   take their start state as factory options, and the entity views bind a single
   `isPresent`.
5. **`Order` only when a screen needs it** - **done** as `OrderedSlotList` in
   `src/common/slot-list/` with unit tests, plus a visual demo in
   `src/demos/ordered-list/` (reorder slide + exit fade). No game needs it yet.
6. **Document in `docs/building-with-mvt/simulating-the-world/`** - pending,
   since this is a model-side structure, with a cross-link from the list
   patterns guide.

---

## 11. Open questions

1. **Where does it live?** *Resolved: folded into `#common` at
   `src/common/slot-list/`*, reached through the existing `#common` barrel,
   rather than a top-level `#slot-list` module.
2. **Can `update(deltaMs)` be skipped when the release delay is zero everywhere?**
   *Resolved: no.* `update` is required unconditionally - one fewer rule, at the
   cost of one call per list per frame, and it is O(1) when nothing is due.
3. **Should `clear()` respect release delays or release immediately?**
   *Resolved: immediate*, which is what a level transition wants. A fading
   variant could come later if a screen needs it.
4. **Should ordering maintain the position in a side table or write it onto the slot?**
   *Resolved: on the slot.* `OrderedSlot<T> extends Slot<T>` with a `readonly
   ordinal` (renamed from `rank`, which overloaded scoring/matrix meanings). The
   view reads `slot.ordinal` directly - no accessor threaded into the binding -
   and it drops the `ordinalOf` method a side table would have needed. The cost
   is an inert `ordinal` on every `SlotList` record (public `Slot<T>` still
   hides it) and a shared internal record between the two co-located factories.

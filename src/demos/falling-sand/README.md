# Falling Sand

An aquarium of sand, water and walls. Tap, hold and drag in the tank to pour
the selected material, draw walls or erase. Flip turns the tank upside down;
Reset restores the opening scene.

It is also a stress test for the MVT game loop. Every grain is its own item
in the model and its own sprite in the view, so pouring more grains makes
every frame do more work. The panel under the tank shows the grain count,
how many grains are moving, and frame timing: frames per second, CPU and GPU
milliseconds per frame, and `RPF`, the prop reads per frame (about four
per grain). `npm run bench -- falling-sand-scaling` measures the same thing
headless, from 1,000 to 20,000 grains; the demo as it ships is in the
`games-and-demos` suite.

## What it shows

**The simulation pays for moving grains; the refresh pass pays for all of
them.** A grain that cannot move for a couple of steps falls asleep, and the
simulation stops visiting it until a neighbouring cell empties. A settled
pile of thousands of grains costs the model almost nothing. The view is
different. Each grain's sprite has three bindings:

```tsx
<List items={model.grains}>
    {(grain, id) => (
        <sprite
            texture={Texture.WHITE}
            width={CELL_SIZE}
            height={CELL_SIZE}
            x={() => grain().col * CELL_SIZE}
            y={() => grain().row * CELL_SIZE}
            tint={() => pickGrainTint(grain().kind, id)}
        />
    )}
</List>
```

The refresh pass runs them for every grain, every frame, asleep or not. Pour
until the tank is deep, then compare the grain count with the moving count
and watch the CPU time follow the first. Flip the tank to wake every grain at
once.

All the sprites share one texture and differ only by tint, so Pixi draws the
whole tank in a few batches. The limit you reach is CPU time, not GPU time.

**Three things that cost more than the bindings did.** Measured with 10,000
grains, before each fix:

- **Text beside the grains rebuilt their batches.** Pixi rebuilds a render
  group's draw batches whenever text or graphics in it change, and the
  moving count changes most frames. With everything in one group, that
  rebuilt all 10,000 sprites' batches every frame: about 5 ms. The tank is
  now its own render group (`isRenderGroup`), and Pixi's render at rest
  dropped to about 0.5 ms.
- **`tint` parsed its colour on every write.** Pixi's setter does, even for
  an unchanged value, so the JSX runtime now writes `tint` only when it
  changes, as it does `text` and `texture`. The refresh pass dropped from
  about 2.2 ms to 0.9 ms.
- **`toLocaleString` built a number formatter on every call**, tens of
  microseconds each time. The counts now share one `Intl.NumberFormat`.

**An index-addressed list with a pool behind it.** The model keeps one grain
record per cell, allocated up front, and hands out ids from a free list.
`model.grains` is shaped like a read-only array indexed by id, which `<List>`
projects directly: a grain keeps its id, and so its sprite, for its whole
life, and a removed grain's slot hides and skips its bindings. Adding and
removing grains allocates nothing. When the highest ids free up (after Clear,
say), `<List>` detaches their now-unused slots, so a tank that once held
20,000 grains does not keep paying to refresh them.

**A fixed timestep.** The model advances in steps of 1/60 s, however often
`update()` is called, and runs at most four steps per update so a stalled
frame does not snowball. Pouring happens inside the step too, so the amount
poured does not depend on the frame rate. A seeded random number generator
makes every run repeatable, which the tests rely on.

**Input in domain units.** The tank converts pointer positions to cells,
through the tank's rotation, before calling `startPour`, `movePour` and
`endPour`. The model never sees a pixel.

**The flip is split between model and view.** The model owns what the flip
means: a phase, and progress from 0 to 1 over half a second, during which the
grains hold still. When it completes, the model moves every grain to the
opposite cell. The view owns how it looks: it turns the progress into an
eased angle, and shrinks the tank as it turns so its corners stay inside its
upright outline. The flip's last frame shows the tank all but upside down,
and the next shows the grains upside down in an upright tank, so the picture
does not jump.

## Rules

- **Sand** falls, slides diagonally down off anything below it, and sinks
  through water by swapping places with it.
- **Water** falls, slides diagonally, and flows sideways up to four cells per
  step, keeping its direction until blocked, so a surface levels out.
- **Walls** never move and are never visited.
- Falling grains speed up each step, checking every cell they pass so they
  never go through anything.

## Files

| File | Purpose |
|------|---------|
| [`grain-grid.ts`](./grain-grid.ts) | The grid of grains, their pool, sleeping and waking, and the rules. Not a model: it has no notion of time, and the demo model steps it. One `step()` is one tick |
| [`demo-model.ts`](./demo-model.ts) | The fixed timestep, pouring, tools, flip and reset |
| [`starting-scene.ts`](./starting-scene.ts) | The opening scene |
| [`random.ts`](./random.ts) | Seeded random numbers |
| [`demo-view.tsx`](./demo-view.tsx) | The whole demo: tank above, toolbar below |
| [`tank-view.tsx`](./tank-view.tsx) | Grains, glass, pointer input, brush ring and flip rotation |
| [`toolbar-view.tsx`](./toolbar-view.tsx) | Tool palette, Flip, Reset, Clear, counts and frame timing |
| [`grain-colors.ts`](./grain-colors.ts) | Colours by kind, with a stable shade per grain |
| [`model-constants.ts`](./model-constants.ts) | The tank's size in cells, the timestep, pouring and flipping, and the rules grains move by |
| [`view-constants.ts`](./view-constants.ts) | Sizes and positions in pixels; `CELL_SIZE` sets how large each grain is drawn |
| [`falling-sand-entry.ts`](./falling-sand-entry.ts) | Demo entry point |

The frame timing comes from `createFrameStats` and `createPerfmonView` in
[`src/common/`](../../common/index.ts), which any demo or game can use.

# Proposal: Boids that scale

> The boids model compares every boid with every other, every step, so its
> cost grows with the square of the flock: 0.4 ms per frame at 200 boids,
> 171 ms at 5000. Two exact changes, a dot-product vision test and a uniform
> grid, make it 2.7-3.8x faster with no change in behaviour, but cannot make
> it linear: in a fixed arena, each boid's real neighbours grow with the
> flock. Only bounding how many neighbours a boid considers does that (67x
> faster at 5000), and it changes how the flock behaves. This proposal
> recommends the two exact changes, and offering the neighbour limit as an
> opt-in setting.

**Status:** proposed. Spiked in a session and measured; the spike was not
kept. Nothing is implemented.

**Written:** 2026-09-26. Measured on an Intel Core Ultra 9 185H, Node.js
22.11, headless, timing the model's `update` alone.

**Related:** [`flock-model.ts`](../../packages/website/src/demos/boids/flock-model.ts),
[`boids-view.ts`](../../packages/website/src/demos/boids/boids-view.ts),
[017](../tasks/backlog/017-misc-loose-ends.md) (the boids allocation fix),
[Performance Measurements](../../packages/docs/building-with-mvt/performance/measurements.md).

---

## 1. Summary

| # | Change | Recommendation | Effect |
| --- | --- | --- | --- |
| 3 | Test the vision cone with a dot product, not `atan2` | Implement | Exact. 1.5-1.8x faster |
| 4 | A uniform grid, rebuilt each step, so a boid only checks nearby boids | Implement | Exact. 2.7x faster at 200 boids, 3.8x at 5000. Still superlinear |
| 5 | A limit on neighbours considered, nearest first | Offer as an opt-in "Max neighbours" slider, off by default | Close to linear: 67x faster at 5000. Changes the flock's behaviour |
| 6 | Trees, sweeps, symmetry, data layout, aggregates, workers | Not recommended now | See section 6 |

At the demo's default of 200 boids, sections 3 and 4 together take the model
from 0.39 to about 0.15 ms per frame.

---

## 2. Why the cost is superlinear, and what can fix it

Each step, every boid measures its distance to every other boid:
`n(n - 1)` checks. For each one inside the perception radius it also calls
`Math.atan2` to test the vision cone.

A spatial index removes the checks against boids that are far away. It does
not remove the checks against real neighbours, and **in a fixed arena the
number of real neighbours grows with the flock**, because the density does.
Boids within the default perception radius (16 m), on average, after the
flock settles:

| Boids | 200 | 500 | 1000 | 2000 | 5000 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Neighbours in radius | 33 | 89 | 225 | 309 | 629 |

So the work that any exact method must do is `n` times a number that grows
with `n`. There are two ways out, and only two: let the arena grow with the
flock (a different demo), or bound how many neighbours a boid considers
(section 5). **Settled; do not reopen without new information:** no spatial
index makes the exact model linear in a fixed arena.

---

## 3. Vision cone by dot product

Today each in-radius pair computes `atan2(dy, dx)`, subtracts the heading and
wraps the angle into range. Instead, compute the boid's unit heading
`(hx, hy)` once per boid, and `cos(visionAngle / 2)` once per step. A
neighbour at distance `dist` is inside the cone when

```ts
dx * hx + dy * hy >= cosHalfVision * dist
```

which holds for cones wider than 180 degrees too (the default is 229), where
the cosine is negative. `dist` needs a square root, but separation needs it
anyway. Measured behaviour is identical (section 7.2).

---

## 4. Uniform grid

**Layout.** Square cells half the perception radius wide. A boid checks the
5 x 5 block of cells around its own, a square 2.5 radii wide; cells a full
radius wide would need a 3 x 3 block, 3 radii wide, about 30% more
candidates. Measured: half-radius cells were 20-40% faster at 1000 boids and
above, and no slower at 200.

**Build.** Once per step, a counting sort of boid indices by cell into
preallocated `Int32Array`s: count boids per cell, prefix-sum the counts into
each cell's start, then place each index. That is `O(n + cells)` and
allocates nothing per frame; the arrays grow only when the flock or the
number of cells does. From the spike:

```ts
cellStart.fill(0, 0, cells + 1);
for (let i = 0; i < count; i++) {
    const c = cellIndexOf(boids[i].position);
    boidCell[i] = c;
    cellStart[c + 1]++;
}
for (let c = 0; c < cells; c++) cellStart[c + 1] += cellStart[c];
for (let c = 0; c < cells; c++) cellFill[c] = cellStart[c];
for (let i = 0; i < count; i++) cellOrder[cellFill[boidCell[i]]++] = i;
```

A boid's candidates are then `cellOrder[cellStart[c] .. cellStart[c + 1])`
for each cell `c` in its block.

**Why the behaviour is unchanged.** Boids are still updated in the same order,
in place, so each boid still sees the velocities of the boids updated before
it this step. Only the order in which a boid sums its neighbours changes. The
sums round slightly differently, so individual trajectories drift apart over
time, as any chaotic simulation's do, but the flock's statistics are the same
to two decimal places on every seed tried (section 7.2).

**Limits.** The gain depends on the perception radius. At the slider's
maximum of 30 m, a 5 x 5 block of 15 m cells covers most of the 100 x 82 m
arena, and the grid saves little. At its minimum of 1 m, half-metre cells
would number about 33,000; floor the cell size (say at 1/64 of the arena's
width) so clearing the counts stays cheap.

| Boids | Now | Dot-product cone | Grid, cells of r | Grid, cells of r/2 |
| ---: | ---: | ---: | ---: | ---: |
| 200 | 0.39 | 0.22 | 0.14 | 0.16 |
| 500 | 2.6 | 1.5 | 0.94 | 0.83 |
| 1000 | 9.2 | 6.0 | 3.7 | 2.7 |
| 2000 | 30.5 | 19.6 | 12.2 | 9.3 |
| 5000 | 171 | 109 | 63 | 45 |

Milliseconds per frame, model `update` only. The grid columns include the
dot-product cone.

---

## 5. A neighbour limit

Studies of starling flocks found that each bird responds to its six or seven
nearest neighbours, however dense the flock (Ballerini et al., 2008, "the
topological interaction"). Stopping after `K` neighbours bounds the work per
boid, which is what makes the model close to linear.

**Nearest first.** Stopping at the first `K` found must not depend on scan
order, or boids would respond to whichever side of them is scanned first.
The spike visits the cells of the 5 x 5 block in order of distance from the
boid's own cell, which approximates "nearest `K`" without sorting. It was
also faster than scanning in rows (2.5 against 4.2 ms at 5000 boids).

| Boids | Now | Grid, cells of r/2 | Plus a limit of 16, nearest first |
| ---: | ---: | ---: | ---: |
| 200 | 0.39 | 0.16 | 0.10 |
| 1000 | 9.2 | 2.7 | 0.48 |
| 2000 | 30.5 | 9.3 | 0.96 |
| 5000 | 171 | 45 | 2.5 |

**It changes the flock.** With a limit, boids fly slower, and at 1000 boids
the flock is about half as aligned (section 7.2). The weights were tuned for
unlimited neighbours; a limited flock would need retuning to look the same,
and would still not be the same model.

**Recommendation.** Add a "Max neighbours" slider, from a small number up to
"unlimited", defaulting to unlimited. The default flock is unchanged, large
flocks become usable by turning it down, and the difference it makes is
itself worth seeing: it fits a demo whose point is tuning parameters.

---

## 6. Other approaches considered

| Approach | Why not now |
| --- | --- |
| Quadtree or k-d tree | Rebuilt every step, pointer-heavy, and allocating. For queries of one fixed radius a grid is simpler and faster. Not spiked |
| Sort and sweep along x | Prunes one axis only; the grid prunes both |
| Checking each pair once, for both boids | At most 2x. The vision cone is not symmetric, and boids are updated in place, so a pair's result is not the same for both |
| Struct-of-arrays (positions and velocities in `Float64Array`s) | A constant-factor gain from memory locality, but it changes `BoidModel`, which the view reads. Worth measuring after the grid. Not spiked |
| Per-cell sums (positions and velocities summed per cell, used for whole cells inside the radius) | Near-linear, but approximate; testing whether a whole cell is inside the default 229-degree cone is awkward, since the cone is not convex. Too complex for a demo |
| Updating a share of the boids each frame | Forces go stale, and the flock's behaviour starts to depend on the frame rate |
| A worker, WebAssembly or the GPU | Moves the model off the synchronous `update(deltaMs)` the architecture relies on. Beyond what the demo needs |

---

## 7. How it was measured

### 7.1 Time

A copy of `flock-model.ts` with a switch between the strategies above,
timing `update(16.7)` alone: 60 frames of warm-up, then at least 1.2 seconds
of frames, reported as milliseconds per frame. Seed 7, perception radius
16 m, vision 4 rad, the demo's other defaults. Single runs, so read small
differences (such as 0.14 against 0.16 ms at 200 boids) as noise.

### 7.2 Behaviour

For each strategy, five seeds, 20 simulated seconds (1200 frames of
16.7 ms), sampled every 10 frames over the last 10 seconds. Mean over seeds,
with the range in brackets. Polarisation is the length of the mean unit
heading: 1 when every boid flies the same way, near 0 when headings are
random.

| 200 boids | Polarisation | Nearest neighbour (m) | Speed (m/s) |
| --- | --- | --- | --- |
| Now | 0.21 (0.18-0.25) | 2.05 (1.86-2.23) | 18.10 (17.51-18.32) |
| Dot-product cone | 0.21 (0.18-0.25) | 2.05 (1.86-2.23) | 18.10 (17.51-18.32) |
| Grid, cells of r/2 | 0.21 (0.18-0.25) | 2.05 (1.86-2.23) | 18.10 (17.51-18.32) |
| Limit 32 | 0.24 (0.16-0.37) | 1.88 (1.72-2.10) | 17.86 (16.74-18.92) |
| Limit 16 | 0.20 (0.13-0.29) | 1.92 (1.79-2.07) | 14.68 (13.11-15.74) |
| Limit 8 | 0.19 (0.12-0.25) | 1.99 (1.95-2.01) | 13.39 (12.42-14.22) |

| 1000 boids | Polarisation | Nearest neighbour (m) | Speed (m/s) |
| --- | --- | --- | --- |
| Now | 0.17 (0.12-0.34) | 0.91 (0.86-1.01) | 18.32 (17.97-18.72) |
| Dot-product cone | 0.17 (0.12-0.34) | 0.91 (0.86-1.01) | 18.32 (17.97-18.72) |
| Grid, cells of r/2 | 0.17 (0.12-0.34) | 0.91 (0.86-1.01) | 18.32 (17.97-18.72) |
| Limit 32 | 0.12 (0.09-0.14) | 1.00 (0.94-1.02) | 12.45 (12.08-12.91) |
| Limit 16 | 0.09 (0.07-0.12) | 1.04 (1.03-1.05) | 11.73 (11.36-12.00) |
| Limit 8 | 0.09 (0.06-0.10) | 1.09 (1.08-1.12) | 11.40 (11.02-11.65) |

---

## 8. Open questions

1. **The neighbour limit.** Ship it as an opt-in slider (recommended), make it
   the default with retuned weights, or leave it out?
2. **The Boid Count slider's maximum** is 5000 in the working tree. With the
   exact changes alone, 5000 boids cost about 45 ms per frame in the model,
   so the demo runs at about 20 fps there. Keep 5000 only alongside the
   neighbour limit, or lower it?
3. **A `boids-scaling` benchmark suite**, like `falling-sand-scaling`, to
   record the curve above and catch regressions?

## 9. Implementation steps

1. Vision cone by dot product in `flock-model.ts`. The existing tests should
   pass unchanged.
2. The grid in `flock-model.ts`: half-radius cells with a floor, a counting
   sort into typed arrays, and cells visited nearest first (needed only by
   the limit, but harmless without it). Add a test that the forces on every
   boid match a brute-force reference implementation in the test file, for
   random flocks at several radii and vision angles.
3. Check it allocates nothing per frame (`npm run bench -- games-and-demos
   entry=boids measure=allocation`), and update the boids line in the
   measurements page.
4. If agreed: the neighbour limit, and a "Max neighbours" slider.
5. If agreed: a `boids-scaling` benchmark suite.

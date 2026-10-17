# A Floating Perfmon Throughout the Arcade

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-10-17 |
| Updated  | 2026-10-17 |

## Description

The owner wants a Perfmon that can float over any entry in the Arcade,
whatever its renderer. The view for it already exists. `@mvtjs/html` has
`PerfmonView`, built for this and for the playground's Performance tab. It
fits the space it's given, so in a small box over a corner of the screen,
it's a compact panel.

The Arcade's page runs one loop for itself and the entry it's running
(`packages/sites/arcade/src/arcade/main.ts`, through the entry host in
`runner/`). That loop knows when each frame starts and ends, for every
renderer. So it can drive one `createPerformanceMeter` (`@mvtjs/utils`)
itself, as the playground's sandbox does in
`packages/sites/playground/src/sandbox/run-sandbox.ts`. For Pixi entries, a
`createGpuTimer` (`@mvtjs/pixi`) on the Arcade's renderer gives the GPU's
time. For the others, GPU shows n/a.

### What moves with it

Two entries show a Perfmon of their own today, drawn with Pixi:

- **Boids** puts it under its sliders (`entries/boids/views/boids-view.ts`),
  and its layout leaves room for it (`PERFMON_GAP`, `PERFMON_HEIGHT`). It
  marks `reads` as not measured.
- **Falling Sand** puts it in its toolbar
  (`entries/falling-sand/views/toolbar-view.tsx`), and checks that the
  toolbar is tall enough for its info card (`view-constants.ts`).

Both get their metrics from `createPerformanceMetrics(host)`, in their
`start/load.ts`, using the `PixiHost` the Arcade hands a Pixi entry
(`entry-types/entry-starter.ts`). Once the Arcade has a meter of its own,
they should read that instead. Then the Arcade's Pixi `PerfmonView` in
`#shared` (`shared/perfmon-view.tsx`) and `PixiHost` may have no users left.

### Removing `@mvtjs/pixi`'s wrapper

`createPerformanceMetrics` in `@mvtjs/pixi` is now a thin wrapper. It
creates a meter and a GPU timer, and hooks the meter to Pixi's ticker and
renderer. Boids and Falling Sand are its only users. Once they use the
Arcade's meter, remove the wrapper, and its `PixiPerformanceMetrics` and
`PerformanceMetricsOptions` types, with a changeset (a minor version, since
the libraries are at 0.x). Show the four lines it replaced in
`@mvtjs/pixi`'s README, for a Pixi app that uses Pixi's own ticker.

### Open questions for the owner

1. How is the Perfmon turned on and off: a key, a setting kept with the
   Arcade's other settings (`storage/`), a button, or all of these?
2. Where does it float, and can it be moved? Does it show over the card
   wall too, or only while an entry runs?
3. Do Boids and Falling Sand keep a Perfmon in their own layout? It's part
   of what those demos show off. If they don't, their layouts lose the room
   they keep for it, and their reference images change.
4. Boids marks `reads` as not measured, because its views draw by hand and
   don't call `addReads`. Should the floating Perfmon let an entry say
   which metrics it can't measure?

## Acceptance Criteria

- [ ] The owner has answered the open questions.
- [ ] The Arcade drives one performance meter from its own loop, for every
      renderer, with the GPU timed for Pixi entries.
- [ ] A floating `PerfmonView` from `@mvtjs/html` shows it, over any entry,
      turned on and off as decided.
- [ ] Boids and Falling Sand read the Arcade's meter, or show it, as decided.
- [ ] `@mvtjs/pixi`'s `createPerformanceMetrics` is removed, with a
      changeset, and its README shows the wiring by hand. The Arcade's Pixi
      `PerfmonView` and `PixiHost` are removed if nothing uses them.
- [ ] Lint, type checks, the unit tests and the visual tests pass. Changed
      reference images have been looked at.

## Progress Log

### 2026-10-17

Created at the owner's request, after the playground gained its
Performance tab and `@mvtjs/html` gained `PerfmonView` (052).

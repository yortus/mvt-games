# Keep the JSX Precompiler, or Ship Two Builds?

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-09-30 |
| Updated  | 2026-10-01 |

## Description

The JSX runtime generates each element's refresh method with `new Function`,
which a Content Security Policy without `'unsafe-eval'` forbids. Such a page
gets a closure fallback, measured 6-16x slower per bound element on Pixi
([022](../proposals/022-renderer-agnostic-jsx.md) section 7.5.1), and the
opt-in build-time precompiler (022 section 7.6, `scripts/vite-plugin-jsx-precompile.ts`)
exists to give those pages the fast path anyway.

It was kept when it landed (022's merge, step 6, 2026-09-30), but it may cost
more than it is worth: a Vite plugin, a manifest per renderer, a registration
hook in the runtime, and tests for all three, for pages that may be rare.
Decide whether to keep it, or to follow Pixi's lead instead.

### The options

1. **Keep the precompiler**, as today: generated code where the page allows
   it, precompiled factories where it does not, the fallback for the rest.
2. **Two modes**, as Pixi does: generated code by default, and an import
   that selects an eval-free mode (question 4).
3. **Precompiler and two modes**: unlikely to be worth both.
4. **One eval-free runtime**: no `new Function` at all, so no probe, no CSP
   violation reports, no precompiler and no second mode. Viable only if the
   eval-free path comes close enough to generated code (question 7) that the
   difference is a small share of a frame in realistic games (question 6).
   Raised 2026-09-30, when a prototype of question 7 came within about 1.6x
   of generated code, from 15x.

### Questions to answer, with evidence

1. **Who else needs eval?** Pixi.js uses `new Function` in its default build
   (for its generated uniform and attribute code). Check what exactly, and
   whether three.js does too, and other game libraries and runtimes (Phaser,
   Babylon.js, PlayCanvas, and the JSX runtimes Solid and Preact). If a page
   using Pixi already needs `'unsafe-eval'`, a Pixi game's JSX needs nothing
   more.
2. **Do game sites forbid eval?** Evidence on how often a site that would
   host a game serves a CSP without `'unsafe-eval'`: game portals (itch.io,
   Newgrounds, CrazyGames, Poki), embeds in iframes, Chrome extensions (which
   forbid it outright under Manifest V3), and pages in corporate or school
   settings. Also whether hosting platforms set one by default.
3. **How does Pixi handle it?** Pixi ships a second mode for pages without
   eval: importing `pixi.js/unsafe-eval` replaces its generated code with
   non-eval versions. Check how an app opts in, whether Pixi detects the need
   itself, and what it does when a page forbids eval and the app did not opt
   in (an error, a warning, a silent fallback).
4. **Would that suit us better?** A two-mode runtime: generated code by
   default, and an import (say `@mvtjs/pixi/jsx/no-eval`, or one in the base)
   that selects the closure fallback, or a faster eval-free variant of it.
   Compare with the precompiler on speed on eval-free pages, maintenance, and
   what a user has to know and do.
5. **Can the choice avoid CSP violation reports?** Today the runtime probes
   `new Function` once, and a page that forbids it logs a violation (and
   sends a report, if it has `report-uri`) before falling back. An app can
   skip the probe by defining `__MVT_JSX_EVAL__` as `false` at build time.
   Look for a way for the page itself to say it runs without eval, so the
   runtime never tries: an import that selects the mode (as Pixi's does), a
   global set before the runtime loads, or reading the page's policy. There
   is no standard API to read a page's CSP before breaking it, so check what
   exists (a `<meta http-equiv>` policy is readable from the DOM; a header is
   not) and what Pixi does.
6. **What would the slow path really cost?** The 6-16x figure is per bound
   element, from the `jsx-refresh` suite's synthetic scenes. What matters is
   the cost per frame in realistic game scenes: measure the fast path
   (generated code) against the slow one (the closure fallback) across a
   range of them, as a share of a frame's budget. For example, this repo's
   games and demos as they ship (the `games-and-demos` suite, run with the
   fallback forced, as `__MVT_JSX_EVAL__` defined `false` would force it),
   the falling-sand demo from 1,000 to 20,000 grains
   (`falling-sand-scaling`), a HUD-heavy scene, and a scene of many small
   bound sprites. If the slow path costs a small share of a frame in
   realistic games, neither the precompiler nor a second mode is worth much;
   if it costs a large share, the choice matters.
7. **Can the slow path be made faster?** The closure fallback is a first
   version, never tuned. Try several eval-free ways to build an element's
   refresh (for example, closures specialised by binding count or kind,
   a flat table of bindings walked by one shared loop, or skipping unchanged
   values differently), and prove each with benchmarks against today's
   fallback and the generated code. A fallback close enough to the fast path
   would make both the precompiler and a second mode unnecessary, and
   option 4 possible.

### If the precompiler goes

- **Tag the commit before the one that deletes it**, e.g.
  `jsx-precompiler-last`, so it can be brought back. Record the tag here and in
  022.
- **Record the third option where the two-mode version lives:** in the base's
  design notes and in a comment at the mode switch, say that a build-time
  precompiler is possible and was built and measured (the tag, 022 sections
  7.6 and 12.1): it gave eval-free pages the generated code's speed, at the
  cost of a Vite plugin and a manifest per renderer.
- Remove the plugin, manifests, generator and their tests; the runtime's
  `registerRefreshFactories` and `REFRESH_SOURCE_VERSION` (keep
  `refresh-source.ts` as the generator's source); the `#…/precompile` aliases
  and the `MVT_JSX_PRECOMPILE` switch; and update 022, 011 section 5.5 and the
  design notes.

## Answers

Checked and measured 2026-09-30, against pixi.js 8.21.0, three.js 0.186.1,
solid-js 1.9.15 and preact 10.29.8 as installed, on the machine the saved
benchmark results name.

### 1. Who else needs eval?

- **Pixi.js: yes, by default.** Four places generate code with
  `new Function`: uniform sync (`generateUniformsSync`), uniform buffer sync
  (`compileBufferSync`), shader sync (`GenerateShaderSyncCode`) and the
  particle container's update (`generateParticleUpdateFunction`). Every
  renderer probes for it when constructed (`AbstractRenderer._unsafeEvalCheck`,
  `UboSystem._systemCheck`, both calling `unsafeEvalSupported()`), and
  **throws** if the page forbids it: "Current environment does not allow
  unsafe-eval, please use pixi.js/unsafe-eval module to enable support."
  So a Pixi page without `'unsafe-eval'` already had to opt in by import,
  knowingly.
- **three.js: no.** No `new Function` or `eval` in `three.core.js`,
  `three.module.js` or `three.webgpu.js` (the matches are `FunctionNode` and
  `FunctionCallNode`, TSL node classes).
- **Solid and Preact: no.** Neither runtime generates code.
- **Babylon.js and PlayCanvas: in optional parts.** Reported CSP failures
  are in add-ons that load decoders or WebAssembly: Babylon.js's Havok
  physics and KTX2 decoder
  ([forum](https://forum.babylonjs.com/t/havok-physics-load-error-unsafe-eval-in-a-browser-extension-a-content-security-policy-constrained-environment/55326),
  [forum](https://forum.babylonjs.com/t/csp-violation-during-ktx2-decoder-load/47937)),
  and PlayCanvas's Basis transcoder, whose glue uses `new Function`
  ([forum](https://forum.playcanvas.com/t/compile-error-unsafe-eval/40858)).
  Not checked in their cores.
- **Phaser: not found.** No reliable source either way; not checked in its
  source.

### 2. Do game sites forbid eval?

- **itch.io: no.** The game's iframe (`html-classic.itch.zone`) is served
  with no CSP header; the game's page has only
  `frame-ancestors 'self' https://itch.io` (checked with `curl`, two games).
  A 2017 forum answer said itch.io blocked dynamic code
  ([Unreal forum](https://forums.unrealengine.com/t/html5-on-itch-io/385980));
  it no longer does.
- **Poki: sets a CSP per game**, to block external requests by default
  ([external resources policy](https://developers.poki.com/guide/external-resources-policy)).
  Whether it allows eval is not documented; not checked in a live game.
  Pixi games run there, and Pixi needs eval unless imported otherwise.
- **CrazyGames: no requirement found.** Its docs mention CSP only for
  `frame-ancestors`, for games that restrict embedding
  ([sitelock](https://docs.crazygames.com/resources/html5/sitelock)).
- **Newgrounds: unknown.** Its site sends a strict CSP
  (`script-src 'self' 'wasm-unsafe-eval'`), but only a block page was
  reachable, not a game's iframe.
- **Chrome extensions: forbidden outright.** Manifest V3 extension pages
  may not add `'unsafe-eval'`; Chrome refuses to install one that tries.
  Sandboxed pages may, without extension APIs
  ([Chrome docs](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy)).
- **The web at large: rare.** 21.9% of sites send a CSP, and of policies
  that restrict `script-src`, 77% include `'unsafe-eval'`
  ([Web Almanac 2025, Security](https://almanac.httparchive.org/en/2025/security)).
  So about 5% of sites forbid eval through `script-src` (22% of 23%);
  those restricting scripts only through `default-src`, which also forbids
  eval, are not counted there.
- Corporate and school settings, and hosting platforms' defaults: no
  evidence found.

### 3. How does Pixi handle it?

An app opts in with a side-effect import, `import 'pixi.js/unsafe-eval'`,
which replaces the four generators with eval-free versions and both probes
with no-ops, on the prototypes. Pixi never detects the need: without the
import, it probes when a renderer is constructed and throws (question 1),
after the browser has logged, and reported, the violation. With the import,
it never probes, so there is no violation.

### 4 and 5. Two modes, and avoiding the violation

Moot: option 4 was chosen (below), so there is one mode, and nothing to
probe. For the record: a mode chosen by an import, as Pixi's is, was the only
way found for a page to avoid the violation, other than `__MVT_JSX_EVAL__` at
build time (or set as a global before the first bound element was built,
which the question 6 benchmarks used). There is no API to ask whether eval
is allowed: the `securitypolicyviolation` event fires only after a
violation, and only a `<meta http-equiv>` policy is readable from the DOM,
not a header.

### Decision: option 4, one eval-free runtime

Decided 2026-10-01, recorded in [022](../proposals/022-renderer-agnostic-jsx.md)
section 7.7 and in the base's [design notes](../../src/mvt-utils/jsx/design-notes.md)
section 7. The closures came within 1.1x to 1.3x of generated code on
shapes of one class, faster across classes, and level in the games and
demos (progress log, 2026-09-30), so neither a precompiler nor a second
mode is worth keeping. The last commit with them is tagged
`jsx-precompiler-last` (at `88017dd`).

### 6. What the slow path really costs

`refreshScene` µs per frame, median of 3 processes. "Before" is the first
fallback, "after" the one from question 7. A frame at 60 fps is 16,667 µs.

| Scene | Generated code | Fallback before | Fallback after |
| --- | --- | --- | --- |
| The seven games, each | 3.5-9.4 | 3.4-10.1 | 3.1-8.3 |
| Boids demo | 15.6 | 15.1 | 15.1 |
| Falling sand demo, as it ships | 121 | 950 | 182 |
| Falling sand, 1,000 grains, settled | 32 | 236 | 46 |
| Falling sand, 1,000 grains, flipping | 38 | 259 | 55 |
| Falling sand, 10,000 grains, settled | 407 | 4,420 | 870 |
| Falling sand, 10,000 grains, flipping | 724 | 3,250 | 1,100 |
| Falling sand, 20,000 grains, settled | 1,720 | 7,270 | 2,860 |
| Falling sand, 20,000 grains, flipping | 2,170 | 7,840 | 3,180 |

In the games, the path makes no measurable difference: each spends under
0.1% of a frame in `refreshScene`, whichever path runs (Scramble's 4.1 against
8.3 µs before was the largest gap). Only a scene of thousands of bound
elements shows it: at 20,000 grains, the first fallback cost 44% of a frame
and generated code 10%; the new fallback costs 17%. No separate HUD-heavy
scene was built: the games' HUDs are in their numbers. Saved with the
suites: the `refresh-paths` tables of `games-and-demos` and
`falling-sand-scaling`.

### 7. Making the slow path faster

The prototype's variants are in the progress log. As built, in the
`jsx-refresh` suite (µs per frame):

| Scene | Hand-written | Generated code | Fallback before | Fallback after |
| --- | --- | --- | --- | --- |
| Uniform, 1,000 | 13.6 | 17.1 | 284 | 27.2 |
| Uniform, 10,000 | 217 | 275 | 3,020 | 380 |
| Mixed, 1,000 | 28.5 | 33.2 | 286 | 54 |
| Mixed, 10,000 | 394 | 580 | 3,860 | 1,490 |

From 8-15x slower than generated code to 1.4-2.6x. Building an element is
unchanged (1.1 µs per element, old and new, 10,000 elements of the mixed
scene's six shapes), and each keeps 12% less memory (2,210 bytes against
2,520). What remains is inlining: V8 inlines each generated method's getters
and writes, but none of the fallback's, whose call sites are shared by
every element with the same number of bindings. That needs generated code;
no eval-free way around it was found. Unmeasured on the HTML and three.js
JSX targets; DOM properties are accessors too, so the setter path applies.

## Acceptance Criteria

- [x] Questions 1-5 answered, with sources (4 and 5 made moot by the decision)
- [x] Question 6 measured: the fast and slow paths benchmarked across realistic game scenes, and the results saved with the suites
- [x] Question 7 measured: several eval-free refresh variants benchmarked against today's fallback and the generated code, the best kept if it wins
- [x] A decision recorded in 022: one eval-free runtime (option 4), section 7.7
- [x] The precompiler's last commit tagged (`jsx-precompiler-last`), the
      options recorded in the design notes, and the precompiler and generated
      code removed
- [x] Pages that forbid eval need nothing: the runtime never calls
      `new Function` (tested with it blocked, `html-jsx.test.tsx`)
- [x] Results saved with the suites that use the JSX runtime

## Progress Log

- 2026-09-30: Created, from review of the precompiler's merge (022's step 6).
- 2026-09-30: Picked up. Added question 7 (can the slow path be made faster).
- 2026-09-30: Question 7 prototyped outside the repo: the `jsx-refresh` scenes
  rebuilt from the real `pixiElements` table, with eval-free builders swapped
  in. µs per frame, median of 3 processes (10k columns noisy):

  | Variant | uniform 1k | mixed 1k | uniform 10k | mixed 10k |
  | --- | --- | --- | --- | --- |
  | Generated code | 16.5 | 34 | ~340 | ~600-850 |
  | Today's fallback | 257 | 266 | 3,060 | 3,610 |
  | Today's loop, properties written through their setters | 65 | 81 | 1,260 | 2,520 |
  | A closure per binding, specialised by kind | 244 | 244 | 2,660 | 4,030 |
  | The same, through setters | 39 | 69 | 560 | 1,550 |
  | The same, one loop instead of unrolled | 49 | 72 | 634 | 1,655 |
  | The same, setters bound to the element | 46 | 74 | 830 | 1,690 |
  | Flat: per-arity closures (1-6 bindings), a call site per position, setters | 27 | 54 | ~410 | ~1,440 |

  The fallback's main cost is the write: `el[name] = value`, one keyed store
  shared by every property, which V8 handles slowly when it reaches an
  accessor such as Pixi's `x`. Finding each property's setter on the
  prototype chain once (cached per prototype) and calling it with
  `set.call(el, v)` makes the fallback 4-6x faster. Unrolled per-arity
  closures, so each position has its own getter and setter call sites, give
  another 1.5x. Added option 4 (one eval-free runtime).
- 2026-09-30: Questions 1-3 answered from the installed packages and the web;
  5 partly. Question 7's winner built into `buildFallback` (setters found per
  prototype, written-out methods for up to six bindings); the tests and the
  conformance suite pass on every JSX target. Question 6 measured with a new
  `refresh` param on `games-and-demos` and `falling-sand-scaling`
  (`benchmarks/harness/refresh-path.ts`), before and after. Answers above.
- 2026-09-30: Saved `jsx-refresh` (first time), `games-and-demos` and
  `falling-sand-scaling` with the new fallback; they agree with the runs
  above. Re-saving also moved generated code's own numbers (pixi.js 8.16 to
  8.21, and the drain-the-tail refresh pass): falling sand at 20,000 settled
  grains from 2.8 ms to 1.8 ms. Prose quoting them updated in
  `measurements.md` and the falling-sand README. Waiting on the decision.
- 2026-09-30: **Decided: two modes (option 2).** Generated code stays the
  default; an import selects the eval-free fallback without probing; the
  precompiler goes. Chosen over option 4 because generated code is still
  1.4-2.6x faster where it matters (scenes of thousands of bound elements)
  and costs little to keep once the precompiler is gone. Next: commit this
  work, tag it `jsx-precompiler-last`, then remove the precompiler.
- 2026-09-30: Removal paused (committed as 88017dd): can the eval-free path
  match generated code, making option 4 viable after all? Scratch sweep,
  1,000 to 50,000 elements, three scenes (uniform; mixed; grain-like sprites
  binding `x`, `y` every frame and `tint` on change through model methods),
  ns per element per frame. The committed fallback's gap (1.2-2.3x) has
  three causes, each measured:

  1. **Memory per element**, which dominates from about 5,000 elements. All
     of `writeFrom`'s per-arity closures share one V8 context, so every
     refresh method keeps twelve getter and writer slots and both arrays;
     and every element allocates a `Float64Array`, kept alive by its
     on-change writers' context. Heap kept per element at 20,000: grain
     2,641 bytes against generated code's 1,833; uniform 1,521 against
     1,057. A factory function per arity and per write kind, and a typed
     array only for number bindings, bring grain to 1,953 and uniform to
     generated's level; uniform's time then matches generated from 10,000.
  2. **Writes are not inlined.** `--trace-turbo-inlining` shows V8 inlining
     the getters into the scene pass in both, and the setters (`set x`,
     `set y`, Pixi's `_onUpdate`) only in generated code: called through
     `.call`, their target is unknown. Hand-written writers such as
     `(e, v) => { e.x = v; }`, called directly, brought uniform to 1.0-1.1x
     at every scale. Wrapping the setter in a closure does not help.
  3. **Shapes share call sites.** Every shape with the same number of
     bindings runs the same per-arity closure, so in a mixed scene its call
     sites see several getters and writers and inline none (mixed stayed at
     1.3x with direct writers; grains beside 40 other 3-binding elements
     went to 1.5x). Generated code has call sites per shape. Eval-free
     equivalent: the per-arity factories written out K times in source, each
     new shape taking its own copy. With 8 copies and direct writers: mixed
     1.04x at 1,000 and 0.81x at 10,000 (faster: smaller closures), polluted
     grains 0.96x. With copies but setters through `.call`: no gain.

  So eval-free code can match generated code, given writes written as code
  in the element tables (apply functions, not property names), a pool of
  copies of the refresh code, and lean closures. Not yet built into the
  runtime or measured on the demos.
- 2026-09-30: Built into the runtime (uncommitted), measured on the demos,
  and revised. Pixi's table gained `bitmapText`, `htmlText`, `tilingSprite`
  and `nineSliceSprite`, so that shared writes can go megamorphic, and
  `jsx-refresh` a `kinds` scene (all eight, one shape) and 50,000 elements.

  **Writes as functions in the table failed in the real demo.** Isolated
  scenes matched generated code, but in falling sand, `refreshScene` took
  181 µs against generated code's 121 with property names, and generated
  code with the same table 172: one function writes `x` for every element
  that binds it, of every class, and V8 gives up on its store. Falling sand
  scaling, both paths, 30-50% slower. Reverted to property names.

  **Keyed stores, one shape and class per copy.** A copy assigns
  `el[name] = value` for a property attribute: a store that sees one name
  and, keyed by shape and class, one class, which V8 makes as fast as
  `el.x = value` (scratch: parity with generated code at 1,000 grains beside
  seven other kinds). A keyed store seeing seven classes was 7x slower than
  generated code's (440 ns against 65 per element): V8 handles a
  megamorphic keyed store to an accessor in its runtime. So a shape takes a
  copy of its own only at its sixteenth element on one class, from a pool
  (16 per number of bindings, `scripts/refresh-copies.ts`, 1.7 KB gzipped),
  and all else uses a shared copy that calls setters. One slot per binding
  (a name or a writer), on-change values kept in the copy, a typed array
  only for number bindings.

  Measured, generated code against the fallback, same table (µs per frame):

  | Scene | 1,000 | 10,000 | 50,000 |
  | --- | --- | --- | --- |
  | `jsx-refresh` uniform | 16.3 / 20.5 | 272 / 327 | 3,650 / 3,250 |
  | `jsx-refresh` mixed | 31.8 / 36.8 | 646 / 747 | 6,410 / 7,040 |
  | `jsx-refresh` kinds (hand-written 95, 1,120, 11,800) | 203 / 121 | 2,590 / 1,700 | 17,100 / 12,600 |

  | Falling sand, `refreshScene` | 1,000 | 10,000 | 20,000 | 50,000 | 200,000 |
  | --- | --- | --- | --- | --- | --- |
  | Settled | 27.9 / 36.1 | 486 / 463 | 1,750 / 1,930 | 4,840 / 5,520 | 20,200 / 24,300 |
  | Flipping | 37.8 / 45.6 | 632 / 810 | 2,160 / 2,310 | 5,740 / 6,720 | 21,800 / 24,600 |

  The demo as it ships: 128 / 124. The games: level. So 1.1-1.3x where each
  shape is on one class, 0.6-0.75x where a shape spans many (generated code
  keys by shape alone, and could key by class too). The residual is
  probably the per-write checks generated code does not make (`typeof` on
  each slot, the keyed store's name check). Building an element: 5-10%
  slower, 40-56 bytes (3%) more kept. Results not saved with `--save` yet.
- 2026-10-01: Build-time generation of the copies evaluated: feasible, since
  the copies depend on nothing in an app, but it needs a plugin for Vite, the
  benchmarks' esbuild and publishing, tests of two implementations, and gives
  a silent slow path to anything that runs the source untransformed. Chosen
  instead: generate `refresh-copies.ts` on install (`prepare`) and before
  dev, build, test and bench, gitignored. Stack traces checked: a throwing
  binding shows its getter, then the copy (`refresh1Copy3`, named in the
  generator) at a line of `refresh-copies.ts`; generated code showed only
  `eval ... <anonymous>`.
- 2026-10-01: **Option 4 done.** Tagged `88017dd` as `jsx-precompiler-last`.
  Removed the precompiler (Vite plugin, manifests and their generator, tests),
  `refresh-source.ts`, `new Function`, the probe, the dev warning,
  `__MVT_JSX_EVAL__`, `registerRefreshFactories`, `REFRESH_SOURCE_VERSION`,
  `refreshMethodCounts`, the `canGenerateCode` option and the identifier check
  on property names (it guarded generated source). The refresh builder is the
  closures alone; `createJsx` gained `ownCopyAt` (default 16), which the
  conformance suite sets to 1 to run every scenario on shapes' own copies as
  well as the shared one. Benchmarks' `refresh` params and `refresh-path.ts`
  removed; `jsx-refresh` compares hand-written code with JSX. Updated 022
  (section 7.7, superseded notes), 011, 023, 027 (one clause), the notes
  index, both design notes, `attributes.ts` and AGENTS.md. Re-saved every
  suite that uses the JSX runtime.
- 2026-10-01: Per-element overhead, from `reactivity`'s scene (1,000
  containers, values mostly unchanged, so Pixi's setters do almost nothing).
  Scratch, µs per frame, one bound `x` / three (`x`, `y`, `alpha`): hand-written
  4.9 / 5.5, generated code 5.8 / 9.3, a copy storing by name and nothing else
  6.4 / 9.9, a copy as built 7.5 / 11.9, the runtime 9.5 / 13.5. Two causes:
  (1) about 1 ns per binding for the checks a copy makes and generated code
  did not (each binding's kind, and whether its slot is a name or a writer);
  a second family of copies for shapes whose bindings are all every-frame
  property stores would recover most of it, not built: it shows only where
  nothing is written, and doubles the generated file. (2) About 1.5 µs is the
  scene pass's call to `onRefresh` seeing two functions, the shared copy (a
  shape's first 15 elements) and the shape's own, so V8 stops inlining the
  refresh into it: with `ownCopyAt` 1 the runtime matches the copy as built.
  In an app that call site sees every view's refresh method anyway, so
  neither path is inlined there, which is why the games measure level. The
  saved `reactivity` result also moved with pixi.js 8.16 to 8.21 and solid-js
  1.9.11 to 1.9.15 (Solid's numbers doubled), so it is not a clean
  before-and-after.
- 2026-10-01: Saved `jsx-refresh`, `games-and-demos`, `falling-sand-scaling`,
  `reactivity`, `scaling`, `construction`, `memory` and `html-scene-passes`.
  Updated the figures `measurements.md` quotes, including those that moved
  with the pixi.js and solid-js upgrades (Solid's per-change cost and garbage
  roughly doubled). Not explained here: the `memory` suite's "compare by
  hand" scene now allocates 1,440 bytes per frame, against none before; it
  uses no JSX, so likely the pixi.js upgrade. Archived.

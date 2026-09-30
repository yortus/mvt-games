# Keep the JSX Precompiler, or Ship Two Builds?

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-09-30 |
| Updated  | 2026-09-30 |

## Description

The JSX runtime generates each element's refresh method with `new Function`,
which a Content Security Policy without `'unsafe-eval'` forbids. Such a page
gets a closure fallback, measured 6-16x slower per bound element on Pixi
([022](../../proposals/022-renderer-agnostic-jsx.md) section 7.5.1), and the
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

Pending the decision (below). What the evidence says so far: a mode chosen by
an import, as Pixi's is, is the only way found for a page to avoid the
violation, other than `__MVT_JSX_EVAL__` at build time. Setting
`globalThis.__MVT_JSX_EVAL__ = false` before the first bound element is
built already works, since the probe reads it as a global (the benchmarks
use this; see `benchmarks/harness/refresh-path.ts`), but it is not
documented. There is no API to ask whether eval is allowed: the
`securitypolicyviolation` event fires only after a violation, and only a
`<meta http-equiv>` policy is readable from the DOM, not a header. Option 4
makes the question moot.

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

- [ ] Questions 1-5 answered, with sources
- [x] Question 6 measured: the fast and slow paths benchmarked across realistic game scenes, and the results saved with the suites
- [x] Question 7 measured: several eval-free refresh variants benchmarked against today's fallback and the generated code, the best kept if it wins
- [ ] A decision recorded in 022: keep the precompiler, or move to two modes
- [ ] If two modes: the precompiler's last commit tagged, the third option
      recorded in the design notes and at the mode switch, and the precompiler
      removed
- [ ] If two modes: pages that forbid eval can select the eval-free mode
      without a CSP violation

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

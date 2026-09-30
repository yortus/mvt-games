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

## Acceptance Criteria

- [ ] Questions 1-5 answered, with sources
- [ ] Question 6 measured: the fast and slow paths benchmarked across realistic game scenes, and the results saved with the suites
- [ ] A decision recorded in 022: keep the precompiler, or move to two modes
- [ ] If two modes: the precompiler's last commit tagged, the third option
      recorded in the design notes and at the mode switch, and the precompiler
      removed
- [ ] If two modes: pages that forbid eval can select the eval-free mode
      without a CSP violation

## Progress Log

- 2026-09-30: Created, from review of the precompiler's merge (022's step 6).

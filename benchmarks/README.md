# Benchmarks

Performance benchmarks for MVT in this repo: keeping Pixi containers in step
with a model, the scene passes, the hot path rules, memory and garbage
collection, and the games and demos themselves. The results, with what they mean, are in
[Performance Measurements](../docs/building-with-mvt/performance/measurements.md).
How they are measured, and why, is in
[Benchmarking Methods](../docs/building-with-mvt/performance/benchmarking-methods.md).

## Running

```sh
npm run bench                                    # list the suites
npm run bench -- reactivity                      # run one suite
npm run bench -- reactivity approach=solid       # only cases whose params match
npm run bench -- reactivity --runs=5             # processes per case (default 3)
npm run bench -- all --save                      # every suite, saving results/
```

A full run takes about an hour. Close other programs first: the numbers are
only as quiet as the machine.

`--save` refuses to run with filters, so saved results always cover a whole
suite. It writes `results/<suite>.json` (every run's numbers, and the machine
and library versions) and `results/<suite>.md` (the tables, which the docs
include).

## Suites

| Suite | Measures |
| --- | --- |
| `reactivity` | Keeping 1000 Pixi containers in step with a changing model: polling (hand-written `onRefresh` methods and the JSX runtime), events, and Solid signals, as the share of the model changing each frame varies |
| `scaling` | The same, from 100 to 100,000 containers |
| `jsx-refresh` | Refreshing JSX bindings, uniform and over every write kind: the runtime's generated refresh methods, its eval-free fallback (for pages whose Content Security Policy forbids `new Function`), and hand-written methods |
| `change-detection` | Reacting to a value that changes occasionally (comparing by hand, `watch()`, events, signals), and a property computed from 8 model values |
| `construction` | The cost of a container from construction to destruction, and a pool of short-lived items: reusing containers with `<List>` over a `SlotList`, against building and destroying them |
| `scene-passes` | `refreshScene` against a plain recursive walk and Pixi's `onRender`, and skipping inactive subtrees with `SKIP_DESCENDANTS` |
| `html-scene-passes` | In headless Chrome: the DOM's `refreshScene` against a naive walk, steady and with the tree changing every frame, and a JSX list on one renderer (HTML or three.js) alone and after one on the other has run in the same page |
| `hot-path-rules` | Each rule on the Hot Paths page: the pattern it warns against, and the one it recommends, for time and allocation |
| `memory` | Bytes allocated per frame, garbage collections over a simulated minute, and memory kept alive per container |
| `games-and-demos` | This repo's games and demos as they ship, each started through its entry and run headless, the games with scripted input and the demos unattended: time per frame, allocation and garbage collection, and `refreshScene` with JSX bindings refreshed by generated code and by the eval-free fallback |
| `falling-sand-scaling` | The falling-sand demo from 1,000 to 20,000 grains, one sprite each, settled and flipping: time per frame split into model, update and refresh passes, and reads per frame. Builds the demo's model and view directly, since its entry cannot set a grain count. Also the demo as it ships up to 20,000 grains, with JSX bindings refreshed by the eval-free fallback |

## Layout

```
benchmarks/
├── run.ts              Command line: picks suites and filters, calls the driver
├── harness/
│   ├── suite.ts        Suite, Case and TableSpec types
│   ├── driver.ts       Bundles a suite's measured file, runs each case in its own process (or headless Chrome page), prints and saves tables
│   ├── measure.ts      Used inside each case's process: timeFrames, allocationPerFrame, gcDuring, retainedPerItem
│   ├── refresh-path.ts Used inside a case's process: selects the JSX runtime's generated code or its eval-free fallback
│   └── text-measurement.ts  Lets Pixi measure text under Node, for games and demos that read a text's size
├── shared/             Scenes used by more than one suite
├── repro/              Standalone reproducers of costs not yet explained; not part of any suite
├── suites/
│   ├── index.ts        Every suite, in run order
│   ├── <suite>.ts      The suite's definition: cases and tables. Plain data
│   └── <name>.case.ts  The measured file: reads its params, measures, reports one line of JSON
└── results/            Saved by --save
```

## Adding a suite

1. Write the measured file, `suites/<name>.case.ts`. Read the case's params
   with `readParams()`, build the scene, measure it with the helpers in
   `harness/measure.ts`, and `report()` the metrics once.
2. Write the definition, `suites/<name>.ts`: the cases (`combinations()` helps),
   any Node flags they need, and the tables to print. A suite that needs a
   real DOM sets `environment: 'browser'`: each case then runs in a fresh
   headless Chrome, found at `CHROME_PATH` or where Chrome or Edge installs
   by default, and can only time frames.
3. Add it to `suites/index.ts`.

Things that have caught these benchmarks out before, all in the method page:
module-level `let` variables declared below the code that runs at the top of a
measured file (they are not yet initialised when it runs), a result variable
that allocates on every `+=`, and a reactive library that never reacted.

## What is excluded

Rendering: nothing is drawn, so Pixi's transform updates and draw calls are not
in any number. Only V8 under Node has been measured, on one machine per saved
result; browsers and other engines have not, except for `html-scene-passes`,
which runs in headless Chrome. For the games and demos,
textures are stubbed with Pixi's 1x1 `Texture.WHITE`, because loading a
spritesheet needs a browser, and text widths are estimated from the font size,
because measuring text needs a canvas.

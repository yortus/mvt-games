# Benchmarks

Performance benchmarks for MVT in this repo: keeping Pixi containers in step
with a model, `updateView` and `refreshView`, the hot path rules, memory and
garbage collection, and the games and demos themselves. The results, with what they mean, are in
[Performance Measurements](../docs/building-with-mvt/performance/measurements.md).
How they are measured, and why, is in
[Benchmarking Methods](../docs/building-with-mvt/performance/benchmarking-methods.md).

## Running

```sh
npm run bench                                    # list the suites
npm run bench -- reactivity                      # run one suite
npm run bench -- reactivity approach=solid       # only cases whose params match
npm run bench -- reactivity --runs=5             # always this many processes per case
npm run bench -- all --save                      # every suite whose inputs changed, saving results/
npm run bench -- all --save --force              # every suite, changed or not
npm run bench -- all --save --extended           # every suite, extended cases included
npm run bench -- memory --jobs=4                 # counts-only processes at once
npm run bench -- memory --report                 # re-render results/<suite>.md from its saved JSON
```

A full run takes about 25 minutes. Close other programs first: the numbers are
only as quiet as the machine.

- **Runs.** Each case runs in its own process, twice, and a third time only
  when the two disagree by more than 5% on a metric its tables show. Each
  cell is the median, and `±` marks a remaining disagreement. `--runs=N`
  always runs N.
- **One timed process at a time.** Cases marked `countsOnly` (allocation and
  memory kept alive, which sharing the machine cannot change) run first,
  several at once (`--jobs`, by default half the logical processors, at most
  8); every other case runs alone.
- **Extended cases.** Cases marked `tier: 'extended'` are slow and answer a
  settled question; they run only with `--extended`. A save without it keeps
  their previous results, marked † in the tables with the date measured.
- **Unchanged suites are skipped.** A save records a hash of the suite's
  inputs: its bundled measured file, its cases, the run policy, the driver,
  and the Node, Pixi and Solid versions (and the installed Chrome, for a
  browser suite). A later save with the same hash re-renders the tables
  without measuring; `--force` measures anyway, for example on a quieter
  machine.
- **A cache per suite run.** A case can keep something slow to build and the
  same for every case, such as a filled falling-sand tank, with `cached()`
  from `harness/case-cache.ts`. It lasts for one suite run, so it can never
  come from other code.

`--save` refuses to run with filters, so saved results always cover a whole
suite. It writes `results/<suite>.json` (every run's numbers, the machine and
library versions, and the inputs' hash) and `results/<suite>.md` (the tables,
which the docs include).

## Suites

| Suite | Measures |
| --- | --- |
| `reactivity` | Keeping 1000 Pixi containers in step with a changing model: polling (hand-written refresh methods and the JSX runtime), events, and Solid signals, as the share of the model changing each frame varies |
| `scaling` | The same, from 100 to 100,000 containers |
| `jsx-refresh` | Refreshing JSX bindings against hand-written methods, from 1,000 to 50,000 elements: uniform, over every write kind, and one shape on all eight kinds of Pixi element |
| `change-detection` | Reacting to a value that changes occasionally (comparing by hand, `watch()`, events, signals), and a property computed from 8 model values |
| `construction` | The cost of a container from construction to destruction, and a pool of short-lived items: reusing containers with `<List>` over a `SlotList`, against building and destroying them |
| `refresh-view` | `refreshView` against a plain recursive walk and Pixi's `onRender`, and skipping inactive subtrees with `SKIP_DESCENDANTS` |
| `html-refresh-view` | In headless Chrome: `refreshView` on the DOM against a naive walk, steady and with the tree changing every frame, and a JSX list on one renderer (HTML or three.js) alone and after one on the other has run in the same page |
| `hot-path-rules` | Each rule on the Hot Paths page: the pattern it warns against, and the one it recommends, for time and allocation |
| `memory` | Bytes allocated per frame, garbage collections over a simulated minute, and memory kept alive per container |
| `games-and-demos` | This repo's games and demos as they ship, each started through its entry and run headless, the games with scripted input and the demos unattended: time per frame, allocation and garbage collection |
| `falling-sand-scaling` | The falling-sand demo from 1,000 to 20,000 grains, one sprite each, settled and flipping: time per frame split into model, `updateView` and `refreshView`, and reads per frame. Its SolidJS store variants flipping at 10,000 grains and more are extended cases. Builds the demo's model and view directly, since its entry cannot set a grain count |

## Layout

```
packages/benchmarks/
├── run.ts              Command line: picks suites and filters, calls the driver
├── harness/
│   ├── suite.ts        Suite, Case and TableSpec types
│   ├── driver.ts       Bundles a suite's measured file, runs each case in its own process (or headless Chrome page), prints and saves tables
│   ├── measure.ts      Used inside each case's process: timeFrames, allocationPerFrame, gcDuring, retainedPerItem
│   ├── case-cache.ts   Used inside a Node case's process: cached(), for what a suite run's cases share
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
result; browsers and other engines have not, except for `html-refresh-view`,
which runs in headless Chrome. For the games and demos,
textures are stubbed with Pixi's 1x1 `Texture.WHITE`, because loading a
spritesheet needs a browser, and text widths are estimated from the font size,
because measuring text needs a canvas.

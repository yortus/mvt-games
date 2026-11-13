# AGENTS.md - AI Agent Orientation

> Terse, structured reference for AI coding agents. This file is the
> orientation. For task-specific instructions, load the relevant
> [skills file](#skills). The book and the repo's own pages are listed under
> [Documentation](#documentation).

## Architecture: MVT (Model-View-Ticker)

- **Models** - own all state and domain logic; advance only via `update(deltaMs)`
- **Views** - read state through a `bindings` interface; refresh every frame via `refresh()`. Views may hold cosmetic presentation state for transitions that the model doesn't track; such views gain an `update(deltaMs)` step. Complex presentation logic can be extracted into a view model (an internal detail of the view). In this repo, a view sets its `update` and `refresh` steps on its container with `setUpdate(view, update)` and `setRefresh(view, refresh)`, from `@mvtjs/pixi` (and `@mvtjs/three`, `@mvtjs/html`)
- **Ticker** - drives the loop each frame: `model.update(deltaMs)` then `view.update(deltaMs)` (views with state) then `view.refresh()` then renderer draws. One turn is a **tick**: the ticker ticks the models, then the views. In this repo: each site's page (`startSitePage`, in `packages/sites/site-kit/src/arcade/start-site-page.ts`) runs one loop for itself and the entry it is running. An entry session's `update(deltaMs)` advances only its models, then the entry host (`packages/sites/site-kit/src/runner/`) calls `updateView(app.stage, deltaMs)`, which calls every update method in the stage, then `refreshView(app.stage)`, which calls every refresh method, parents first. Views never forward these calls to their children. The host decides when to pause: `updateView` skips a paused entry's container
- **Bindings** - plain object bridging view and model: query bindings read state (a function called every refresh, or a fixed value read once), relay bindings (`on*`) report input, usually what the player did, and fire outside the frame

Full reference: [Chapter 2, Why MVT](packages/sites/docs/chapters/02-why-mvt.md) -
[Appendix A, MVT on One Page](packages/sites/docs/appendices/a-mvt-on-one-page.md) (every rule) -
[Chapter 25, The Eight Principles](packages/sites/docs/chapters/25-the-eight-principles.md) (why the rules are what they are, for cases no rule covers)

## Project Structure

An npm workspace: four libraries published under `@mvtjs`, the sound
chips `audio90` and the visual testing package `v-snap`, each published on
its own, and private packages for everything else.

```
packages/
├── libraries/           What is published to npm
│   ├── utils/           @mvtjs/utils: renderer-agnostic helpers (the view tick API, watch, reactions and computed values, SlotList, tweens, metronome, performance meter); JSX base at ./jsx
│   ├── pixi/            @mvtjs/pixi: the view tick API for Pixi containers, performance metrics, and Pixi's JSX runtime
│   ├── three/           @mvtjs/three: the view tick API for three.js objects, pointer picker, and its JSX runtime
│   ├── html/            @mvtjs/html: the view tick API for DOM elements, its JSX runtime, and a Perfmon view
│   ├── audio90/         audio90, on npm: the Audio80 and Audio90 sound chips, their tracker notation and sequencer; guides in docs/
│   └── v-snap/          v-snap, on npm: visual snapshot tests for canvas and HTML views, as Vitest projects
├── sites/               What gets deployed
│   ├── arcade/          @mvtjs/arcade (private): the arcade games' site (Vite): its page, its entries, their texture scripts. Its build also writes the site's root
│   ├── demos/           @mvtjs/demos (private): the demos' site, the same shape
│   ├── puzzles/         @mvtjs/puzzles (private): the puzzles' site, the same shape
│   ├── site-kit/        @mvtjs/site-kit (private): what the three sites share: the page, the entry host, shared views, highscores, the Vite config and plugins, scripts/ (the one dev server, thumbnails, the pixel font), highscores-worker/ (the Cloudflare Worker that keeps the highscore tables)
│   ├── playground/      @mvtjs/playground (private): an editor in the browser that runs small MVT projects in a sandbox (Vite): src/, examples/, book/ and starters/ (each a project; book/ holds the examples the book's pages run, starters/ are what New opens), libraries/ (what a project may import), cheat-sheets/ (the cheat sheets, beside the editor, in the embeds and in Appendix G)
│   └── docs/            @mvtjs/docs (private): the book, and the pages for working in this repo (VitePress): index.md (the Preface), chapters/, appendices/, working-in-this-repo/, ai-agents/ (the skills, not published)
└── internal/            What serves this repo only, and never ships
    ├── eslint-plugin/   @mvtjs/eslint-plugin (private): this repo's lint rules, loaded from source by `eslint.config.ts`
    ├── benchmarks/      @mvtjs/benchmarks (private): performance benchmarks, for the libraries and the games
    └── checks/          @mvtjs/checks (private): tests that the packages still fit together as decided
notes/                   Proposals and tasks
```

```
packages/sites/<site>/              arcade, demos or puzzles
├── index.html           The site's page; the kit writes its nav in
├── vite.config.ts       defineSiteConfig({ site }), from @mvtjs/site-kit/vite
└── src/
    ├── main.ts          startSitePage(SITE)
    ├── site.ts          SITE: its name, marquee, About text, catalogue, and its entries' kind (game or demo)
    ├── share.jpg        Its wall's link preview, made by generate-thumbnails
    └── entries/         Its entries, one directory each, and catalogue.ts, which lists them
        └── <id>/        Self-contained entry
            ├── start/   entry.ts (what its card shows), details.ts (the long text, loaded after the first paint), load.ts (the code, imported on launch), thumbnail.webp (its card's picture), share.png (its link preview's picture)
            ├── data/    Static data and configuration constants
            ├── models/  State & domain logic + domain types
            └── views/   Presentation (Pixi, three.js or HTML)
```

```
packages/sites/site-kit/src/       Imported by the sites as @mvtjs/site-kit/<folder>
├── arcade/              The page, in HTML JSX: model, views, its own sounds, its styles, and the page's loop (start-site-page.ts, imported as @mvtjs/site-kit/site-page)
├── device/              What the visitor's device supports, such as touch
├── input/               Input that needs no renderer: the arcade controls the entry host creates for a game (createArcadeControls, ARCADE_CONTROL_KEYS), the keyboard for the entries that listen to it themselves (listenToKeys), taps and drags over a grid (createGridGesturesViewModel), taps and holds on a row of keys (createPressGesturesViewModel), pans and zooms over an element (listenToPanZoom), and one pointer followed over a DOM element (listenToElementPointer)
│   └── pixi/            Input on a Pixi stage, imported as @mvtjs/site-kit/input/pixi: listenToPointer (one pointer followed over a Pixi container), listenToPress (a button that shows when it is held), and the touch, swipe and drag views
├── entry-types/         What an entry is: ArcadeEntry, its tags, the starters and sessions
├── highscores/          The highscore tables' rules, and the page's stores. The Worker that keeps the tables is in ../highscores-worker/
├── runner/              The entry host, which runs one entry of any renderer in the MVT order, and the page's sound
├── pixel-glyphs/        The site's pixel glyphs: every printable ASCII character as rows of cells, which entries draw their own way
├── shared/              The Pixi views entries share: the overlay and pixel text
├── sound/               The chip types views play on (MusicChip, SfxChip)
├── snapshot/            The page generate-thumbnails photographs each entry on
├── testing/             describeCatalogue, the checks every site's catalogue passes
└── storage/             What the site keeps in the visitor's browser between visits: settings, favourites, saved games
```

The demos also hold `src/tunes/`, the Audio90 tunes the Tune Tracker plays
(`#tunes`). Sudoku's puzzle maker and grid are in
`packages/sites/puzzles/src/entries/sudoku/generator/`, which Sudoku Digger, a
demo, imports as `@mvtjs/puzzles/sudoku-generator`. The puzzles' games
share `packages/sites/puzzles/src/shared/`: day numbers, the records kept in
the browser, the calendar, and the way in (a How to play card and a
walkthrough on a practice puzzle, with an arrow), as models and views. See
[A Puzzle's Day and Its Way In](packages/sites/arcade/src/entries/README.md#a-puzzles-day-and-its-way-in).

Visual tests are in a `visual-tests/` folder beside the views they test, one
`<view file's name>.test.tsx` for each view, and declare `canvasTest` or
`htmlTest`, from `v-snap` (`packages/libraries/v-snap/`).
A pose returns the view arranged into one state: stand-in bindings (for a
top-level view, a model brought into a state through its actions), and
`advanceTime` for time. Reference images are
beside the tests, named for the test file's stem and the image, such as
`hud-view.at-the-start.png`, so a test needs no `describe` block that only
names its view. See
[Chapter 17, Visual Tests](packages/sites/docs/chapters/17-visual-tests.md), and the
Arcade's test options in [Adding an Entry](packages/sites/arcade/src/entries/README.md#step-6-list-it-and-take-its-thumbnail).

Inside the repo, the libraries resolve to their `src/` (an `@mvtjs/source`
`exports` condition), so the libraries don't need building to run the site or the tests.

Full reference: [Project Structure](packages/sites/docs/working-in-this-repo/project-structure.md)

## The Sites and Their Entries

- **The sites** - three: the arcade (arcade games), the demos, and the puzzles. Each lists its own entries on the same page app, from the site kit, with its own name; the site, not the entry, says whether its entries are games or demos (`SiteConfig.entryKind`). They share one origin, so the visitor's favourites, saved games and settings follow them across
- **Themes** - Arcade, Dark and Light: each site's own (`SITE_THEMES`), or one the visitor chooses for all, kept as `mvt-arcade:theme`. A theme is CSS custom properties (`--theme-*`, in `site-kit/src/arcade/themes.css` and `theme-*.css`), switched by `data-theme` on `<html>`; the page's CSS reads no colour, font, corner or shadow directly. The nav (and the runner's bar and the Perfmon, which take its colours) looks the same in every theme, as it does on the playground and in the docs: its values are `--site-nav-*`, in `site-kit/src/arcade/nav.css`
- **ArcadeEntry** - what a site lists, in `<id>/start/entry.ts`, exported as `entry`: `{ id, name, summary, tags, screenWidth, screenHeight, thumbnail, loadDetails, load }`. What the card shows only, so listing every entry doesn't load any entry's code; `loadDetails()` imports `start/details.ts`, the long text (description, instructions, techniques), which the page loads after its first paint, and `load()` imports `start/load.ts`
- **EntryStarter** - what `load()` returns. A `pixi` starter draws on the host's Pixi stage; an `element` starter brings its own renderers (three.js, Pixi, the DOM, or several) and mounts into an element. Either's `start(...)` returns an **EntrySession**: `{ update(deltaMs), destroy() }`, with `scoring` for a game with a highscore table. A game that uses the arcade controls (a d-pad, two buttons and Restart, held from the keys or the host's touch controls) declares `arcadeControls` on its starter, is passed `controls` as it starts, and wires them in its top-level view with `ArcadeControlsInputView`
- **Top-level names** - every entry's top-level model and view have one name, so they are always easy to find: `GameModel` and `GameView` in a game or puzzle, `DemoModel` and `DemoView` in a demo. A demo with one model and one view just names them that. In a bigger demo, `DemoModel` holds the domain model under its own name (`model.flock`), even if that's all it does. See [Adding an Entry](packages/sites/arcade/src/entries/README.md#step-2-create-models-models)
- **Tags** - one flat list of an era (at most one) and genres: `tags: ['1980s', 'maze']`. The search shows entries with every tag chosen
- **CATALOGUE** - a site's entries, in `packages/sites/<site>/src/entries/catalogue.ts`
- **ArcadeModel** - the search, the tags chosen, and which entry is launching, playing or paused. **ArcadeView** - the card wall, and the transition into and out of an entry. The page (`startSitePage`) starts and stops sessions as the model's phase changes
- To add a game, demo or puzzle: create `packages/sites/<site>/src/entries/<id>/` with its own data/models/views and `start/`, add it to that site's `catalogue.ts`, and follow the [originality rules](packages/sites/arcade/src/entries/README.md#originality). See [Adding an Entry](packages/sites/arcade/src/entries/README.md)

## Key Conventions

- **Barrel imports only** - never import past a directory's `index.ts`, and never import your own or an ancestor's (`.`, `..`): import the file directly; enforced by ESLint `@mvtjs/no-deep-imports` and `no-restricted-imports`. Between packages, import the package name (`@mvtjs/pixi`, `@mvtjs/utils/jsx`): its `exports` are its barrel
- **Declared dependencies** - every import names a dependency of the nearest `package.json` (lint: `import/no-extraneous-dependencies`); add it there rather than relying on npm's hoisting
- **View tick API from the renderer package** - in the site and benchmarks, import `updateView`, `refreshView`, `setUpdate`, `setRefresh`, `SKIP_DESCENDANTS`, `hasUpdate`, `hasRefresh`, the tick counter, the method types and `advanceTime` from the renderer package you use, which re-exports them, not from `@mvtjs/utils` (lint). They are one set of functions for every renderer, so code using two renderers imports them from either
- **No `null`, no `this`** - our own code and APIs never introduce `null` (`undefined` instead). Be explicit where a third-party `null` arrives (`node.parent === null`, a local `T | null`), and convert it (`?? undefined`) before it reaches our own APIs; a declaration that must accept one takes an `eslint-disable` comment saying why. Closures instead of `this`. Lint: `@mvtjs/no-null`, `@mvtjs/no-this`
- **Factory functions, not classes** - `createXxxModel(options)` returns an interface; implementation is a plain record with closure-scoped private state
- **Views are functions** - `XxxView(bindings: XxxViewBindings)`, returning its Pixi container, three.js object or DOM element, usable as a JSX tag and as a plain call; never `createXxxView`, never `props`. The body may be JSX (`.tsx`, `/** @jsxImportSource @mvtjs/pixi */`, or `three` or `html`) or plain TypeScript; MVT doesn't require either, and callers can't tell the difference. JSX tends to suit trees of display objects that follow the model; plain TypeScript tends to suit views that mostly draw, manage their own display objects (pools, ring buffers), or need tight control of per-frame work. See [Code Style: Views and Bindings](packages/sites/docs/working-in-this-repo/code-style.md#views-and-bindings) and [Chapter 12, Writing Views in JSX](packages/sites/docs/chapters/12-writing-views-in-jsx.md#choosing-between-jsx-and-plain-typescript). Top-level views take `{ model }`.
- **Interfaces over implementations** - export the interface type, not the concrete object shape
- **Function-valued properties in types** - `update: (deltaMs: number) => void`, not `update(deltaMs: number): void`, in every interface and type declaration. Enforced by lint (`@typescript-eslint/method-signature-style`)
- **String-literal unions for enums** - `type TileKind = 'empty' | 'wall' | 'dot'`; never use `enum` or const-object patterns
- **`Kind` over `Type`** in type names - avoids overloading the word "type" in TypeScript
- **Functions start with a verb** - `measureLoudness`, `toInt16`, `isAlive`, so a call never reads as a value; views and bindings are named for what they are. A reaction (`createReaction`) is named for its effect, then its trigger: `playPumpSoundWhenInflationRises`, `updateTextureWhenPhaseChanges`, never `playPump`
- **Bindings for reusable views** - leaf views (views of single game objects, HUDs) accept query and relay bindings; a top-level application view's one binding is the model itself, a fixed value (it's application-specific, never reused). Query bindings are named for what they return (`score`, `isAlive`, `tileKindAt(row, col)`), no `get` prefix; relay bindings are `on` + what the user did (`onFirePressed`). A model takes what the player means, never the control: state for a control held (`isThrusting`, not `thrustPressed`), an action for a one-off command (`startNewRun()`, not `restartPressed`), with the wiring saying what each control means (lint: `@mvtjs/no-control-names`). A query binding's type says what the view supports: `() => T` changes, `T` is read once, `ValueOrGetter<T>` is either. Never declare a function and read it only once
- **Sound is a view's job** - an audio view is a view that plays sounds instead of drawing visuals. An entry's only audio view is named `AudioView`; with more than one, each is named for what it plays the sounds of (`EnemyAudioView`). It calls reactions (`createReaction`) in its refresh step and plays on a change, such as a phase beginning or a count rising, never on a state alone. A reaction never reacts to its first read, so a sound for the state that a view starts in, such as a game's opening tune, is played as the view is made. Models expose a count (`shotsFired`) for a moment that repeats, and a reaction with `when: increased` plays each rise. Audio views play on a virtual sound chip from `audio90`: the **Audio80** (4 mono voices, 1980s) or the **Audio90** (16 stereo voices of FM, analog and samples, 1990s). An entry that makes sound names its kind of chip in its starter (`soundChip: 'audio90'`), and makes its `load` with `definePixiLoader` (or `defineElementLoader`), so the chips' types are inferred, and the entry host passes it two chips of that kind: `music`, for its songs, and `sfx`, for its sound effects, each at the listener's volume for it. Views take them as `MusicChip<'audio80'>` and `SfxChip<'audio80'>`, from `@mvtjs/site-kit/sound`, which leave out the host's controls. An entry that doesn't name a chip doesn't get one. Audio90 samples are bounced from the chip's own engines, never recorded, and an entry bounces them in `load` with `prepareAudio90Samples`. Repeating sounds are presentation state, advanced in the update step. Music plays on the chip's own sequencer, on the sound card's clock, so a late frame never holds it up: a view chooses which song plays and how fast, with the music chip's `play`, `queue`, `stop` and `tempoScale`, and each call goes to the chip as it is made. A chip keeps the sound card's time, so the host pauses it as the game pauses (`pause`), and it holds its sound while the page is hidden; a headless chip's clock moves with the ticks (`update`), so tests stay exact. The music chip's `row` and `beat` match what the listener hears. An audio view in a `<List>` plays only on changes that a newly arrived item cannot cause. See [Chapter 20, Sound and Music](packages/sites/docs/chapters/20-sound-and-music.md) and the guides in [packages/libraries/audio90/docs/](packages/libraries/audio90/docs/using-the-audio90.md)
- **`_` prefix** for intentionally unused parameters
- **Tests earn their keep** - weigh each test by its payoff: how likely it is to catch a mistake routine work makes, times what that mistake costs if it got through, against its run time and upkeep. Don't test what a playtest shows at once (a sound per event, initial values, setters), restate a mapping, or copy a tuned value (read the constant). See [Tests Not Worth Writing](packages/sites/docs/chapters/15-testing-models.md#tests-not-worth-writing). A unit test has a budget (2 s, enforced as its timeout); one that needs more is made cheaper (one check over collected results, not an `expect` per cell; a sample of the cases) or moved to a `*.slow.test.ts` file beside it. Unit test files in plain Node share their workers' modules, so a file leaves no global state changed; a file that runs in a page (`@vitest-environment happy-dom`) gets a fresh worker, and so does one listed in `ISOLATED_TESTS` in `vitest.config.ts`, with why
- **Plain writing** - in docs, comments, test names and messages: a friendly, mentoring voice in everyday language (talk to the reader as "you", say why as well as what), short, complete sentences, terms explained where first used, no in-house names in packages. This is the default unless told otherwise. See [Writing Guide](packages/sites/docs/working-in-this-repo/writing-guide.md)
- **4-space indentation**, `lower-kebab-case` file names, `PascalCase` types, `camelCase` everything else
- **A file is named for its main export** - `bounceAudio90Song` in `bounce-audio90-song.ts`, `createScoreModel` in `score-model.ts`; enclosing folders are not part of the name. Prefer one main export to a file; only a small collection of small items takes a collective name (`commands.ts`). Rename the file and its test with the export. See [Code Style: File Naming](packages/sites/docs/working-in-this-repo/code-style.md#file-naming)

Full reference: [Code Style](packages/sites/docs/working-in-this-repo/code-style.md)

## Commands

| Command                | Purpose                       |
| ---------------------- | ----------------------------- |
| `npm run dev`          | One dev server at :5173 for everything: each site's Vite (arcade, demos, puzzles, playground, and VitePress's docs) mounted under its own path. It starts nothing if the port is in use. One site alone: `npm run dev -w @mvtjs/demos` |
| `npm run dev:https`    | The same, over HTTPS, with a self-signed certificate, so a phone on the network gets sound |
| `npm run build`        | Type-check + production build |
| `npm run build:playground` | Build the playground alone, into `dist/playground/` |
| `npm run print -w @mvtjs/docs` | Typeset the book as a PDF, `dist/docs/building-web-games-with-mvt.pdf`, from the built site (run `npm run build` first), with Paged.js in Playwright's headless browser. The deploy prints it too, and publishes it beside the docs |
| `npm run lint`         | Check lint and formatting     |
| `npm run lint:fix`     | ESLint auto-fix pass          |
| `npm test`             | Every test but v-snap's and audio90's own: the unit tests, the slow tests and the visual tests (downloads the browser on first run) |
| `npm run test:unit`    | Every workspace's unit tests but v-snap's and audio90's (Vitest's `unit` and `unit-isolated` projects; no browser): the fast check while working, in seconds. Pass paths after `--` to run some |
| `npm run test:slow`    | The slow tests, `*.slow.test.ts` (Vitest's `slow` project): programs type-checked, games started, a site built, puzzles searched in full. CI runs them on every push |
| `npm run test:watch`   | Every test but v-snap's and audio90's own, in watch mode |
| `npm run test:ui`      | The same, with the Vitest UI in a browser: each test's result, and a failed image's reference, actual image and diff side by side (for people; agents use the commands above) |
| `npm run test:visual`  | Visual tests (the `visual-*` projects, picked by their `visual-tests/` folders, since the vsnap() plugin's projects can't be picked with `-p`): compare each actual image with its reference image, and write a new image as its reference, except in CI (downloads the browser on first run) |
| `npm run test:visual:update` | Also write changed actual images as reference images, and delete orphaned references; look at each before committing. `npx vitest run <test file> -u` for one file |
| `npm run test:vsnap`   | All of v-snap's own tests, unit and visual, from its own config |
| `npm run test:audio90` | All of audio90's own tests, from its own config |
| `npm run test:visual:environment -w v-snap` | Rewrite v-snap's environment fingerprint and calibration images, after a deliberate Playwright upgrade |
| `npm run build:packages` | Build the five libraries for publishing (tsdown, publint, attw), then check their published types. audio90's publint and attw run as it is packed, as v-snap's do |
| `npm run check:*`      | A check of built output, such as `check:view-type-registration` ([packages/internal/checks/](packages/internal/checks/README.md)) |
| `npx changeset` / `npm run release` | Record a change for the changelogs / version a release ([.changeset/](.changeset/README.md)) |
| `npm run bench`        | Performance benchmarks ([packages/internal/benchmarks/](packages/internal/benchmarks/README.md)) |
| `npm run audio:render -- <modules>` | Render a module's songs and sound effects to WAV files, with their peaks and loudness ([packages/libraries/audio90/](packages/libraries/audio90/README.md)) |

## Notes: Proposals and Tasks

The `notes/` directory holds planning material: `proposals/` (designs not yet
implemented), `tasks/backlog/` and `tasks/active/` (a lightweight task board),
and `archive/` (everything finished). Check [notes/README.md](notes/README.md)
for the index and how it works. To pick up a task, move it from `backlog/` to
`active/`, work on it, update its progress log, and move it to `archive/` when
done. Proposals and tasks share one number sequence.

Some design questions are settled, and the index says so. Check it before
reopening one. Whether views need `refresh` as well as `update` is decided in
[092](notes/archive/092-update-and-refresh-or-update-alone/decision.md), and
[Chapter 34](packages/sites/docs/chapters/34-using-the-principles.md#choosing-between-two-designs-that-both-work)
gives the reasons for readers.

## Critical Rules (Do Not Violate)

0. **No em-dashes** - use hyphens instead (lint: `@mvtjs/no-em-dash`, which auto-fixes).
1. **Models must not use wall-clock time.** No `setTimeout`, `setInterval`, `requestAnimationFrame`, or auto-playing GSAP tweens. All state advances through `update(deltaMs)` only, and `update` is synchronous. An action may start async work, such as a load, and its result lands between frames, but a model never uses async code (such as a `delay(ms: number): Promise<void>` helper) to wait for real time to pass: a delay counts down from `deltaMs` in `update`. Every `update`, in models and views, accepts a `deltaMs` of 0: nothing measured in time moves and no per-tick work is done, though it may apply a request or notice a change, so a second `update(0)` changes nothing. Lint (`@mvtjs/no-wall-clock`) checks model files, and `@mvtjs/no-module-state` rejects module-level `let`, which every model the file makes would share. [Chapter 6, Time and Phases](packages/sites/docs/chapters/06-time-and-phases.md)
2. **Views never hold domain state.** No domain logic, no autonomous animations, no internal domain state. Read state from bindings (leaf views) or model properties (top-level application views), write to the presentation output. Views may hold cosmetic presentation state for transitions that the model doesn't track (e.g. a death-flash timer, a smoothed score counter). Such views gain an `update(deltaMs)` step (in this repo, an update method set with `setUpdate`; never forwarded by hand from parent views). `update` advances presentation state only; `refresh` writes all presentation output, including adding and removing display objects. Presentation state starts valid at construction: a view's first `refresh` may come before its first `update`. It's private: a view sees another's only if the owner passes it down through a binding, never up or sideways, and the owner moves it on. `deltaMs` is a view's only source of time. A view never reads back what it wrote, and keeps its state in variables, not on display objects, though either step may take a measurement on a change. `refresh` works with no time involved, gives the same result if called twice, and may remember what it drew. When the presentation logic is complex enough to warrant separate testing, extract it into a view model - the view creates and owns it internally. [Chapter 11, Presentation State](packages/sites/docs/chapters/11-presentation-state.md)
3. **Never import past a barrel file.** All cross-directory imports go through `index.ts`. Within the same directory, use direct relative paths (`./foo`). Never import your own or an ancestor's barrel (`.`, `..`): from a subdirectory, import the ancestor's file directly (`../element-mixin`). [Project Structure](packages/sites/docs/working-in-this-repo/project-structure.md)
4. **No classes.** Use factory functions returning plain records that satisfy an interface. [Code Style: Factory Functions](packages/sites/docs/working-in-this-repo/code-style.md#factory-functions)
5. **Hot-path awareness.** `update()` and `refresh()` run every tick (~60fps). Avoid per-tick allocations: no `array.map()`, no template-string keys, no `for...of` on arrays, no inline closures. Use index-based `for` loops and pre-allocated structures. [Chapter 24, Hot Paths](packages/sites/docs/chapters/24-hot-paths.md)
6. **Model coordinates must be domain-level, not pixels.** Grid-based game objects expose fractional `row`/`col`/`direction` - not `x`/`y` in pixels. Views compute pixel positions from domain coordinates. [Chapter 4, Models](packages/sites/docs/chapters/04-models.md#domain-coordinates)
7. **Games and demos are original.** Inspired by a classic is fine; copying is not. No other game's titles (except the credit in an entry's `inspiredBy`), character names or designs, artwork, music or level layouts, and all art is drawn from scratch in the repo (a `packages/sites/<site>/scripts/generate-*-textures.ts` script, or the views). [Originality](packages/sites/arcade/src/entries/README.md#originality)
8. **Models never change while views update or refresh.** A view's steps never change a model, directly or through a relay. A relay fires outside the frame: from an event the browser delivers, from `queueMicrotask` for something noticed during a tick and timed in game time, or from a helper, such as a view model, that does one of these. An event your own code causes during a tick, such as `.focus()` in a refresh, must not fire a relay. A recognised gesture's timer isn't presentation state, though it lives in a view: it decides when the gesture is reported, so it's part of handling input. [Chapter 8](packages/sites/docs/chapters/08-bindings.md#relay-bindings-and-input-handling), [Chapter 18](packages/sites/docs/chapters/18-growing-a-complex-view.md#example-a-press-that-turns-into-a-hold)

Full rules: [Appendix A, MVT on One Page](packages/sites/docs/appendices/a-mvt-on-one-page.md)

## File Organisation Within a Module

Each model/view file follows this internal ordering (view files name the
first section `Bindings` and the third `View`):

1. **Interface** - public interface definition
2. **Options** - options type for the factory function (if needed)
3. **Factory** - createXxx() factory function implementation (views: the XxxView function)
4. **Internals** (if needed) - internal types, constants, and helpers used only inside this file

Each section starts with a banner, the section's name between two rules:

```
// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------
```

## Skills

Load the relevant skills file for task-specific instructions:

| Task                       | Skills file                                              |
| -------------------------- | -------------------------------------------------------- |
| Writing a new model        | [packages/sites/docs/ai-agents/skill-mvt-model.md](packages/sites/docs/ai-agents/skill-mvt-model.md) |
| Writing a new view         | [packages/sites/docs/ai-agents/skill-mvt-view.md](packages/sites/docs/ai-agents/skill-mvt-view.md)   |
| Following code conventions | [packages/sites/docs/ai-agents/skill-code-style.md](packages/sites/docs/ai-agents/skill-code-style.md) |
| Reviewing code             | [packages/sites/docs/ai-agents/skill-code-review.md](packages/sites/docs/ai-agents/skill-code-review.md) |
| Updating documentation     | [packages/sites/docs/ai-agents/skill-documentation.md](packages/sites/docs/ai-agents/skill-documentation.md) |

## Documentation

The docs are a book, *Building Web Games with MVT*, plus pages for working in
this repo. The reading order is in `packages/sites/docs/.vitepress/book.ts`.

| Section | Content |
| --- | --- |
| [Preface](packages/sites/docs/index.md) | What the book teaches, who it's for, and MVT in a paragraph |
| [Chapters](packages/sites/docs/chapters/) | `01-games-in-the-browser.md` to `34-using-the-principles.md`, in seven parts, then `conclusion.md`: MVT taught once, in reading order, each idea in one chapter (its home). Part VII is the eight principles, a chapter each, introduced by [Chapter 25](packages/sites/docs/chapters/25-the-eight-principles.md) |
| [Appendices](packages/sites/docs/appendices/) | [A, MVT on One Page](packages/sites/docs/appendices/a-mvt-on-one-page.md) (every rule), B Glossary, C Measurements, D Measuring Performance, E Timelines with GSAP, F Troubleshooting, G API Cheat Sheets, H MVT Beyond the Web |
| [Working in This Repo](packages/sites/docs/working-in-this-repo/) | [Code Style](packages/sites/docs/working-in-this-repo/code-style.md), [Project Structure](packages/sites/docs/working-in-this-repo/project-structure.md), and the [Writing Guide](packages/sites/docs/working-in-this-repo/writing-guide.md) (the voice for all prose, and each idea's home) |
| [Agent skills](packages/sites/docs/ai-agents/index.md) | The skills files above (not published) |

## Tech Stack

TypeScript 5.9 - Pixi.js 8 - three.js (one demo) - GSAP 3 - Vite 8 - Vitest 5 - ESLint 9 - ESLint Stylistic

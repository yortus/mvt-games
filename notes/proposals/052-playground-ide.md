# Proposal: A Playground That Works Like a Small IDE

> The playground today is two text boxes, Model and View, with the imports
> cut out by a regular expression and a fixed list of globals put in their
> place. It has no types, no completions and no files, so the code written
> in it looks nothing like the code in the repo, and nothing typed there can
> be moved into the repo without rewriting it. This proposal makes it a
> small IDE in the browser, in the spirit of CodePen: a project of real
> TypeScript files (a short `main.ts`, with `models/` and `views/` beside
> it), real `import` statements between them and from the MVT libraries,
> completions, hover, type errors and go to definition from the TypeScript
> language service in a worker, and a sandbox that runs each file as a real
> ES module. It stays focused. It runs MVT projects on Pixi, the DOM or
> three.js, with a fixed set of libraries, and nothing else: no npm, no
> terminal, no build settings. The playground moves out of the website into
> a package of its own, `packages/sites/playground/`, and the website, which is
> then the Arcade and nothing else, is renamed `packages/sites/arcade/`.

**Status:** proposed, and spiked (section 16). The spike confirmed the
runtime, the sandbox and the editor in Chromium, Firefox and WebKit, and
changed four details: a cheaper loop guard (5.5), gzip for share links
(7.3), the editor's own glue to the language service (6.2), and a `CORS`
file for the test deploy (13). The rest of the design stands. Step 2, the
rename of the website to the Arcade, is done (section 15). Nothing else is
built beyond the spike, but step 3: the new package is the playground, at
`/playground/`, and the old one is gone.

**Written:** 2026-10-16, against `vnext` at `81900f5`. Checked against the
playground as built
([`index.ts`](../../packages/sites/arcade/src/playground/index.ts),
[`editor-panel.ts`](../../packages/sites/arcade/src/playground/editor-panel.ts),
[`presets.ts`](../../packages/sites/arcade/src/playground/presets.ts),
[`url-state.ts`](../../packages/sites/arcade/src/playground/url-state.ts),
[`compile.ts`](../../packages/sites/arcade/src/playground/sandbox/compile.ts),
[`sandbox-host.ts`](../../packages/sites/arcade/src/playground/sandbox/sandbox-host.ts),
[`sandbox-runner.ts`](../../packages/sites/arcade/src/playground/sandbox/sandbox-runner.ts)),
its pages ([`playground/index.html`](../../packages/sites/arcade/playground/index.html),
[`playground/sandbox.html`](../../packages/sites/arcade/playground/sandbox.html)),
the entry types
([`entry-starter.ts`](../../packages/sites/arcade/src/entry-types/entry-starter.ts)),
an entry's start code
([`crumb-chase/start/load.ts`](../../packages/sites/arcade/src/entries/crumb-chase/start/load.ts)),
the docs' links into it
([`PlaygroundLink.vue`](../../packages/sites/docs/.vitepress/components/PlaygroundLink.vue)),
the lint rules that fence it off
([`eslint.config.ts`](../../eslint.config.ts)), the website's build
([`vite.config.ts`](../../packages/sites/arcade/vite.config.ts),
[`package.json`](../../packages/sites/arcade/package.json)), the root scripts
([`package.json`](../../package.json)) and the deploys
([`deploy.yml`](../../.github/workflows/deploy.yml),
[`deploy-highscores.yml`](../../.github/workflows/deploy-highscores.yml)).
Checked again the same day against `b32f67b`, after the packages were
grouped into `libraries/`, `tools/`, `sites/` and `tests/`: the
playground's code is unchanged, and only its paths moved. The paths here
are the grouped ones, and the new packages are placed in `sites/`. The
sizes and counts that say "measured" were read from the repo and
`node_modules` at `b32f67b`. The spike (section 16) ran the same day, in a
worktree at `b32f67b`, and its sizes and times replace the estimates the
first draft had.

**Related:**
[036](../archive/036-website-arcade.md) (the Arcade, and the entry shape a project can be ported to) -
[045](../archive/045-sound-chip.md) (the Audio80, which a project's views can play) -
[051](./051-audio90-chip.md) (entries choosing their chip, which a project would follow) -
[011](../archive/011-multi-package-repo.md) (the workspace of packages that this adds one to) -
[017](../tasks/backlog/017-misc-loose-ends.md) (old playground links that assign `view.onRefresh`) -
[047](../tasks/backlog/047-pixel-art-as-multiline-strings.md) (pixel art in code, which suits a playground with no image files) -
[050](../tasks/backlog/050-visitor-analytics.md) (which pages report visits) -
[Project Structure](../../packages/sites/docs/reference/project-structure.md) -
[Quickstart](../../packages/sites/docs/building-with-mvt/quickstart.md) (links into the playground) -
[Adding an Entry](../../packages/sites/arcade/src/entries/README.md)

---

## Summary

| # | Decision | Recommendation | Section |
| --- | --- | --- | --- |
| 1 | What the playground is for | Writing and sharing small MVT projects, the way the repo writes them. Not a general web IDE | [3](#3-scope-what-it-is-and-what-it-is-not) |
| 2 | What a project is | Up to 40 files, `.ts`, `.tsx` and `.css`: a `main.ts` at the top, with `models/`, `views/` and `data/` beside it. No `package.json`, no `tsconfig.json`, no image files | [4](#4-a-project) |
| 3 | How a project starts | `main.ts` exports a `project`, made with `definePixiProject`, `defineHtmlProject` or `defineThreeProject`. Its `start` is given a stage, an element or a scene, builds the views, and returns what to tick, usually the model itself. Much simpler than an Arcade entry's starter, on purpose | [4.2](#42-the-start-file) |
| 4 | What a project can import | Its own files, by relative path, a small `playground` module for the `define` functions, and a fixed list of libraries: `@mvtjs/utils`, `@mvtjs/pixi`, `@mvtjs/html`, `@mvtjs/three`, `@mvtjs/audio`, `pixi.js`, `three` and `gsap`, at the versions the Arcade runs. Anything else is an error in the editor, before Run | [4.3](#43-what-a-project-can-import) |
| 5 | How code runs | Each file is transpiled by Sucrase (types stripped, lines kept), its relative imports are rewritten to names in an import map, and each file becomes a blob URL. Every Run is a fresh iframe document, so modules never go stale | [5.2](#52-from-files-to-modules) |
| 6 | Where code runs | An iframe with an opaque origin (`sandbox="allow-scripts"`, no `allow-same-origin`). The site's storage is out of its reach, so a shared link can run as it opens, as CodePen's do | [5.4](#54-the-sandboxs-origin-and-why-shared-links-can-run-as-they-open) |
| 7 | Runaway loops | Every loop is given a cheap guard as it is transpiled, which throws after a second without a frame, naming the file and line | [5.5](#55-runaway-loops) |
| 8 | The editor | CodeMirror 6, which the playground has now, with tabs and a file tree. Not Monaco: Monaco is several times larger and poor on phones | [6.1](#61-codemirror-not-monaco) |
| 9 | Intellisense | The TypeScript language service in a web worker, over a virtual file system of the project, the DOM's types and the libraries' types. Completions with auto-imports, hover, signature help, type errors, go to definition, rename, organise imports. It loads after the editor, and Run never waits for it | [6.2](#62-a-typescript-language-service-in-a-worker) |
| 10 | The libraries' types | Generated at build time from the packages' sources (and `node_modules` for Pixi, three.js and GSAP), one file per library, fetched the first time a project imports it | [6.3](#63-types-for-the-libraries) |
| 11 | Saving and sharing | Projects saved in IndexedDB, several by name. A share link holds the compressed files in the URL's hash, as now. Export downloads a zip that is a ready Vite project | [7](#7-projects-examples-and-sharing) |
| 12 | The examples | Real files in the repo, one folder each, so the repo's type check, lint and tests cover them. The presets' 992 lines of code in strings go | [7.2](#72-examples-are-real-files-in-the-repo) |
| 13 | Old links | `#preset=` links, which the docs use, open the matching example. `#code=` links are converted to a project on open | [7.4](#74-old-links-keep-working) |
| 14 | The playground's own code | Rebuilt in MVT, as the Arcade is: a model of the project, the tabs and the run, and HTML JSX views | [8](#8-the-playground-built-with-mvt) |
| 15 | Where it lives | A private package of its own, `packages/sites/playground/` (`@mvtjs/playground`), built on its own into `dist/playground/` and proxied in dev, as the docs are. The lint rules that fence it off today go, since the package boundary does their job | [9.2](#92-the-playground-package) |
| 16 | The website package | Renamed `packages/sites/arcade/` (`@mvtjs/arcade`), since without the playground it is the Arcade, its entries and its highscores Worker. A mechanical step of its own, before the playground work | [9.3](#93-the-website-becomes-the-arcade) |
| 17 | Later | Things only an MVT playground can do: swap the views while the model keeps running, a tool that ports a project into an Arcade entry, the architecture's lint rules as live diagnostics, embeds for the docs, and remixing an Arcade entry. Each is its own step after the rest has shipped | [10](#10-later-what-only-an-mvt-playground-can-do) |
| 18 | What the spike found | The runtime, the sandbox and the editor work in Chromium, Firefox and WebKit. Loop guards cost 1-3% once counted loops are left out. Intellisense for a Pixi project downloads 1.7 MB gzipped, after the editor is in use. Desktop meets every target; a phone-ish profile misses two | [16](#16-spike-results) |

---

## 1. Why, and What Done Looks Like

The playground is the first place many people will write MVT code. The
quickstart links into it, and so do the pages on models and views. What
they find there is not the MVT the docs teach. The docs say "barrel imports
only" and show a `models/` folder with an `index.ts`. The playground has no
folders and no imports. The docs say views are functions named for what
they are (`BallView`). The playground requires a function named
`createView`. The docs show `/** @jsxImportSource @mvtjs/pixi */` at the
top of a view. The playground strips that line out with the rest of the
imports and compiles JSX to a global `h`. And none of it is checked: a typo
in a property name shows up as `undefined` at run time, with no squiggle.

A visitor who gets something working there then has nowhere to take it. The
code depends on globals that only the sandbox provides, so it will not run
in a Vite project without edits on every line that names `Graphics` or
`setRefresh`.

**The goals:**

- **The repo's code, in the browser.** A model or view in the playground
  is written exactly as one in the repo is: the same imports, the same
  folders, the same JSX pragma, the same types.
- **An editor that knows the code.** Completions, hover, type errors and
  go to definition, for the project's own code and for the libraries it
  imports.
- **Focused, and small to start.** One kind of project, a fixed set of
  libraries, no settings to get wrong. A bouncing ball is three short
  files. Opening the playground and pressing Run is all it takes.
- **Safe to share.** A link to a project runs as it opens, and the code it
  runs cannot read or change anything the site keeps for the visitor.
- **A way out.** A project can be exported as a Vite project and run
  unchanged. Later, a tool ports one into an Arcade entry (section 10.2).

**Done looks like:** a visitor opens `/playground/`, and the Bouncing Ball
example runs. Its files are listed on the left: `main.ts`,
`models/ball-model.ts`, `models/index.ts`, `views/ball-view.tsx`,
`views/index.ts`. They open `views/ball-view.tsx`, type `model.` and see
`x`, `y`, `radius` and `held`, each with its doc comment. They type
`<Grap` and the completion adds `Graphics` to the file's Pixi import. A
misspelt property is underlined in red before they press Run. They add a
file, `models/wind.ts`, import it from the model, and the ball drifts. They
press Share, paste the link into a chat, and a friend's browser opens the
project and runs it. They press Export, unzip, run `npm install` and
`npm run dev`, and the same ball bounces on their own machine. Every
`PlaygroundLink` in the docs still opens the example it names. In the repo,
the playground is `packages/sites/playground/`, and the site it sits in is
`packages/sites/arcade/`.

---

## 2. What the Playground Is Today

These are the facts the design starts from, as of `b32f67b`.

| What | How it is done now | What it costs |
| --- | --- | --- |
| Files | Two CodeMirror editors, Model and View, in tabs ([`editor-panel.ts`](../../packages/sites/arcade/src/playground/editor-panel.ts)) | No way to split code into files, so presets put a model's helpers, constants and types in one buffer |
| Imports | Removed by a regular expression before transpiling ([`compile.ts`](../../packages/sites/arcade/src/playground/sandbox/compile.ts), `transpile`) | Code written in the playground cannot import anything, and code copied from the repo has its imports silently dropped |
| What code can use | A fixed list of globals: eight Pixi classes, the tick API, `watch`, `setBackground`, and the JSX runtime's `h`, `Fragment`, `List`, `Switch` and `Match` ([`sandbox-runner.ts`](../../packages/sites/arcade/src/playground/sandbox/sandbox-runner.ts), `createUserGlobals`). A banner above the editor lists them | Nothing outside the list is reachable: no `@mvtjs/utils` tweens, no `SlotList`, no three.js, no HTML JSX, no sound. `watch` is a separate copy written for the sandbox |
| How it starts | The model's code must declare `createModel`, and the view's `createView(model)`, found by name after `new Function` evaluates each buffer | The names differ from the repo's conventions (`createXxxModel`, `XxxView`). One model and one view, always |
| JSX | Sucrase's classic transform, calling a global `h`, adapted to the runtime's `jsx` | Differs from the repo, which uses the automatic runtime and a pragma |
| Types | None. CodeMirror's JavaScript mode, with TypeScript syntax highlighting | No completions, no hover, no type errors |
| Renderer | Pixi only | The DOM and three.js, which the libraries support, cannot be tried |
| Sandbox | An iframe with `allow-scripts` and `allow-same-origin` ([`sandbox-host.ts`](../../packages/sites/arcade/src/playground/sandbox/sandbox-host.ts)) | It shares the site's origin, so code in it can read and write the site's storage: settings, favourites, saved games. That is why a shared link loads its code but does not run it ([`index.ts`](../../packages/sites/arcade/src/playground/index.ts)) |
| Runaway loops | The host pings the sandbox every 3 seconds, and replaces the iframe if no reply comes | A same-origin iframe runs on its parent's thread. A loop that never ends freezes the whole page, the host's timer included, so the watchdog never fires |
| Presets | Eight examples, as code in template strings, 992 lines ([`presets.ts`](../../packages/sites/arcade/src/playground/presets.ts)). Each calls `setBackground` once, with a fixed colour | Not type-checked, and exempt from lint ([`eslint.config.ts`](../../eslint.config.ts)). They drifted once already: links saved before task 028 assign `view.onRefresh` and never animate (017) |
| Saving | One project in `localStorage`, "Custom Project" | One slot. Choosing an example and coming back is the only way to keep two things |
| Sharing | lz-string compressed JSON of both buffers in the hash (`#code=`), or `#preset=<id>` ([`url-state.ts`](../../packages/sites/arcade/src/playground/url-state.ts)) | Works well, and is kept (section 7.3) |
| Controls | Run, Stop, Pause, Step, Reset, a speed slider, and the canvas size ([`controls-panel.ts`](../../packages/sites/arcade/src/playground/controls-panel.ts)) | Good, and kept. The canvas size moves into the project (section 4.2) |
| Where it lives | In the website package, `src/playground/`, fenced from the rest of the site by two lint rules ([`eslint.config.ts`](../../eslint.config.ts)). Its page loads the site's `src/shared/nav.css` | CodeMirror's five packages, Sucrase and lz-string are in the website's `package.json`, and nothing else in the website uses them (measured). The fence is a convention, kept by lint, with one crossing: the nav's CSS |
| Its own code | Imperative DOM building, about 3,800 lines with the CSS, and no tests but `compile.test.ts` | Hard to extend, and unlike the rest of the site |

---

## 3. Scope: What It Is, and What It Is Not

CodePen is the model to follow, more than StackBlitz or VS Code for the
web. CodePen is useful because it has almost no settings: three panes, a
preview, a share button. This playground should feel the same, with files
and types added because MVT code needs them.

### 3.1 In

- Projects of TypeScript and TSX files, with a little CSS for HTML views.
- The MVT libraries, and the three third-party libraries the Arcade's
  entries use (Pixi, three.js, GSAP), at the Arcade's own versions.
- Pixi, HTML and three.js projects, one renderer to a project.
- Sound on the Audio80 (and the Audio90, if 051 lands), given to the
  project's `start`.
- Completions, hover, signature help, type errors, go to definition,
  rename and organise imports.
- Run, Stop, Pause, Step, speed, and a console.
- Saved projects, share links, export to a Vite project.

### 3.2 Out

Each of these was considered and left out. Do not reopen without new
information, such as visitors asking for one in numbers.

| Left out | Why |
| --- | --- |
| Any npm package (through esm.sh or a similar CDN) | It is the step that turns a focused tool into a general one. It also brings versions the site has never run, types that must be fetched from a third party, and failures that are not the visitor's code or ours |
| `package.json`, `tsconfig.json`, Vite settings | Nothing to configure is the point. The project's compiler settings are the repo's (strict, ES2022, bundler resolution), fixed |
| The Arcade's entry shape (`start/load.ts`, starters, sessions) | Built for the Arcade's needs: async loading, fitting to the screen, touch controls, highscores, saved games, teardown. A playground project needs none of them, and a bouncing ball should not have to spell them out. The port to an entry is a tool's job (section 10.2) |
| Two renderers in one project | The Arcade's `element` entries do it. It needs the project to own its renderers, which brings back the settings and teardown this design avoids |
| A terminal, Node, WebContainers | Nothing in an MVT project needs a server. WebContainers is also a commercial licence and a large download |
| Image, audio and font files | The repo's art is drawn in code (the originality rules), and its sound is played on the chip. A playground that accepts files would need storage, size limits and moderation that share links cannot carry. Pixel art written as strings (047) covers the need |
| Several people editing one project at once | A server, accounts and conflict handling, for a tool of this size. Share links are enough |
| Git, branches, history across sessions | Export covers moving a project into a real repo. Undo within a session is CodeMirror's |
| A service worker that serves the project's files | A service worker needs the sandbox to share an origin with something we control, which section 5.4 gives up on purpose. Blob URLs and an import map do the same job (section 5.2) |
| Running on a server (a build service) | The site is static, on GitHub Pages, and should stay so. Everything runs in the visitor's browser |

---

## 4. A Project

### 4.1 Files and folders

A project is a set of files with paths:

```
main.ts          Required. Exports the project: what to build, and what to tick
models/          State and domain logic, with an index.ts barrel
views/           Presentation, with an index.ts barrel
data/            Constants and static data, optional
```

The folders are a starting point, not a fence. A tiny project may keep
everything in `main.ts` and one view file, and a larger one may add a
folder, such as `utils/`. The new-file dialog suggests the three folders.
`main.ts` is the one fixed path.

File kinds are `.ts`, `.tsx` and `.css`. A `.css` file is imported for its
effect (`import './card.css'`), and the sandbox adds it as a `<style>`
element (section 5.2). There is no `index.html`: the sandbox owns the
document.

The project also records a few things that are not files: its name, when
it was last changed, and which files are open. These live beside the
files in storage and in a share link (section 7), not in a file the visitor
edits.

### 4.2 The start file

`main.ts` is meant to be short: make the models, build the views, and hand
back what the playground should tick.

```ts
import { definePixiProject } from 'playground';
import { createBallModel } from './models';
import { BallView } from './views';

export const project = definePixiProject({
    width: 400,
    height: 300,
    background: 0x0a1628,
    start: ({ stage }) => {
        const model = createBallModel({ width: 400, height: 300 });
        stage.addChild(BallView({ model }));
        return model;
    },
});
```

**`start` returns what to tick.** Anything with an `update(deltaMs)`
method: usually the model itself, as above. A project with two models
returns `{ update: (deltaMs) => { ... } }` that updates both. A project
with no model, a pure visual toy, returns nothing. Each frame, the
playground calls that `update`, then updates and refreshes the views, then
draws. That is the whole MVT loop, and `main.ts` shows all of it in a dozen
lines.

**One `define` function for each renderer:**

| Function | `start` is given | The playground ticks and draws | Options |
| --- | --- | --- | --- |
| `definePixiProject` | `stage`, a Pixi container; `sound` | `updateView` and `refreshView` over the stage, then Pixi renders, scaled to fit the preview | `width`, `height`, `background`, `pixelArt` |
| `defineHtmlProject` | `root`, an element that fills the preview; `sound` | `updateView` and `refreshView` over the root | `width`, `height` (optional; the root fills the preview without them) |
| `defineThreeProject` | `scene`, a three.js scene; `camera`, a perspective camera the project may move; `sound` | `updateView` and `refreshView` over the scene, then a WebGL renderer draws it with the camera | `width`, `height`, `background` |

The `define` functions return their argument with the renderer noted.
They exist so that `start`'s parameter has its type without an annotation,
as Vite's `defineConfig` does: `stage.` completes with Pixi's container
methods from the first keystroke. They are the `playground` module's only
code, a few lines, and the sandbox's import map includes it (section 4.3).

**What it leaves out.** No `destroy`: each Run throws the document away
(section 5.1), so nothing needs tearing down. No `async` loading: a
project that builds textures does so in `start`, which may return a
promise. No touch controls, no highscores, no saved games, no fitting to
the screen: the project reads the keyboard and the pointer itself, at the
size it chose. Swapping views while the model runs (section 10.1) is the
one later feature that would add something here.

**Why not the Arcade's starter.** An earlier draft of this proposal used
it: `start/load.ts`, an async `load()`, a starter with a `kind`, a session
with `update` and `destroy`. It made porting to the Arcade trivial, and
everything else heavier. Most playground projects are a single idea, never
meant for the Arcade, and the Arcade's shape is for what the Arcade needs
(section 3.2). A port tool can bridge the two for the few projects that
grow up (section 10.2).

### 4.3 What a project can import

| Specifier | What it gives |
| --- | --- |
| `./x`, `../x/y` | The project's own files. Extensions are optional, and a folder resolves to its `index.ts`, as TypeScript's bundler resolution does |
| `playground` | `definePixiProject`, `defineHtmlProject`, `defineThreeProject`, and their types |
| `@mvtjs/utils`, `@mvtjs/utils/jsx` | The renderer-agnostic helpers, and the JSX base |
| `@mvtjs/pixi`, `@mvtjs/pixi/jsx-runtime` | The tick API for Pixi, and its JSX runtime |
| `@mvtjs/html`, `@mvtjs/html/jsx-runtime` | The same for the DOM |
| `@mvtjs/three`, `@mvtjs/three/jsx-runtime` | The same for three.js |
| `@mvtjs/audio` | The Audio80's types and notation. The chip itself is given to `start` as `sound` |
| `pixi.js`, `three`, `gsap` | The libraries, at the versions the Arcade declares |

The list lives in one place in the playground's code, and both the editor
and the sandbox read it. An import of anything else is a diagnostic as it
is typed: "The playground provides `@mvtjs/utils`, `@mvtjs/pixi`, ... Other
packages cannot be imported." Run refuses a project with such an import,
and says the same.

The libraries are built from the workspace's own sources at the same
commit as the Arcade (section 9.2), so the playground runs the code the
Arcade runs, and a change to a library shows up in both in the same
deploy. Whether to also pin a project to a version, so an old share link
keeps running after a breaking change, is an open question (section 14).
Today's links break silently on such a change (017's `view.onRefresh`), so
the new design is no worse.

### 4.4 Limits

| Limit | Value | Why |
| --- | --- | --- |
| Files | 40 | Enough for a small game. The Arcade's largest entries have more, and do not belong in a share link |
| One file | 100 KB | A file larger than this is almost always data pasted in by mistake |
| The whole project | 300 KB | Gzipped and written in URL-safe base64, that is about 90 KB of URL, near the most a chat app or a browser's address bar handles well. Section 7.3 |

The spike measured the Arcade's entries' code (section 16.4): from 8 files
and 16 KB (the 3D boids) to 68 files and 206 KB (the fruit machine), and
238 KB for the largest, Neon Monsoon. So 300 KB takes in every entry but
two of them by size, and 40 files all but four. Both limits stay.

---

## 5. Running a Project

### 5.1 One fresh document per run

Every Run creates a new sandbox iframe and drops the old one. It is the
only clean way to re-run ES modules: a document caches each module by URL
and never loads it twice, and blob URLs from the last run would leak
otherwise. A fresh document also resets everything a project may have
touched: event listeners on `window`, timers, WebGL contexts, the Audio80's
voices. It is also why `main.ts` needs no `destroy`.

Making an iframe and loading Pixi into it is the cost. The library bundles
come from the browser's HTTP cache after the first run, and the module
graph is small. The spike measures the time from Run to the first frame;
the target is under 300 ms on a mid-range laptop for a cached Pixi project
(section 11).

### 5.2 From files to modules

The host page prepares the project, and sends the sandbox a list of
modules ready to run. The steps, for each file:

1. **Transpile** with Sucrase, as now: TypeScript types stripped, and in a
   `.tsx` file, JSX compiled with the **automatic** runtime, so it imports
   `jsx` from `<source>/jsx-runtime` as the repo's code does. Sucrase takes
   the import source as an option and does not read the
   `@jsxImportSource` pragma, so the playground reads the pragma from the
   file's leading comment and passes it in. A `.tsx` file without one gets
   the project's renderer as its import source (from the `define` function
   `main.ts` calls), so a Pixi project's views need no pragma, though one
   is allowed. Sucrase keeps every line where it was, so a line number in
   an error is a line number in the editor (section 5.6).
2. **Guard loops** (section 5.5).
3. **Rewrite imports.** `es-module-lexer` finds every import and export
   specifier, static and dynamic. A relative specifier is resolved against
   the file's path, to the project file it names (trying `.ts`, `.tsx`,
   and `/index.ts`), and replaced with a bare name for it, such as
   `project:models/ball-model.ts`. A `.css` import is replaced by a call
   that adds the stylesheet. A library's specifier is left alone. Sucrase
   has already dropped any import the file never uses, as TypeScript does,
   so an unused import of an unknown package passes Run without harm. The
   editor still underlines it, since the language service cannot find the
   module (found in the spike, section 16.1).
4. **Name the file** with a `//# sourceURL=` comment carrying its path, so
   the browser's devtools and stack traces show `models/ball-model.ts`, not
   a blob URL. Chromium and Firefox use it in `error.stack`; WebKit does
   not, and names `blob:null/<id>`. So the sandbox also replaces each blob
   URL in a stack with its file's path, which works in every browser.

The sandbox then makes a blob URL for each module, writes an **import
map** that maps each `project:` name to its blob URL and each library to
its bundle (section 5.3), and imports `main.ts`. Mapping names, not URLs,
is what lets files import each other in a cycle: every blob URL exists
before the import map is written, and no file's text holds another's URL.
Real ES modules give the visitor what they would get in Vite: live
bindings, cycles, top-level `await`, and modules that run once.

Which renderer a project uses is known only once `main.ts` has run, since
it is the `define` function `main.ts` calls. The host reads the name of
that function from `main.ts`'s imports before Run, to set the default JSX
source in step 1 and to load only the matching renderer's types (section
6.3). If it cannot tell, it falls back to Pixi, and the run itself is
still correct.

Sucrase stays, though TypeScript is loaded for the language service
(section 6.2). Sucrase is small, is already in the bundle, transpiles a
project in a few milliseconds, and keeps line numbers. It means Run does not
wait for the language service to load, and works if it fails to.

The work in steps 1-4 is plain functions of strings, with no DOM, so it is
tested in Node (section 12).

### 5.3 The libraries in the sandbox

The playground's build adds an entry for each library in section 4.3, so
Vite emits each as its own ES module chunk with a hashed name, and writes a
small manifest from specifier to URL. The sandbox's import map is built
from that manifest. `@mvtjs/pixi` and `pixi.js` are one Pixi between them,
because the import map gives every module the same URL for `pixi.js`.

In the dev server, the same manifest maps each library to Vite's own module
URL, so editing a library in the repo shows up in the playground on the
next Run.

### 5.4 The sandbox's origin, and why shared links can run as they open

The new iframe is made with `sandbox="allow-scripts"` and **without**
`allow-same-origin`, and its document comes from `srcdoc`. The browser then
gives it an **opaque origin**: an origin equal to no other, not even
another opaque one. Code in it cannot read the site's `localStorage`,
IndexedDB or cookies, cannot reach into the parent page, and talks to the
host only through `postMessage`.

That is what lets a shared link run as it opens, as CodePen's do. Today the
playground loads a shared project and waits for the visitor to press Run,
because the code could otherwise read or change the visitor's settings,
favourites and saved games (see the comment in
[`index.ts`](../../packages/sites/arcade/src/playground/index.ts)). With an
opaque origin, the worst a project can do is the worst any web page can do
inside its own tab.

**What an opaque origin costs, as the spike found (section 16.1):**

| Concern | Answer |
| --- | --- |
| Is the sandbox still a secure context, with `AudioWorklet`? | Yes, in all three browsers: its origin is `null`, and it is secure, as its parent is |
| Module scripts from an opaque origin are cross-origin requests, which need CORS | GitHub Pages sends `Access-Control-Allow-Origin: *` on every response, pages and assets alike (read from the live site). Surge, the test deploy, sends none, and without it the libraries fail to load; a file named `CORS` holding `*` at the root of what Surge publishes turns it on (section 13). The playground's Vite dev server needs `server.cors` set to `{ origin: '*' }` |
| The Audio80's worklet module is loaded with `addModule`, also cross-origin | It loads, and the chip's clock runs, in Chromium and Firefox, in development and in the build. Chromium starts the sound only with `allow="autoplay"` on the iframe, so the Run click in the parent counts; without it, the audio context stays suspended. Firefox starts it either way |
| A project that uses `localStorage` | It throws. That is acceptable: the playground is for MVT code, and the console says why |
| Pixi's devtools extension found `__PIXI_APP__` through the parent ([`sandbox-host.ts`](../../packages/sites/arcade/src/playground/sandbox/sandbox-host.ts)) | The bridge stops working. The extension can still be pointed at the iframe. Worth a line in the playground's help |
| Keyboard focus | Unchanged: the host focuses the iframe on Run, as now |

### 5.5 Runaway loops

A loop that never ends is the most common way to break a playground. With
a same-origin iframe today it freezes the whole tab. An opaque-origin
iframe may run in a process of its own in some browsers (Chrome is moving
sandboxed iframes into their own processes), but not in all, so the
playground cannot rely on it. In the spike, it shared the page's thread in
all three browsers: a three-second loop in the sandbox froze the parent
page for three seconds (section 16.1).

The fix CodePen uses works here too. As a file is transpiled, each loop
gets a guard at the top of its body, on the same line, so line numbers
hold. The guard counts down a budget kept in the module. When the budget
runs out, every 4096 turns, it calls a check, which refills it and compares
`performance.now()` with the time the current frame or `start` began. Past
one second, the check throws an error that names the file and the line of
the loop.

**Counted loops go unguarded.** A loop of the form
`for (let i = 0; i < n; i++)` ends by itself, as long as `n` is a name or
a number and the body assigns neither `i` nor `n`. The test may also go on
with `&&` (`i < n && isEmpty(c)`), and the step may be `--`, `+=` or `-=`.
These are the hot loops of most games, and leaving them out is what makes
the guards cheap. A bound such as `arr.length` stays guarded, since a body
that pushes onto `arr` is a classic loop that never ends.

**What it costs**, measured on the falling-sand demo's model, the hottest
loops in the repo (section 16.2): guarding every loop made the model 15-19%
slower; guarding all but the counted ones, 1-3%, within the noise. If even
that shows in some project, a comment at the top of a file turns the guards
off for it.

The host keeps a watchdog too, now that it can fire: if the sandbox misses
three heartbeats, the host drops the iframe and says so in the console.

### 5.6 Errors that name the file and line

Every error the console shows says which file and line, and clicking it
opens the file there:

- **Syntax errors**, from Sucrase, before anything runs.
- **Type errors**, from the language service, shown but never blocking
  Run, as in TypeScript's own playground. A visitor experimenting should
  not have to satisfy the type checker first.
- **Import errors**, from step 3 of section 5.2: a file that does not
  exist, or a package not on the list.
- **Errors at run time**, from the sandbox: `main.ts` itself, `start`,
  the ticked `update`, a view's update or refresh. The stack trace's
  `sourceURL`, or the sandbox's own map from blob URLs to paths, gives the
  file, and Sucrase's kept lines give the line.

An error in the ticked `update` or a view's step stops the loop, as now,
so the console does not fill with the same error sixty times a second.

### 5.7 The host loop

The sandbox runs the MVT loop as the Arcade's entry host does: the
project's `update(deltaMs)`, then `updateView` and `refreshView` over the
project's root (the Pixi stage, the HTML root or the three.js scene), then
a render, for Pixi and three.js. Pause leaves the root out of
`updateView`. Step advances one frame of 16.67 ms. The speed slider scales
`deltaMs`. This is today's loop in
[`sandbox-runner.ts`](../../packages/sites/arcade/src/playground/sandbox/sandbox-runner.ts),
with the model's call replaced by the project's, and a root for each
renderer.

---

## 6. The Editor

### 6.1 CodeMirror, not Monaco

| | CodeMirror 6 | Monaco |
| --- | --- | --- |
| Size | Already in the playground's bundle | Several MB with its TypeScript worker |
| Phones and tablets | Works, and is designed for it | Not supported on mobile, by its own docs |
| TypeScript intellisense | Not built in. Comes from the language service in a worker, with glue code (6.2) | Built in |
| Fit with the site | Plain DOM, styled with the site's CSS | Its own look, its own loader |

Monaco would give intellisense for free and cost everything else. The
playground is linked from docs pages that people read on phones, and the
Arcade is played on them. CodeMirror stays.

### 6.2 A TypeScript language service in a worker

A web worker loads the `typescript` package (the repo's own version, 5.9)
and runs its **language service**: the part of TypeScript an editor talks
to for completions, hover, errors and the rest. It sees a virtual file
system made of:

- the project's files, kept in step with the editor on every change;
- TypeScript's `lib.es2022` and `lib.dom` declarations;
- the libraries' declarations (section 6.3);
- the `playground` module's declarations (section 4.2).

The compiler settings are fixed: `strict`, `target` ES2022,
`moduleResolution` bundler, `jsx` react-jsx with the project's renderer as
the import source, `noEmit`. They are the repo's, so a model or view that
type-checks here type-checks in the repo.

The editor and the worker talk through a small message protocol of our
own, with Comlink (a few KB) to make it calls. The spike tried
`@valtown/codemirror-ts` first, and it does not fit (section 16.3): it
asks TypeScript for completions with no preferences, so it never offers
auto-imports, and it has no rename, go to definition, signature help, or
way to delete a file. Its code for syncing files, errors and hover is a
good model, a few dozen lines each, and the spike's completion source with
auto-imports was about forty. The worker loads after the editor is on
screen, and the editor works as plain text until it is ready.

Whether TypeScript 7, the native rewrite, can run in a browser by the time
this is built is unknown. The design does not depend on it: the language
service runs behind a message protocol, and could be swapped.

### 6.3 Types for the libraries

The language service needs every library's `.d.ts` files. Inside the repo,
the MVT libraries resolve to their sources (the `@mvtjs/source` condition),
and `@mvtjs/audio` has no published build at all. So a script in the
playground package generates the types:

- For each `@mvtjs` package, it takes the declarations `build:packages`
  emits. The spike used them for `@mvtjs/utils` and `@mvtjs/pixi` as they
  are. `@mvtjs/audio` is not built by `build:packages`, so its
  declarations are emitted from its sources with the TypeScript compiler.
- For `pixi.js`, `three` (from `@types/three`) and `gsap`, it takes the
  `.d.ts` files from `node_modules`, with those of the packages their
  types import (Pixi's import nine, `@webgpu/types` the largest). Only the
  folder a package's `types` names: `pixi.js` also ships a bundled copy in
  `dist/`, 1.6 MB, which TypeScript never reads.
- It writes one JSON file per library, mapping each declaration file's
  virtual path to its text, with a hashed name.

The worker fetches a library's file the first time a project imports the
library, so a Pixi project never downloads three.js's types. Measured in
the spike: Pixi's bundle is 2.3 MB of text, 446 KB gzipped, and
TypeScript's libs for ES2022 and the DOM are 2.4 MB, 316 KB gzipped
(section 16.4).

In the dev server, a Vite plugin serves the same files, generated on
request and cached, so the types follow edits to the libraries.

### 6.4 What the editor does

| Feature | From | Notes |
| --- | --- | --- |
| Completions | Language service | With the doc comment of each item, and **auto-imports**: choosing `Graphics` adds it to the file's `pixi.js` import, and choosing `createBallModel` in another file adds `import { createBallModel } from './models'`. It imports through the barrel, as the repo's rule says, because the barrel is what TypeScript finds first. The spike confirmed both: `../models`, and `Graphics` from `pixi.js` only |
| Hover | Language service | The type and doc comment |
| Signature help | Language service | As a call's arguments are typed |
| Type errors | Language service | Squiggles in the editor, a count on each tab and file, and a Problems list beside the console |
| Go to definition | Language service | Into the project's files, or into a library's declarations, opened in a read-only tab |
| Rename | Language service | Across the project's files |
| Organise imports, quick fixes | Language service | "Add missing import", "Remove unused import" |
| Formatting | Language service | Four spaces, the repo's style. On a key, not on save |
| Folding, brackets, search, multiple cursors | CodeMirror | As now |

### 6.5 Layout

On a wide screen, left to right: a narrow file tree, the editor with a tab
for each open file, and the preview, with the run controls above it and
the console and Problems below it. Each divider can be dragged, and the
file tree can fold away. The header keeps the project's name, an Examples
menu, New, Share and Export. New offers three starting projects, one for
each renderer.

On a narrow screen, as now, one panel at a time behind tabs: Files, Code,
Run. The keyboard shortcuts stay (Ctrl+Enter runs, Ctrl+Shift+Enter
restarts), and Ctrl+P opens a file by name.

**Run on change.** A toggle, on by default as on CodePen: half a second
after typing stops, if no file has a syntax error, the project runs again.
A project that should not restart on every keystroke, such as a game being
played, turns it off.

---

## 7. Projects, Examples and Sharing

### 7.1 Saved projects

Projects are saved in IndexedDB, by name, as the visitor types. A Projects
list opens any of them, duplicates one, or deletes one. Opening an example
and changing it makes a copy, so the example itself never changes. The one
project kept in `localStorage` today (`mvt-playground-custom`) is converted
(section 7.4) and moved into IndexedDB on the first visit, as a project
named "My first project".

The playground's page and the Arcade's are on the same origin, so their
IndexedDB databases sit side by side. The playground's has a name of its
own, and neither package touches the other's.

### 7.2 Examples are real files in the repo

Each example is a folder of real files in the repo, in
`packages/sites/playground/examples/<id>/`, with a small `example.ts` beside the
project's files for its name and description. The playground imports them
as text with Vite's `import.meta.glob` and the `?raw` suffix.

Because they are real files, the repo's tools cover them: `npm run build`
type-checks them, `npm run lint` lints them by the same rules as the
Arcade's entries, and a test runs each one headless for a second (section
12). An example cannot drift away from the libraries again the way the
presets did. For the type check, the playground package's `tsconfig.json`
maps `playground` to the `define` functions' source.

The eight presets become examples, rewritten in the new shape. The JSX and
non-JSX pairs (Bouncing Ball and Traffic Light) stay as pairs, since the
docs link to both. New examples worth adding, each small: an HTML view, a
three.js scene, a sound on the Audio80, a `<List>` of many things.

### 7.3 Share links

A share link holds the project in the URL's hash, as today: the files and
the project's name as JSON, compressed. Nothing is sent to a server, and
the link works for as long as the site does. The hash format gains a
version, `#p1=...`, so it can change again later.

The new format compresses with gzip, through the browser's own
`CompressionStream`, and writes the bytes in URL-safe base64. The spike
measured both on the Arcade's entries (section 16.4): lz-string, today's
format, makes a link 43-53% the size of the code; gzip makes one 20-24%,
or about 29% once base64 adds its third. For the largest entry, Neon
Monsoon, that is about 68 KB of link where lz-string makes 102 KB. Old `#code=` links stay lz-string, and are
still read (section 7.4).

A project over the size limit (section 4.4) cannot be shared by link, and
the Share button says so, and offers Export instead.

Short links (a server that stores a project and returns an ID) would need
storage, moderation and abuse limits. The Cloudflare Worker that keeps the
highscores could host it. It is left as an open question (section 14) until
long links prove to be a problem.

### 7.4 Old links keep working

- **`#preset=<id>`** opens the example of that ID. The docs'
  `PlaygroundLink` builds these, so every link in the docs keeps working
  without an edit. The new form is `#example=<id>`; the component switches
  to it when it is next edited, and the old one stays accepted.
- **`#code=...`**, today's share format, is converted on open into a
  project of three files. The model's code goes to `models/model.ts`, the
  view's to `views/view.tsx`, each with `import` lines added for the
  globals the old sandbox provided and an `export` added to `createModel`
  or `createView`. `main.ts` is generated: `definePixiProject`, with the
  canvas size from the link, and a `start` that calls `createModel()`,
  adds `createView(model)` to the stage, and returns the model. A
  `setBackground(...)` call with a fixed colour, as every preset has, moves
  into the `background` option. Any other `setBackground` call is left as
  it was, with a comment saying what replaces it. The conversion is a plain
  function of strings, tested against every old preset.

Links from before task 028 that assign `view.onRefresh` (017) could be
fixed in the same conversion, by rewriting the assignment to a
`setRefresh` call. It is cheap here, where it was not worth doing in the
old sandbox. It closes that item in 017.

### 7.5 Export as a Vite project

Export downloads a zip (made in the browser with `fflate`, a few KB) that
is a complete Vite project:

- `package.json`, depending on the published `@mvtjs` packages, Pixi,
  three.js and GSAP, at the versions the playground runs, with `dev` and
  `build` scripts;
- `tsconfig.json`, the same settings as the language service;
- `index.html`, and `src/run.ts`, a host of about forty lines that does
  what the sandbox does: makes the Pixi application, the root element or
  the three.js renderer, calls the project's `start`, and runs the loop;
- `src/playground.ts`, the `define` functions, with the project's import
  of `playground` rewritten to `./playground`;
- the project's files, under `src/`.

`@mvtjs/audio` is private for now. A project that imports it exports with a
note in its README that sound will work once the package is published.
Until then, Export of such a project is offered without its sound, or not
offered; that is an open question (section 14).

---

## 8. The Playground, Built With MVT

The playground is the one page on the site not written in MVT. Its code
builds the DOM by hand, keeps its state in closures across five files, and
has one test file. Since it is being rebuilt, it should be built as the
Arcade is:

- A **model** of the workspace: the project's files, which are open and
  which is active, the run's phase (idle, running, paused, stopped, failed),
  the console's entries, the problems from the language service. It
  advances with `update(deltaMs)` (for the run-on-change delay), and is
  tested in Node.
- **Views** in HTML JSX: the file tree, the tabs, the run controls, the
  console, the Problems list, the dialogs. CodeMirror is a third-party
  element that one view owns, as the Arcade's views own their inputs.
- **The page's loop**, as in the Arcade's `main.ts`.

Its own code then follows the repo's rules, and the lint exemption for it
in [`eslint.config.ts`](../../eslint.config.ts) goes.

---

## 9. A Package of Its Own, and the Website Renamed

### 9.1 Why now

The playground lives in the website package, behind two lint rules that
keep it and the rest of the site from importing each other.
[Project Structure](../../packages/sites/docs/reference/project-structure.md)
already says the fence is there so it "could become a package of its own".
This proposal is the time to do it:

- **The rewrite replaces almost every file.** The runtime, the editor, the
  views and the examples are all new code. Moving later would mean a second
  pass over every path, import and doc that this one already touches.
- **Its dependencies are its own.** CodeMirror's five packages, Sucrase and
  lz-string are in the website's `package.json`, and nothing else in the
  website imports them (measured). This proposal adds more: TypeScript at
  run time, es-module-lexer, fflate, and maybe a CodeMirror binding. In a
  package of its own, each one is declared where it is used, as the repo's
  dependency rule asks.
- **The fence becomes structural.** A package boundary keeps the two apart
  with no rule to maintain: the playground cannot import the Arcade's code
  because it does not declare it as a dependency, and the lint rule for
  undeclared dependencies already catches that. The two fence rules go.
- **It has build pieces of its own.** The types generator (6.3), the
  library manifest (5.3), the language service's worker and the examples'
  tests fit its own Vite and Vitest config better than the website's.

It is a page that gets deployed, so it joins the `sites/` group, beside
the docs and the Arcade.

### 9.2 The playground package

`packages/sites/playground/`, named `@mvtjs/playground`, private, in the
shape of the other private packages. The workspace takes every folder in
`packages/*/*`, so it needs no change to the root `package.json` to be
found.

```
packages/sites/playground/
├── index.html          The playground's page. The sandbox needs no page of its own: srcdoc does (5.4)
├── src/
│   ├── models/         The workspace (section 8)
│   ├── views/          Its HTML JSX views
│   ├── runtime/        Transpiling, loop guards, import rewriting, the sandbox's document, links
│   ├── sandbox/        What runs inside the sandbox: the runner, and a host for each renderer
│   ├── examples/       Reads the examples' files, as text
│   ├── storage/        The project kept between visits
│   ├── language/       The language service's worker (step 5)
│   ├── project-api/    The `playground` module: the define functions and their types
│   └── main.ts         The page's loop
├── libraries/          The libraries a project may import, and an entry module for each (entries/)
├── examples/<id>/      The examples (section 7.2)
├── scripts/            The library types generator (section 6.3, step 5)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

**Building and serving.** The playground has its own Vite build, with
`base` set to the site's base plus `playground/`, writing to the repo's
`dist/playground/` (`../../../dist/playground` from the package). That is
how the docs work today: `build:docs` builds VitePress on its own into
`dist/docs/`, after the website's build, since the website's build empties
`dist/`. The root `build` and `deploy.yml` gain
a `build:playground` step between the two. In dev, the playground's server
runs on a fixed port, and the Arcade's dev server proxies `/playground` to
it, as it proxies `/docs`, with the same "not running" page when it is not
started. `npm run playground:dev` starts it.

**The nav.** The playground's page links the site's `src/shared/nav.css`
today, the one place it crosses the fence. The package gets its own copy of
the nav's markup and CSS, as the docs already have theirs. Three copies of
one nav is a cost, already paid twice; a nav shared by all three is a
question of its own, not this proposal's.

**Library versions.** The playground declares `pixi.js`, `three` and `gsap`
at the same ranges as the Arcade, and npm installs one copy for both. A
check in `packages/tests/checks/` fails if the two packages' ranges differ, so
the playground cannot drift onto a version the Arcade does not run.

### 9.3 The website becomes the Arcade

Once the playground has moved out, the website package is the Arcade: the
home page, its entries, the entry host, the visitor's storage and the
highscores Worker. Its name should say so. `packages/sites/website/` becomes
`packages/sites/arcade/`, and `@mvtjs/website` becomes `@mvtjs/arcade`.

**What the rename touches** (measured at `b32f67b`, leaving out this
proposal):

- 10 files name `@mvtjs/website`: the root `package.json` (its `dev`,
  `build` and `build:website` scripts), the benchmarks' `package.json` and
  two of their suites, `deploy-highscores.yml`, the Worker's `wrangler.toml`
  and README, `AGENTS.md`, Project Structure, and the package's own
  `package.json`.
- 36 files outside `notes/archive/` cite the path `packages/sites/website`:
  docs, notes, `deploy-highscores.yml`, and the root `eslint.config.ts`
  and `vitest.config.ts`.
- `build:website` becomes `build:arcade`, in the root scripts and both
  deploy workflows.
- The highscores Worker's deployed name and URL do not change. Only the
  path its config is read from does.
- Archived notes keep the paths of their day. The "Paths in older notes"
  paragraph in [notes/README.md](../README.md) gains a sentence for the
  rename.

Inside the package, the home page's own code is in `src/arcade/`, so its
path becomes `packages/sites/arcade/src/arcade/`. That reads twice, but it is
accurate: the package is the Arcade site, and that folder is the Arcade's
home page. Renaming the folder (to `src/home/`, say) would ripple into
`ArcadeModel`, `ArcadeView` and their docs, for little gain. It is an open
question (section 14), with keeping it as the recommendation.

The rename is a mechanical step of its own, in its own commit, with no
change in behaviour, before any playground work (section 15, step 2). Done
first, its diff is easy to review, and the playground's new package is
created beside `packages/sites/arcade/` from the start.

---

## 10. Later: What Only an MVT Playground Can Do

Each of these comes after sections 4-9 have shipped, as a step of its own.
They are why an MVT playground is worth more than a generic one with MVT's
packages installed.

### 10.1 Swap the views, keep the model

MVT keeps all state in the models, and views only read it. So when the
visitor edits only views, the playground can swap the old views for new
ones while the model keeps running: the ball keeps bouncing, the game keeps
its score, and the new colour appears on the next frame. It is the
architecture's main promise, shown in a way no slide can.

It needs the run to keep its document (section 5.1 starts a fresh one), so
the changed view modules are loaded again under new blob URLs, with the
modules that did not change kept. And it needs `main.ts` to split building
the views from making the models, so the playground can call one without
the other: perhaps an optional `views` function beside `start`, given the
models `start` returned. The design of that, and which edits count as "only
views" (a file in `views/` that nothing in `models/` imports), is the work
of this step.

### 10.2 Port a project to an Arcade entry

A project that grows into a game worth listing should not need rewriting
by hand. "Export as an Arcade entry" downloads a zip of one folder, ready to
drop into `packages/sites/arcade/src/entries/<id>/`:

- the project's `models/`, `views/` and `data/` as they are;
- `main.ts` moved to `start/project.ts`, with its `playground` import
  pointed at a small adapter;
- a generated `start/load.ts` whose starter wraps the project: its screen
  size from the project's options, and a `start` that gives the project a
  container of its own on the stage, and a `destroy` that removes it;
- a generated `start/entry.ts`, with the entry's name filled in and its
  summary, description and tags marked for the author to write.

The author then adds the entry to `catalogue.ts` and generates its
thumbnail, as for any new entry. The adapter could be generated into each
ported entry, or kept once in the Arcade's `entry-types/`; this step
decides. The tool lives in the playground, so the Arcade's code never
depends on it.

### 10.3 The architecture's rules as live diagnostics

Several of the repo's lint rules are the architecture's rules: no
wall-clock time in models (`@mvtjs/no-wall-clock`), no module-level state
(`@mvtjs/no-module-state`), no `this`, no `null`, barrel imports only.
ESLint runs in a browser, and `@mvtjs/eslint-plugin` is plain code. Run in
the language service's worker, its rules would underline a `setTimeout` in
a model as it is typed, with a link to the docs page that explains why.
That is the docs' advice, delivered where it is needed.

The open part is which rules, since some (`no-deep-imports` and the
dependency rules) assume a repo, and how big ESLint is in the worker.

### 10.4 Embeds for the docs

A compact page, `/playground/embed.html#example=<id>`, with one file open
and the preview beside it, sized for an `<iframe>` in a docs page. The docs
could then show a running example next to the text that explains it,
editable in place, with a link to open it in the full playground.

### 10.5 Remix an Arcade entry

"Open in Playground" on an entry's card in the Arcade, which loads the
entry's own files as a new project. It is 10.2 in reverse, and harder: an
entry's `start/load.ts` would need converting to a `main.ts`, its `#shared`
imports providing, and most entries are over the size limit. Small entries
(the boids, Reordering Lists) might manage it. It is the least certain of
these ideas, and comes last.

---

## 11. Size and Speed Budgets

The playground is its own page, so none of this touches the Arcade's
budget.

Measured in the spike's production build, gzipped as GitHub Pages serves
it (section 16.4):

| What | Gzipped | When it loads |
| --- | --- | --- |
| The editor: CodeMirror, Comlink, the page | 165 KB | At once |
| The runtime: Sucrase, acorn (for the loop guards), es-module-lexer | 92 KB | At once |
| TypeScript in the worker | 947 KB (3.4 MB minified) | After the editor is on screen |
| TypeScript's libs for ES2022 and the DOM | 316 KB | With TypeScript |
| Pixi's types | 446 KB | When a project first imports Pixi |
| The `@mvtjs` libraries' types | 25 KB | With the first library's |
| The libraries in the sandbox: Pixi, the `@mvtjs` libraries, the Audio80 | At most 286 KB, every chunk counted; a project loads only those it needs | On the first Run, then cached |

So intellisense for a Pixi project downloads about 1.7 MB, after the editor
is already in use. Brotli would make it 1.3 MB, but Pages serves gzip.

**Targets**, and what the spike measured from a cold cache (section 16.5).
"Phone-ish" is Chromium with its main thread slowed four times and a 9
Mbps, 60 ms network: a rough stand-in, since no real phone was tested.

| Target | Desktop | Phone-ish |
| --- | --- | --- |
| The editor takes typing within 1 second of opening the page | 60 ms | 0.5 s |
| An example runs within 1.5 seconds of opening the page, uncached | 0.7 s | **2.2 s, missed** |
| Completions work within 4 seconds of opening the page | 0.6 s | 2.8 s measured; about 4.5 s estimated with the worker slowed too |
| A second Run shows its first frame within 300 ms | 94 ms | 247 ms |
| A completion list appears within 100 ms, in a project of 20 files | 26 ms | About 100 ms, estimated |

The two phone-ish misses are for step 3 to work on: preloading the
library chunks with the page, so Pixi downloads while the page starts,
and loading the language service only after the first Run.

---

## 12. Testing

The playground package has its own Vitest projects, run by the root
commands as the other packages' are.

| What | How |
| --- | --- |
| Transpiling, loop guards, import rewriting, path resolution, the `#code=` conversion, the share format | Unit tests in Node, as `compile.test.ts` does now. The conversion is tested against each of today's presets |
| The `define` functions and the host loop | Unit tests in Node, with a bare Pixi container, an HTML element and a three.js scene as roots |
| The workspace model | Unit tests in Node |
| The playground's views | Visual tests with `htmlTest` from v-snap, in `visual-tests/` beside them, as the Arcade's are |
| The examples | Type-checked and linted with the repo. A unit test starts each example headless on a bare root and advances it one second, failing on any error |
| The sandbox, end to end | A browser test (Vitest's browser mode, as v-snap uses) that opens the sandbox, runs each example, and checks that a frame was drawn and nothing was logged as an error. It covers the import map, blob URLs and the opaque origin, which Node cannot |
| Library versions | A check in `packages/tests/checks/` that the playground and the Arcade declare the same ranges (section 9.2) |

---

## 13. Docs and Repo Changes

- **The rename** (section 9.3): every file it lists, in its own commit.
- [`AGENTS.md`](../../AGENTS.md),
  [Project Structure](../../packages/sites/docs/reference/project-structure.md)
  and the root README: the `sites/` group gains `playground/` and renames
  `website/` to `arcade/`; the Arcade's `src/` tree loses `playground/`;
  the commands table gains `playground:dev` and `build:playground`.
- [`eslint.config.ts`](../../eslint.config.ts): the two fence rules go,
  and so does the playground's `ignores` entry.
- The root `package.json` and the deploy workflows: `build:arcade` and
  `build:playground`, and the order of the builds (section 9.2).
- `test-deploy.yml`: write a file named `CORS`, holding `*`, into `dist/`
  before `surge` publishes it, so the sandbox can load the libraries from
  the test deploy (section 5.4).
- The [Quickstart](../../packages/sites/docs/building-with-mvt/quickstart.md),
  [Models](../../packages/sites/docs/building-with-mvt/simulating-the-world/models.md)
  and [Views](../../packages/sites/docs/building-with-mvt/presenting-the-world/views.md)
  pages: their playground links work unchanged (section 7.4). Their text
  around the links, where it describes `createModel` and `createView`,
  changes to match `main.ts`.
- [Style Guide](../../packages/sites/docs/reference/style-guide.md): its line
  that exempts the playground goes.
- A short help page inside the playground: what a project is, what
  `main.ts` returns, what can be imported, the shortcuts, and how to
  export.
- 017: its `view.onRefresh` item closes with section 7.4.
- 050: the playground is one of the pages it counts.

---

## 14. Open Questions

1. **The names.** `playground` for the module, and `definePixiProject`,
   `defineHtmlProject` and `defineThreeProject` for its functions. The
   module's name is short and says what it is; Export renames the import to
   a local file (section 7.5), so it never meets the npm package of that
   name. Recommendation: these names.
2. **The home page's folder** in the renamed package: keep
   `packages/sites/arcade/src/arcade/`, or rename it? Recommendation: keep it
   (section 9.3).
3. **Pinning versions.** Should a share link record the library versions
   it was written against, and the playground keep old versions to run it?
   Recommendation: no, at first. Record the version in the link, so a
   later playground can warn that a project is from an older release.
4. **Short links.** Leave links long, or store projects in the highscores
   Worker for short IDs? Recommendation: long links, until visitors say
   they are a problem.
5. **Export with sound,** while `@mvtjs/audio` is private. Offer Export
   with a note, or hold it back for projects that import the package?
   Recommendation: offer it with the note; the audio package is meant to be
   published.
6. **Run on change by default.** CodePen does it, and it suits small
   visual toys. It suits a game less. Recommendation: on by default, and the
   toggle remembered per project.
7. **The dev servers.** Should the root `npm run dev` start the
   playground's server too, beside the Arcade's? Recommendation: no, the
   same as the docs today; revisit if working on both at once proves
   awkward.
8. **The Audio90.** If 051 lands, the `define` functions take a chip
   option, as an entry's starter names its chip. Nothing here needs to wait
   for it.

---

## 15. Implementation Steps

Each step ends with the site working and deployable.

1. ~~**Spike, and measure.** In a throwaway branch: an opaque-origin iframe
   that runs three files through Sucrase, an import map and blob URLs,
   with Pixi from a Vite build, in the dev server and on the test deploy
   (Surge) and GitHub Pages. Check CORS, the Audio80's worklet and
   autoplay, cycles between files, and `sourceURL` line numbers in Chrome,
   Firefox and Safari. Measure the loop guard's cost on the falling-sand
   demo. Load TypeScript's language service in a worker beside CodeMirror,
   with Pixi's types, and measure every row of section 11 on a laptop and
   a phone. Try `@valtown/codemirror-ts`. Write the results into this
   proposal, and adjust the design where they disagree with it.~~ Done
   2026-10-16, in Playwright's Chromium, Firefox and WebKit, with the
   deploys' headers read from the live sites rather than deploying the
   spike. Results and changes in section 16. Not done: a real phone, real
   Safari, and the installed Chrome (section 16.6).
2. ~~**Rename the website to the Arcade** (section 9.3). Mechanical, in one
   commit, with no change in behaviour: the build, the tests, the test
   deploy and the highscores Worker's deploy all pass from the new path
   before it merges. The old playground stays where it is, in
   `packages/sites/arcade/src/playground/`.~~ Done 2026-10-16, on the
   branch `rename-website-to-arcade`, on `vnext` at `ad299ea`: lint, the
   2,536 unit tests, the build with the home page's budget check and the
   docs, and the 64 visual tests (every image identical) pass. The two deploys run from the new
   path when the branch is pushed, and are the last check. It also fixed
   the entry info panel, which since the packages were grouped had shown
   an entry's path as `packages/sites/website/src/entries/<id>` rather
   than `src/entries/<id>`.
3. ~~**The new playground package, with its runtime.** Create
   `packages/sites/playground/` (section 9.2), with its own build into
   `dist/playground/` and the dev proxy. In it: the modules pipeline
   (5.2), the opaque-origin sandbox (5.4), loop guards (5.5), the library
   manifest (5.3), `main.ts` and the `playground` module (4.2), and the
   examples as real files (7.2). A plain editor with a file list, and no
   intellisense yet. `#preset=` and `#code=` links convert (7.4). It is
   served at `/playground/next/` while the old one keeps `/playground/`.
   When every example runs and every old preset converts, `/playground/`
   switches to it, and the old `src/playground/` is deleted from the
   Arcade, with its dependencies, the two fence rules, and its lines in
   the Arcade's Vite config. Shared links now run as they open.~~

   Done 2026-10-16. The package builds into `dist/playground/` after the
   Arcade, and the Arcade's dev server proxies `/playground/` to its own
   (`npm run playground:dev`, port 5300). It ran first at
   `/playground/next/`, beside the old playground, for the checks below. Both deploy workflows build it, and the
   test deploy writes Surge's `CORS` file. The eight presets are examples,
   each run headless for a second by a unit test. In headless Chromium, in
   the dev server, through the proxy and from the build: all eight run;
   every `#preset=` and every old preset's `#code=` link runs; a syntax
   error, an error in `update` and a loop that never ends each name the
   file and line, with a link that opens it; a share link (`#p1=`, gzip)
   reopens and runs; and small HTML and three.js projects run, as does one
   that makes the sound chip. Where it differs from the plan:
   - The UI is already the MVT workspace model with HTML JSX views (step
     4's first half), since a plain DOM editor would have needed the old
     lint exemption back and been thrown away a step later. Step 4 keeps
     its layout work, the Problems list and the visual tests.
   - Sharing (`#p1=`, gzip) and keeping one project between visits, with
     the old playground's saved project converted, came early, so the
     switch loses nothing the old playground had. IndexedDB projects stay
     in step 6.
   - The library entry modules are in `libraries/entries/`, beside the
     list of libraries in `libraries/`, at the package's root, where
     `vite.config.ts` can import the list through a barrel.

   The owner playtested `/playground/next/` the same day, and then it
   took over `/playground/`. The old playground is gone from the Arcade,
   with its six CodeMirror packages, Sucrase and lz-string, the two lint
   rules that fenced it, its lines in the Arcade's Vite config and its
   line in the docs. The docs' `#preset=` links, and `/playground` without
   its slash, open and run the new one. The quickstart's line under its
   link now says what the playground does.
4. **The playground in MVT.** The workspace model and HTML JSX views
   (section 8), the new layout (6.5), the console and Problems list with
   file and line links (5.6). Visual tests of the views.
5. **Intellisense.** The language service worker (6.2), the generated
   types (6.3), and every row of 6.4.
6. **Projects and export.** IndexedDB projects and the migration from
   `localStorage` (7.1), the `#p1=` share format with its size limit (7.3),
   and Export (7.5).
7. **Docs.** Section 13.
8. **Later.** Each of section 10's ideas, as a proposal or task of its own
   when its turn comes: swapping views (10.1) first, as the strongest case
   for an MVT playground, then the port to an Arcade entry (10.2).

---

## 16. Spike Results

Done on 2026-10-16, in a worktree at `b32f67b` on the branch
`spike/052-playground`, in a throwaway folder,
`packages/sites/playground-spike/`. It is not to be merged. It has two
pages: a runtime page, which runs a sample project of seven files
(`main.ts`, a model and a view with their barrels, and two files that
import each other) in variants that each test one thing, and an editor
page, with CodeMirror and the language service in a worker over a project
of 20 files. Node scripts beside them measure the loop guards, the share
links and the type bundles. Playwright drove the browsers: its Chromium
headless shell 156, Firefox 157 and WebKit 27.2, on Windows 11.

### 16.1 The runtime

| Check | Chromium | Firefox | WebKit |
| --- | --- | --- | --- |
| The sandbox's origin is opaque (`null`), and it is still a secure context | Yes | Yes | Yes |
| An import map added by script, with the project's files as blob URLs under `project:` names | Works | Works | Works |
| Two files that import each other | Work | Work | Work |
| Line numbers in errors match the editor's | Yes | Yes | Yes |
| `sourceURL` names the file in `error.stack` | Yes | Yes | No: `blob:null/<id>`, which the sandbox maps to the path |
| Libraries load across origins, with `Access-Control-Allow-Origin: *` | Yes | Yes | Yes |
| Without the header, as Surge serves | They fail | They fail ("CORS header missing") | Not run |
| The Audio80's worklet loads, and its clock runs | Yes | Yes | Not testable: Playwright's WebKit for Windows has no Web Audio |
| The sound starts from the parent page's click | Only with `allow="autoplay"` | Either way | - |
| An unguarded three-second loop freezes the parent page | Yes, 3,015 ms | Yes, 3,034 ms | Yes, 3,030 ms |
| A guarded loop that never ends stops after a second, naming `main.ts:12` | Yes | Yes | Yes |
| A missing file (`./view`) is reported before Run | Yes | Yes | Yes |
| A used import of `lodash` is refused before Run | Yes | Yes | Yes |

The same checks passed in the Vite dev server (with `server.cors` set) and
in the production build, served with gzip and the header as Pages serves
it. The library chunks came from one build with each library as an entry,
`preserveEntrySignatures: 'strict'`, and a manifest that the page reads
for the import map. `@mvtjs/pixi` and `pixi.js` were one Pixi.

Sucrase drops an import the file never uses. So an unused import of an
unknown package is not refused at Run; the language service reports it in
the editor instead (section 5.2).

### 16.2 Loop guards

The falling-sand demo's model, bundled, with the guards the pipeline adds,
run in Node 26 for 1,080 frames after a warm-up, in a separate process for
each run, seven runs each, interleaved:

| Guard | Loops guarded | Storage `objects` | Storage `arrays` |
| --- | --- | --- | --- |
| None | 0 | 160 µs a frame | 148 µs a frame |
| A call to a global check on every turn | 76 | +18.9% | +18.9% |
| A module-local budget, checked when it runs out | 76 | +14.9% | +16.9% |
| The budget, with counted loops left out (section 5.5) | 42 | **+1.3%** | **+3.4%** |

The first version of the counted-loop rule missed the model's hottest
loops, `for (let n = 0; n < FLOW_SIGHT_CELLS && isEmpty(...); n++)`, whose
test goes on with `&&`, and cost 12%. Allowing `&&` brought it to the last
row. The final rule still guards 14 more loops than the first version did,
because it keeps bounds such as `arr.length` guarded, at no cost that
showed.

### 16.3 The language service

- **The binding.** `@valtown/codemirror-ts` 2.3.1 keeps the worker's files
  in step, and gives errors, hover and plain completions. It calls
  `getCompletionsAtPosition` with empty preferences, so it offers no
  auto-imports, and it filters what it offers by sort order. It has no
  rename, go to definition or signature help, and cannot delete a file.
  The spike used it for syncing, errors and hover, and a completion source
  of its own for the rest (section 6.2).
- **Types.** The sample project type-checks with no errors, its Pixi JSX
  included, against the type bundles: TypeScript's libs, Pixi's types, the
  `@mvtjs` declarations from `build:packages`, and a hand-written
  `playground` module.
- **Auto-import.** Typing `createBallMo` in a new file under `views/`
  offers `createBallModel` from `../models`, the barrel, and inserts
  `import { createBallModel } from "../models";`. `Graphics` is offered
  from `pixi.js` only.
- **Speed, in Node.** The service is ready 0.43 s after reading the
  bundles, and checks 20 files in 0.09 s. `model.` completes in 28 ms,
  then under 1 ms once warm.

### 16.4 Sizes

From the spike's production build, and the type bundles, measured with
Node's zlib:

| What | Minified or raw | Gzipped | Brotli |
| --- | --- | --- | --- |
| The editor page: CodeMirror, the binding, Comlink | 497 KB | 165 KB | 139 KB |
| The runtime page: Sucrase, acorn, es-module-lexer, the host | 342 KB | 92 KB | 76 KB |
| The language service's worker, TypeScript 5.9 | 3,398 KB | 947 KB | 718 KB |
| TypeScript's libs: `es2022`, `dom`, `dom.iterable` and the 56 they reference | 2,375 KB | 316 KB | 223 KB |
| Pixi's types, with the nine packages they import (769 files) | 2,263 KB | 446 KB | 333 KB |
| `@mvtjs/utils` and `@mvtjs/pixi` types | 117 KB | 25 KB | 21 KB |
| Every chunk the sandbox may load: Pixi, the `@mvtjs` libraries, the Audio80 | 976 KB | 286 KB | - |

acorn is in the runtime page only to find loops for the guards. Sucrase
parses each file already, but exposes no syntax tree; replacing acorn is a
size saving for step 3 to weigh.

**Share links** for each of the Arcade's entries, counting `.ts`, `.tsx`
and `.css` files without tests:

| Entry | Files | Code | lz-string link | Gzipped | Gzipped, base64 |
| --- | --- | --- | --- | --- | --- |
| boids-3d | 8 | 16 KB | 10 KB | 5 KB | 6 KB |
| reordering-lists | 10 | 25 KB | 13 KB | 6 KB | 8 KB |
| boids | 12 | 51 KB | 26 KB | 12 KB | 16 KB |
| astrovoid | 25 | 70 KB | 32 KB | 15 KB | 19 KB |
| crumb-chase | 25 | 74 KB | 36 KB | 18 KB | 23 KB |
| galaxy-raiders | 27 | 77 KB | 33 KB | 15 KB | 20 KB |
| kwazy-cactii | 31 | 105 KB | 49 KB | 22 KB | 30 KB |
| fractalscope | 28 | 110 KB | 55 KB | 28 KB | 37 KB |
| fuel-run | 41 | 126 KB | 53 KB | 23 KB | 31 KB |
| burrow-bust | 29 | 127 KB | 54 KB | 24 KB | 32 KB |
| dojo-duel | 26 | 129 KB | 58 KB | 26 KB | 35 KB |
| falling-sand | 25 | 139 KB | 66 KB | 30 KB | 40 KB |
| fruit-machine | 68 | 206 KB | 98 KB | 50 KB | 67 KB |
| fenceline | 40 | 227 KB | 100 KB | 49 KB | 66 KB |
| neon-monsoon | 49 | 238 KB | 102 KB | 51 KB | 68 KB |

### 16.5 Timings

From a cold cache, the production build served with gzip, in Chromium's
headless shell, three rounds each; the middle value of three is given,
with the range where it varied.

| Moment | Desktop | Phone-ish |
| --- | --- | --- |
| The editor takes typing | 60 ms (53-81) | 514 ms (508-549) |
| The worker answers (TypeScript downloaded and run) | 103 ms after it is made | 1,043 ms after |
| The language service is ready, its first check done | 630 ms (561-780) | 2,781 ms |
| The example's first frame, from opening the page | 715 ms (696-771) | 2,180 ms |
| A second Run's first frame | 94 ms (86-115) | 247 ms (236-263) |
| `model.` completes, first time, then warm | 22 ms, 1 ms | 22 ms, 1 ms |
| Completions with auto-imports, 20 files | 26 ms | 25 ms |

"Phone-ish" slows Chromium's main thread four times, and the network to 9
Mbps with 60 ms round trips. Chrome's CPU throttling does not reach a
dedicated worker, so the worker's rows in that column are a desktop's CPU
on a phone's network. On desktop, the worker's own work, running
TypeScript, creating the service and the first check, takes about 0.5 s;
four times that puts a phone's service at about 4.5 s, and its completions
at about 100 ms.

### 16.6 Not checked

- **The owner's playtest.** Both spike pages were tried by hand in desktop
  Chrome on 2026-10-16, and everything worked. Other browsers and devices
  are left for later testing.
- **A real phone, and real Safari.** The spike's pages can be served to a
  phone on the network; sound there needs the HTTPS dev server. Safari
  matters most for two rows of 16.1: whether its Web Audio starts in the
  sandbox, and its `sourceURL` handling, which WebKit's already showed.
- **The installed Chrome.** Whether its site isolation puts the sandbox in
  a process of its own, as the headless shell did not. Not run, because
  each new profile of the installed Chrome costs a failed Windows logon.
  The answer would not change the design: Safari and Android need the
  guards either way.
- **Deploying the spike.** Deploying is outward-facing, so the spike read
  the live deploys' headers instead: Pages sends the CORS header on pages
  and assets; Surge sends none.
- **three.js, HTML JSX and the Audio80's types.** Only Pixi projects were
  run and type-checked. `@mvtjs/audio`'s declarations need emitting from
  its sources (section 6.3).

### 16.7 What changed in the design

| Section | Before the spike | After |
| --- | --- | --- |
| 5.5 | A guard on every loop | A budget guard, with counted loops left out: 1-3% in place of 15-19% |
| 7.3 | lz-string links | Gzip and URL-safe base64: links about 30% of the code in place of about 45% |
| 6.2 | Try `@valtown/codemirror-ts` | Our own glue to the worker, with the binding as a model |
| 5.2, 5.6 | `sourceURL` names files in stack traces | Also map blob URLs to paths, for WebKit |
| 5.4, 13 | GitHub Pages sends the CORS header | It does; Surge needs a `CORS` file in the test deploy |
| 4.4 | Limits are first guesses | Measured against the Arcade's entries, and kept |
| 11 | Estimated sizes and targets | Measured; two phone-ish targets missed, with fixes for step 3 to try |

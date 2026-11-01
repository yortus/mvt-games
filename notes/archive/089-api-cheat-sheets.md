# Proposal: API Cheat Sheets

> A short, browsable guide to the APIs a project can use, open beside the
> code while you type, and closed when you don't need it. The playground
> shows it as a pane over the run, beside the editor. A book's embed shows
> it as a drawer over the run that opens on the APIs the example itself
> uses. The book prints it as an appendix. Each sheet is organised by task,
> not by package. People choose what goes on each sheet, and the build
> fills in each signature and summary from the libraries' own
> declarations, so the sheets can't drift from the code. A test fails when
> a sheet names something that no longer exists, or when a new export is
> on no sheet.

**Status:** implemented on `docs-book`, steps 1 to 8, and archived on
2026-11-01. Twelve sheets, 124 entries, every value export of this repo's
libraries on a sheet or in `LEFT_OUT`. Where the build differs from the
design below, the section says so, marked "As built", or "As revised" for
the changes made after the first review. Open questions 2 to 4, and
checking F1 in Firefox and Safari, moved to task
[017](../tasks/backlog/017-misc-loose-ends.md).

**Written:** 2026-11-01, on `docs-book`. Checked against the playground's
Help dialog, its layout model and settings store, the embed page and its
model, the type bundles plugin, the libraries' barrels and doc comments, and
the docs' `TryIt.vue`. Nothing measured yet.

**Related:**
[the playground's libraries](../../packages/sites/playground/libraries/libraries.ts),
[the type bundles](../../packages/sites/playground/scripts/type-bundles.ts) and
[their plugin](../../packages/sites/playground/scripts/vite-plugin-library-types.ts),
[the Help dialog](../../packages/sites/playground/src/views/help-view.tsx),
[the layout model](../../packages/sites/playground/src/models/layout-model.ts),
[the playground view](../../packages/sites/playground/src/views/playground-view.tsx),
[the embed page](../../packages/sites/playground/src/embed-main.ts) and
[its model](../../packages/sites/playground/src/embed/embed-model.ts),
[TryIt.vue](../../packages/sites/docs/.vitepress/components/TryIt.vue),
[the book's shape](../../packages/sites/docs/.vitepress/book.ts),
[075](../proposals/075-docs-as-a-book.md) (the book and its embeds),
[062](../tasks/backlog/062-playground-on-phones-and-safari.md) (the playground on phones),
[063](../tasks/backlog/063-playground-shortcuts-while-the-preview-has-focus.md) (shortcuts while the preview has focus),
[080](../proposals/080-audio80-voices-in-the-audio90.md) (which may change the chip the Sound sheet describes).

| Decision | Recommendation | Section |
| --- | --- | --- |
| Content | Written by hand: what each sheet covers, its order, a "use it for" line and snippets. Generated: each signature, summary and import line | 3, 4 |
| Organisation | By task (Your project, The tick, Watching for changes, JSX, ...), not by package. Filtered to the project's renderer | 3.1 |
| Coverage | A test fails on a name that no longer exists, and on a public export of ours that is on no sheet and not on the "left out" list | 4.3 |
| Third-party libraries | Short sheets of essentials for Pixi, three.js and GSAP, each linking to the official docs | 3.4 |
| The playground | A pane over the run, beside the editor, opened and closed by a button and a shortcut. A fourth panel on narrow screens. (As revised: first designed as a pane between the editor and the run, with its own divider) | 6 |
| The embed | A drawer over the right of the run, opened from the embed's bar once the code is open. It opens on what the example imports, and loads only when first opened. (As revised: first designed to cover the code too) | 7 |
| The book | Appendix G, rendered from the same data, printed as a compact reference card | 8 |
| Not chosen | A full generated API reference. A tab under the preview. A tab in the file list's column | 2 |

---

## 1. Why

The playground's editor explains a name well once you know it exists: hover
shows its signature and doc comment, and completions list what a module
exports. What it can't do is tell you what exists. Someone new to MVT
doesn't know that `createReaction` is how a view plays a sound on a change,
or that `<List>` is how a view shows a collection. They have to find it in
the book first.

The Help dialog lists the twelve libraries a project can import, with a
sentence each. That says what each library is for, not what's in it, and
the Help is a modal dialog, which hides the code while it's open.

The book's embeds have nothing at all. An embed loads no language service,
on purpose, so it stays light. A reader who presses Edit on an experiment
gets plain text, with no hover and no completions. They're the readers who
most need a nudge, because they're still learning the APIs the chapter is
teaching.

A cheat sheet fills that gap. It's short, it's arranged by what you're
trying to do, and it stays open beside the code.

## 2. Settled Decisions

Settled with the user on 2026-11-01. Do not reopen without new information.

1. **Written by hand, with generated signatures.** A full generated
   reference was ruled out. A cheat sheet is useful because it's selective,
   and every library already has its doc comments, which the editor's hover
   shows. Signatures copied by hand were ruled out too, because they drift.
2. **A pane docked to the right of the editor.** A fourth tab beside the
   Console, Problems and Performance tabs was ruled out: it's only 200px
   tall by default, too short for a signature and a snippet. A tab sharing
   the file list's column was ruled out: that column is narrow (230px by
   default), and you often want the files and the sheet at once.
3. **Short essentials sheets for Pixi, three.js and GSAP,** with links to
   their official docs for the rest. They aren't left out, because the
   book's examples use them as much as our own libraries.
4. **An appendix in the book,** from the same data. It costs little once the
   data exists, and the printed book gains a reference card.

## 3. What a Sheet Holds

### 3.1 The sheets

Each sheet covers one task, whichever packages its names come from. The
first set:

| Sheet | Covers | Renderers |
| --- | --- | --- |
| Your project | `definePixiProject`, `defineHtmlProject`, `defineThreeProject`, what `start` is given, what it returns (`Ticked`) | Each its own |
| The tick | `setUpdate`, `setRefresh`, `updateView`, `refreshView`, `SKIP_DESCENDANTS`, `hasUpdate`, `hasRefresh` | All |
| Watching for changes | `watch`, `createReaction`, `createComputed`, `increased`, `decreased`, `changedFrom` | All |
| JSX | The attributes every element takes (`ref`, `visible`, `onRefresh`, `onUpdate`, getters for values that change), `List`, `Switch`, `Match`, the common elements | One variant each |
| Time and motion | `createBooleanTween`, `createEdgeTween`, `createMetronome`, `createSequence`, `createSequenceTracker`, `advanceTime` | All |
| Collections | `createSlotList`, `createOrderedSlotList`, and when to use each instead of `<List>` | All |
| Sound | The chip `start` is given (`sound`), `createAudio80Sound`, `createAudio80Song`, `play`, `queue`, `stop` | All |
| Pixi essentials | `Graphics` and its drawing calls, `Sprite`, `Text`, `Container`, `Texture`, positions, scale and tint | Pixi |
| three.js essentials | `Mesh`, the common geometries and materials, lights, `PerspectiveCamera`, positions and rotation | three.js |
| GSAP essentials | `gsap.to`, `gsap.timeline`, eases, and how to drive a timeline from `update` (Appendix E) | All |

A sheet says which renderers it applies to. The playground shows the sheets
that fit the open project's renderer, read from `main.ts` as the language
service already does, with a toggle to show all of them. The JSX sheet has a
variant for each renderer, because the elements differ.

### 3.2 An entry

Each entry has:

- **A name,** such as `createReaction`, or `Graphics.circle` for a member.
- **Where it comes from,** a `LibrarySpecifier`, which gives the import line
  (`import { createReaction } from '@mvtjs/utils'`).
- **A "use it for" line,** written by hand, in the book's voice. This is the
  part a doc comment doesn't give you. It says *when* you'd reach for this,
  not what it is. For example: "Play a sound, or start an animation, at the
  moment something changes."
- **A snippet,** written by hand, optional, three to eight lines.
- **A signature and a summary,** generated (section 4). The summary is the
  first sentence of the doc comment.
- **A link** into the book, optional, to the chapter that teaches it.

### 3.3 The data format

Typed TypeScript data, as the Help's sections are, in
`packages/sites/playground/cheat-sheets/`, one file for each sheet, with a
barrel:

```ts
export interface CheatSheet {
    readonly id: string;
    readonly title: string;
    /** A sentence saying what the sheet is for. */
    readonly summary: string;
    /** The renderers it applies to. Undefined is every renderer. */
    readonly renderers?: readonly RendererKind[];
    readonly groups: readonly CheatSheetGroup[];
    /** Where to read more, such as a library's official docs. */
    readonly moreAt?: readonly { readonly label: string; readonly url: string }[];
}

export interface CheatSheetGroup {
    readonly title: string;
    readonly entries: readonly CheatSheetEntry[];
}

export interface CheatSheetEntry {
    readonly name: string;
    readonly from: LibrarySpecifier;
    readonly useFor: string;
    readonly snippet?: string;
    /** A signature written by hand, for a name the generator can't describe well (section 4.2). */
    readonly signature?: string;
    /** The book's page that teaches it, by its path in the docs, such as `chapters/08-noticing-changes`. */
    readonly chapter?: string;
}
```

A file of plain data was chosen over Markdown. It's checked by the
compiler, it needs no parser, and it matches the Help.

### 3.4 Third-party sheets

The Pixi, three.js and GSAP sheets cover only what the book's examples and
the playground's starters use, which is a small part of each library. Each
ends with links to the official docs:

- Pixi: the guides at <https://pixijs.com/8.x/guides>, and the API at
  <https://pixijs.download/release/docs/index.html>.
- three.js: <https://threejs.org/docs/>, and the manual at
  <https://threejs.org/manual/>.
- GSAP: <https://gsap.com/docs/v3/>.

Their signatures are generated from their declarations, as ours are. These
sheets aren't checked for coverage (section 4.3), only for names that exist.

## 4. Generating the Signatures

### 4.1 The plugin

A Vite plugin, beside `libraryTypesPlugin`, provides
`virtual:cheat-sheets`. It makes a TypeScript program over the same sources
the type bundles use: our libraries and the `playground` module from their
sources, and Pixi, three.js and GSAP from `node_modules`. For each entry, it
finds the name among its specifier's exports, and writes:

- the signature, with `checker.signatureToString` for a function, or a
  short form of the type for a constant or an interface,
- the first sentence of the doc comment,
- the import line.

The result, the sheets with every entry filled in, is one JSON asset with a
hashed name. As with the type bundles, the dev server makes it on the first
request and keeps it in memory. The page loads it only when a sheet first
opens, so neither page gets slower to start.

The generator is a plain function, `makeCheatSheets()`, in
`packages/sites/playground/scripts/`. The plugin calls it, and so does the
book's data loader (section 8).

As built: the generator is `makeReferenceSheets()`, in
`scripts/make-reference-sheets.ts`, and the plugin is
`referenceSheetsPlugin()`, which provides `virtual:reference-sheets`. It
writes signatures from their parts, so type parameters show without their
constraints and optional parameters without `| undefined`. The built types
are `ReferenceSheet`, `ReferenceGroup` and `ReferenceEntry`, beside the
written ones in `cheat-sheets/`. An entry from a renderer's package that
every renderer's package exports, such as `setRefresh`, gets an import line
for each renderer (`importLineFor`), so the pane shows the project's own.
Making the sheets takes about 2 seconds after TypeScript loads.

### 4.2 Names that aren't exports

Some entries aren't exports:

- **Members,** such as `Graphics.circle` or the chip's `play`. The generator
  resolves `A.b` as a property of the instance type of the export `A`.
- **JSX attributes and elements,** such as `visible` or `<graphics>`. They
  come from each renderer's element tables, which are hard to describe
  well. These entries take a `signature` written by hand.
- **Signatures too generic to read.** `createReaction`'s options type, for
  one, prints as a wall of generics. An entry may give a `signature` by
  hand to replace the generated one. Its name is still checked.

### 4.3 The coverage test

A unit test, `cheat-sheets.test.ts`, runs the generator and fails when:

1. a sheet names something its specifier doesn't export, or a member that
   doesn't exist, whatever the library;
2. a public export of `playground`, the `@mvtjs` packages or `audio90` is on
   no sheet and not on the list of exports left out on purpose,
   `LEFT_OUT`, in the same folder. That list holds names such as
   `registerRenderer`, `countTick` and the JSX runtimes, each with a reason.

The second check means that a new API can't arrive without someone
deciding whether a cheat sheet should show it. The third-party libraries
aren't checked for coverage, since their sheets are selective by design.

## 5. The Reference Model and View

Both pages share one model and one view, in a new folder,
`packages/sites/playground/src/reference/`.

**`createReferenceModel`** holds:

- the sheets, `undefined` until they've loaded (as built, a settable
  `sheets` property, as the code style asks, rather than `setSheets`),
- the renderer to filter by, and whether to show every sheet anyway,
- the chosen sheet,
- the search query, and the entries that match it, across every sheet,
  by name first, then by "use it for" and summary,
- the expanded entry, which shows its snippet,
- the names to show first, for the embed's "Used in this example"
  (section 7).

**`ReferenceView`** (HTML JSX) shows a search box, a row of chips for the
sheets, and the chosen sheet's groups. Each row shows the name, the
signature and the "use it for" line, and expands to show the summary, the
snippet and the links. Each row has two actions:

- **Copy the import,** which copies the import line.
- **Go to the definition,** in the playground only, which opens the
  library's declarations read-only, as F12 already does.

While the sheets load, it shows "Loading...".

As built: the language service gained `libraryDefinition(specifier, name)`
for Go to definition. It appends a line or two that name the export, or the
member, to `main.ts` for a moment, asks where each points, and puts
`main.ts` back, loading the library's type bundle first if the project
doesn't import it. The view's rows are plain elements, made again only
when the model's rows change, since an entry mixes text and code.

## 6. In the Playground

- **The pane** sits to the right of the editor, between it and the run,
  with a divider of its own. It folds away completely, and the editor takes
  its space. (As revised: it covers the run instead, as the last item
  says.)
- **Opening it:** a button in the header, labelled "Cheat sheet", and a
  shortcut (section 11, question 1). The Help gains a paragraph about it,
  and each library in the Help's list links to its sheet. As built, the
  Help gains the paragraph and F1 in its keys, but its list of libraries
  doesn't link to the sheets: the Help's text is static, and the sheets
  are arranged by task, not by library.
- **The layout model** gains `isReferenceOpen`, `referenceWidth` (between
  240 and 640, 340 by default) and `resizeReference`. The settings store
  keeps both, as it keeps the other panes' sizes. (As revised: only
  `isReferenceOpen`, since the pane takes the run's width.)
- **The workspace model** owns a `ReferenceModel` as `reference`, as it owns
  `layout`, and loads the sheets the first time the pane opens.
- **Narrow screens:** `PanelKind` gains `'reference'`, a fourth tab after
  Files, Code and Run. Task 062 covers the rest of the narrow layout.
- The pane starts folded for a first visit, so the playground looks as it
  does today until someone opens it.
- As revised after the first review: the pane covers the run, in the run's
  column, rather than sitting between the editor and the run, so the
  editor keeps its width. The run goes on behind it, and the run's divider
  sizes both. There's no divider or width of the pane's own. A narrow
  screen hides the header's button, since the pane has its own tab there.

## 7. In the Embed

The embed has little room. It's 420px tall, and 480px more with the editor
open, and `TryIt.vue` already negotiates that height. So the sheet doesn't
add a pane. It opens as a drawer over the right of the embed's body, the
run and the editor both, about 360px wide, or the whole width when the
embed is narrower than 600px. (As revised: over the run only, as the
first item says.)

- As revised after the first review: the embed's bar moved below the run,
  so it sits between the run and the code. It lost the example's name and
  Open in the playground, which the book shows below the embed; a host
  page that wants them adds `title=1` and `playground-link=1` to the
  embed's hash. Edit became View code. The drawer covers the right of the
  run only, above the bar, so it never covers the code. The Cheat sheet
  button, and a Files button that opens a list of the example's files in
  place of a button for each, show only once the reader has pressed View code.
- **Opening it:** a "Cheat sheet" button in the embed's bar. Escape, the
  drawer's ×, or the button again closes it. The drawer takes the focus as
  it opens, so Escape reaches it rather than the running example.
- **Used in this example:** the drawer opens on a list of the names the
  example's files import, read with `es-module-lexer`, which the playground
  already uses. (As built: read with a regular expression over the
  TypeScript, in `findImportedNames`, since `es-module-lexer` reads
  JavaScript, and an import's names, not only its module, are needed.
  The chip is labelled "Used here".) Each name has its entry from whichever sheet holds it,
  with Your project first. The full sheets are one chip away. This is the
  embed's main point: a reader editing an experiment in Chapter 8, Noticing
  Changes, sees `watch` and `createReaction` at the top, the things the
  chapter is teaching.
- **Staying light:** the view and the sheets' JSON load only when the drawer
  first opens, as the editor loads only when the reader presses Edit. (As
  built: the JSON only. The view is small, and loading it later would need
  a place to put it once it arrived, as the editor has.)
- **No go to the definition,** since the embed has no language service.
  Entries link to the book's chapter, and the third-party sheets to the
  official docs.
- **The embed model** gains `isReferenceOpen`, with `openReference` and
  `closeReference`, and owns a `ReferenceModel` for the drawer. (As built:
  `toggleReference` in place of `openReference`, since the bar's button
  does both. An edit updates the renderer and the names used.)

## 8. In the Book

A new appendix, **G, API Cheat Sheets**
(`packages/sites/docs/appendices/g-api-cheat-sheets.md`), after F,
Troubleshooting, and listed in `book.ts`.

- A VitePress data loader, `cheat-sheets.data.ts`, calls `makeCheatSheets()`
  at build time. The docs add `@mvtjs/playground` as a dependency, and the
  playground's `package.json` exports the generator, so the import follows
  the declared-dependency rule.
- A Vue component, `<CheatSheets />`, renders every sheet in order: each
  group as a compact table of name, signature and "use it for", with the
  snippets below. Online, each sheet's title links to the playground with
  that sheet open.
- **In print,** the appendix is a reference card: two columns, small type,
  each sheet starting on a new page. Links print as addresses, as
  `TryIt.vue` prints them.

The appendix has a short introduction of its own: what the sheets are,
that they're open beside the code in the playground and the embeds, and
that each library's doc comments say more.

As built:

- **The data loader imports the playground's files by path,** as
  `TryIt.vue` finds the examples, rather than by the package's name.
  VitePress bundles a data loader's relative imports, but hands a
  package's to Node, which can't load the playground's TypeScript. So the
  docs declare no dependency, and the playground has no `exports`.
- **The page writes each sheet's `##` heading itself,** and a component,
  `<CheatSheet id="..." />`, renders that sheet's body. The site then
  numbers each sheet (G.1 to G.12) and lists it in the outline and the
  printed contents, as it does every other section. A test fails if a
  sheet has no section on the page.
- **Each entry** shows its name and "use it for", its signature, its
  snippet, its import line and its chapter, which prints as a page
  reference. There's no link to the playground per sheet.
- **In print,** the entries are one column, not two: Paged.js lays each
  page out as columns of its own, and the book's stylesheet avoids CSS
  columns. Small type, a rule between entries, and an entry is kept on
  one page. The sheets follow on from each other rather than each starting
  a page, which would leave many pages half empty. The book prints at 444
  pages.

## 9. Tests

- **The coverage test** (section 4.3).
- **The reference model's tests:** search, the renderer filter, the
  "Used in this example" ordering, and choosing and expanding.
- **The layout model's tests,** for the pane's width and folding, and the
  settings store's, for keeping them. (As revised: for opening and closing
  it only, since the pane has no width of its own.)
- **Visual tests,** with `htmlTest`, in `src/reference/visual-tests/`:
  `reference-view.test.tsx` posed loading, on a sheet, during a search and
  with an entry expanded. The playground view's tests gain a pose with the
  pane open, and the embed view's a pose with the drawer open.
- **The book:** `npm run build` and `npm run print -w @mvtjs/docs` show the
  appendix, online and in the PDF.

## 10. Costs and Risks

- **Writing the sheets is the bulk of the work.** Ten sheets of roughly ten
  to twenty entries each, every one with a "use it for" line in the book's
  voice. The coverage test keeps them honest, but someone still has to
  write them.
- **Generated signatures can be unreadable.** Heavy generics, overloads and
  three.js's long parameter lists need hand-written signatures (section
  4.2). Expect to add a dozen or so.
- **Another build step.** The generator runs a TypeScript program, as the
  type bundles do. It runs once for each dev server start and each build,
  only when something asks for the sheets.
- ~~**The embed's drawer covers part of the code** while it's open.~~ As
  revised, it covers part of the run instead, which goes on behind it. The
  run is short, at the embed's 420px less its bar, so the drawer has less
  height for its list than the playground's pane.
- **The Sound sheet may change soon,** if 080 merges the two chips.

## 11. Open Questions

Questions 2 to 4, and checking F1 in Firefox and Safari, moved to task
[017](../tasks/backlog/017-misc-loose-ends.md) as 089 was archived.

1. ~~**The shortcut.**~~ Settled: F1, with `preventDefault`, checked in
   Chromium. Firefox and Safari aren't checked yet. If F1 doesn't hold in
   one of them, add Ctrl+Shift+H. It won't work while the preview has the
   focus until task 063 is done.
2. **Should the editor's hover link to the sheet?** A hover over
   `createReaction` could end with "On the cheat sheet: Watching for
   changes". This is cheap once the data exists. Decide after using the
   pane for a while.
3. **Mark what the open file already uses?** The playground could mark the
   entries the active file imports, as the embed's "Used in this example"
   does. Useful, but it means watching the editor's text, so it's left for
   later.
4. **`llms.txt`.** The sheets would make a good compact reference for AI
   agents. Decide whether to add them to `packages/sites/docs/public/llms.txt`
   once the appendix exists.

## 12. Implementation Steps

1. ~~**The data and the generator** (sections 3.3 and 4): the types, the
   `LEFT_OUT` list, `makeCheatSheets()`, the plugin and
   `virtual:cheat-sheets`, and the coverage test, with one sheet (The tick)
   to prove the whole path.~~ Done.
2. ~~**Our own sheets** (section 3.1): Your project, The tick, Watching for
   changes, JSX for each renderer, Time and motion, Collections, Sound,
   until the coverage test passes.~~ Done.
3. ~~**The reference model and view** (section 5), with their tests and
   visual tests.~~ Done.
4. ~~**The playground's pane** (section 6): the layout and workspace models,
   the settings store, the divider, the header button, the shortcut, the
   narrow-screen tab, and the Help's paragraph and links.~~ Done.
5. ~~**The embed's drawer** (section 7): the button, the drawer, "Used in
   this example", and loading it on first open.~~ Done.
6. ~~**The third-party sheets** (section 3.4): Pixi, three.js and GSAP
   essentials, with their links.~~ Done.
7. ~~**Appendix G** (section 8): the data loader, `<CheatSheets />`, its print
   styles, and `book.ts`.~~ Done.
8. ~~**The repo's own pages:** `cheat-sheets/` in `AGENTS.md`'s project
   structure and in [Project Structure](../../packages/sites/docs/working-in-this-repo/project-structure.md).
   The coverage test's failure message says what to do with a new export:
   add it to a sheet, or to `LEFT_OUT` with a reason. A line in the code
   review skill's checklist says the same.~~ Done.

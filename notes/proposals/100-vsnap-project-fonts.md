# Proposal: v-snap: Canvas Text in a Project's Own Fonts

> v-snap draws canvas text in software, in two fonts of its own, so every
> machine draws it alike. A game that draws its text in its own fonts gets
> test images in the wrong font, and its text-fit bugs go unseen. This
> proposal lets a project register its own font files for named families,
> in the `vsnap()` plugin's options. v-snap lays them out and draws them
> through the same software path. Images still repeat on every machine,
> projects that register nothing draw exactly as before, and the generic
> family at the end of each font list is needed only for families that
> aren't registered.

**Status:** proposed. Nothing built. Its questions were decided on
2026-11-17, as recommended (section 14).

**Written:** 2026-11-17, on `vnext` at 16f5755c, with `v-snap` 0.6.0
published. Checked against v-snap's canvas text, page setup, config
loading and docs. Nothing measured yet.

**Related:**
[canvas-text.ts](../../packages/libraries/v-snap/src/browser/canvas-text.ts)
(the software text path),
[page-setup.ts](../../packages/libraries/v-snap/src/browser/page-setup.ts)
(the order of set-up),
[view-kinds.ts](../../packages/libraries/v-snap/src/browser/view-kinds.ts)
(`vsnap.config.ts` and `defineVsnapConfig`),
[node/config.ts](../../packages/libraries/v-snap/src/node/config.ts)
(the `vsnap()` options and what the page is `provide`d),
[Limits and Rules](../../packages/libraries/v-snap/docs/limits-and-rules.md),
[How It Works](../../packages/libraries/v-snap/docs/how-it-works.md),
[Troubleshooting](../../packages/libraries/v-snap/docs/troubleshooting.md),
[042](../archive/042-visual-snapshot-tests.md) (v-snap's design).

| Decision | Recommendation | Section |
| --- | --- | --- |
| Where fonts are registered | `vsnap({ fonts })` in the Vitest config, as file paths, not `vsnap.config.ts`. They load before any project code runs | 3 |
| Config shape | A family name to one file, a list of files, or `@font-face`-like faces (`src`, `weight`, `style`). Weight and style are read from each file unless given | 4 |
| Choosing a family | Walk the CSS font list in order. The first registered family wins, then today's known and generic families. A registered family is never unpinned | 5.1 |
| Choosing a face | CSS's own font matching: style first, then the nearest weight by CSS's rule. A variable face takes its exact weight | 5.2 |
| Italic | An italic face if there is one, then an `ital` or `slnt` axis, then today's slant | 5.3 |
| Bold with no bold face | Not synthesised in the first version, and said so in the docs | 5.4 |
| Missing characters | Fall back run by run, as browsers do: the list's later registered families, then v-snap's stand-in, then the hex box | 6 |
| Generic families | A project may register `sans-serif` and `monospace` to replace v-snap's stand-ins. A second step | 7 |
| Exactness for others | Projects with no `fonts` draw byte-identical images; the whole repo's visual tests are the check | 9 |
| Not chosen | Reading the page's `@font-face` rules; the browser's own text engine; fonts declared per test file | 11 |

---

## 1. Why

Games often draw canvas text in their own fonts. Under v-snap, that text
draws in Source Sans 3 or Source Code Pro instead. Three things follow:

- **Text fit isn't tested.** As
  [Limits and Rules](../../packages/libraries/v-snap/docs/limits-and-rules.md)
  says, a line that overflows in your font may fit in the image.
  Overflow and fit-to-width bugs are just what visual tests should catch,
  and they go unseen.
- **Every font list must end with a generic family,** or the test fails
  with "asks for fonts that visual tests can't draw".
- **The images look less like the game,** which makes them harder to
  review. A reviewer has to remember which differences are v-snap's and
  which are real.

## 2. How Canvas Text Works Today

`setUp()` in `page-setup.ts` loads the two bundled variable fonts with
`fontkit` and calls `installCanvasText({ sans, mono })`. That replaces
`fillText`, `strokeText` and `measureText` on both 2D context prototypes,
for the page's whole life.

For each CSS font string, `parse()` reads the style, weight, size and
family list. It walks the list for the first family in `MONO_FAMILIES` or
`SANS_FAMILIES` (the generic families and common system fonts). A list
with neither is recorded as unpinned, and the test fails after its pose.
`findVariation()` takes the weight from the variable font's `wght` axis.
Italic and oblique text is sheared by `ITALIC_SHEAR`.

`lay()` lays the whole string out in one font, with kerning. `layOutPath()`
turns each glyph into `Path2D` commands, and draws a hex box, in the mono
font's digits, for each glyph 0 (a character the font lacks).

## 3. Where Fonts Are Registered

The suggestion puts `fonts` in `vsnap.config.ts`, with each file imported
with `?url`. This proposal puts it in the `vsnap()` plugin's options
instead, as paths relative to v-snap's root:

```ts
export default defineConfig({
    plugins: [vsnap({
        fonts: {
            NexaBook: 'raw-assets/fonts/NexaBook.woff',
            NexaBold: { src: 'raw-assets/fonts/NexaBold.woff', weight: 700 },
            NexaHeavyMonoSpace: 'raw-assets/fonts/NexaHeavyMonoSpace.woff',
        },
    })],
});
```

The reason is order. `vsnap.config.ts` is a module, and its imports run
before its default export can be read. Those imports are the project's own
code, and some of it draws text as it loads. Pixi's `BitmapFont.install`
at module level is the common case: it fills every glyph into a texture
with `fillText`, there and then. If the fonts were only known once the
config had loaded, that text would already be drawn in v-snap's stand-in,
and cached for the rest of the page's life. The image would be wrong, and
nothing would say so. Fonts given to the plugin reach the page through
Vitest's `provide`, so the page can load them before it imports any
project code.

The plugin options fit fonts in other ways, too:

- **They are data, not code.** The plugin already holds the page's other
  surroundings, such as `viewport` and `colorScheme`. `vsnap.config.ts`
  holds code that must run in the page, which fonts are not.
- **Node can check them before the browser starts.** The plugin resolves
  each path, checks that the file is there, and parses it with `fontkit`
  (already a dependency). A wrong path or a file that isn't a font fails
  at once, with the family named, instead of in the first test.
- **v-snap can serve them itself.** The plugin adds each font's folder to
  `server.fs.allow`, so a font outside the project root needs no Vite
  setting, and the troubleshooting entry for it stays short.
- **No `?url` imports,** and no type declarations for them in a project
  that has none.

The cost is that a project's canvas settings live in two files. The
plugin's `vsnapConfig` option already points a reader from one to the
other, and the docs for `vsnap.config.ts` would say where fonts go.

HTML pages don't load the registered fonts at all, since their text is
set in the blank font (see section 10).

## 4. The Shape of the Option

```ts
/** A family's font files, by path, relative to v-snap's root. */
readonly fonts?: Readonly<Record<string, FontSource | readonly FontSource[]>>;

type FontSource = string | {
    readonly src: string;
    /** A weight, or a range for a variable font. By default, read from the file. */
    readonly weight?: number | readonly [number, number];
    /** By default, read from the file. */
    readonly style?: 'normal' | 'italic';
};
```

- **One file, or several.** `NexaBook: 'NexaBook.woff'` registers one
  face. `Nexa: ['Nexa-Book.woff', 'Nexa-Bold.woff']` registers a family of
  faces, one per file.
- **Weight and style come from the file.** A static face's weight is its
  `OS/2` weight class, and it's italic if its `OS/2` selection flags or
  its italic angle say so. A variable face's weight range is its `wght`
  axis. So most projects list files and nothing else.
- **Descriptors override the file,** as `@font-face` does, for a file whose
  tables are wrong or for a face that is used as another weight. Readers
  know the names from CSS.

The suggestion's other shape, a map from weight to file
(`NexaBold: { 700: nexaBold }`), is not chosen. It can't say a face's
style without nesting another level, and it repeats what the file already
says.

**Family names** are matched without regard to ASCII case, as CSS matches
them, and with their quotes removed, as `parse()` does today. Two keys
that differ only in case are an error. A key that is a generic family
name is section 7's case.

**Formats** are what `fontkit` reads: OpenType (CFF and CFF2), TrueType,
WOFF and WOFF2. A collection (`.ttc`) is an error in the first version,
since a path can't say which of its fonts to use.

## 5. Choosing a Font for a CSS String

### 5.1 The family

`parse()` walks the font list in order. For each family, a registered
family wins. Otherwise a known or generic family picks v-snap's mono or
sans font, as today. The first family that either finds ends the walk.
So `'NexaBold, sans-serif'` draws in NexaBold, and `'Arial, NexaBold'`
draws in v-snap's sans font, as a browser with Arial would.

A registered family is never unpinned, so its list needs no generic
family. Only a list with neither a registered nor a known family is
unpinned and fails, as today.

### 5.2 The face

Within a registered family, v-snap picks a face by CSS's own font matching
(CSS Fonts 4, section 5.2), so a test picks the face the browser would:

1. **Style first.** For `italic`, the italic faces, else the normal ones.
   For `normal`, the normal faces, else the italic ones. Oblique is
   treated as italic, as v-snap treats it today.
2. **Then weight.** A face whose weight or range holds the weight asked
   for is used, at that weight. Otherwise the nearest, by CSS's rule:
   - asked for 400 to 500: heavier faces up to 500, then lighter faces,
     nearest first, then faces heavier than 500;
   - asked for less than 400: lighter faces, nearest first, then heavier;
   - asked for more than 500: heavier faces, nearest first, then lighter.

A variable face is set to the weight asked for, clamped to its range,
with `getVariation({ wght })`, as `findVariation()` does now. A static face
is used as it is. The cache of variations moves from a string key
(`'mono:700'`) to one map per base font, so registered fonts share it.

### 5.3 Italic

An italic face is used if the family has one. Otherwise, a variable face
with an `ital` axis is set to 1, or one with a `slnt` axis to its most
slanted value up to -14 degrees (CSS's default oblique angle). Only when
there is none of these is the text sheared by `ITALIC_SHEAR`, as today.

### 5.4 Bold with no bold face

A browser fakes bold when a family has no face heavy enough (CSS's
`font-synthesis`), by thickening the outlines. Here that would mean
stroking each glyph's outline as it fills, which gets tangled up with a
project's own `strokeText` and with `measureText`'s bounding boxes. So the
first version doesn't fake bold. A family with only a regular face draws regular text when bold is
asked for, and the docs say so, with the fix: register the bold file. See
section 14, question 2.

## 6. Characters a Font Lacks

A registered font may lack characters that the text uses: a display font
with only capitals, or a pixel font with no `★`. Browsers fall back per
character, through the rest of the font list and then the system's
fonts. v-snap would do the same, with its own fonts in place of the
system's:

1. the later registered families in the list, in order;
2. v-snap's stand-in that the list's generic family picks, or the sans
   font if it has none;
3. the hex box, as today.

That means `lay()` lays text out in runs: it splits the string into the
longest stretches that one font can draw, lays each out on its own, and
joins their positions. Kerning applies within a run, not across one, as
in browsers. The run that reaches step 3 is laid out in the stand-in and
drawn as boxes, as glyph 0 is now, so the boxes look the same as today's.
The box's digits stay in v-snap's own mono font, whatever is registered,
so a box looks the same in every project.

Going straight to the box is simpler, but it would draw `★` as a box in a
game where the browser draws a star, and the test image is then less like
the game than it is today. Not chosen.

## 7. A Project's Own Default Sans and Mono

A project may register the keys `sans-serif` and `monospace`. Then that
font replaces v-snap's sans or mono stand-in for every family that picks
it: the generic family itself, and the known system fonts mapped to it,
such as Arial or Consolas. So a project whose views say only `sans-serif`
can still draw in its own font. The other generic families (`serif`,
`cursive` and so on) still pick the sans stand-in, as today, and a key for
one of them is an error, so that it can be added later.

This is useful but separate, so it is the second implementation step, not
the first.

## 8. The Order of Set-Up

`setUp()` becomes:

1. watch shadow roots, install the seeded `Math.random`;
2. load v-snap's two fonts, **and the registered fonts, at the same
   time**, if this is a canvas page;
3. `installCanvasText({ sans, mono, families })`, with the registered
   families from the start, so nothing is drawn before they are known;
4. HTML rules, calibration, then `loadViewKinds()` and `resetRandom()`, as
   today.

Fonts load before `resetRandom()`, as its comment requires. Calibration
draws only in v-snap's own fonts, since its images ask only for families
v-snap knows. So registered fonts can't change the calibration check, and
that check still proves that v-snap's path draws alike on this machine.

The page fetches each font from a URL the plugin passes it (`/@fs/` and
the absolute path, which Vite serves once the folder is allowed). A fetch
that fails names the family and the file, in the style of today's
"couldn't load its test font" error.

## 9. Why Images Still Repeat Everywhere

The three things that make v-snap's own fonts safe hold for registered
ones:

- the font file is the same bytes on every machine, committed with the
  project;
- `fontkit` does the layout, not the operating system, the same version
  that lays out v-snap's own fonts;
- each glyph is filled as a path, which Skia draws the same everywhere,
  as the calibration set checks on every run.

**Projects with no `fonts` must draw byte-identical images.** The runs in
section 6 change `lay()` for everyone, so a single-run string must lay out
exactly as now: same glyphs, same positions, same box. The check is this
repo's own visual tests, every entry and view, run with no reference
image changed, plus v-snap's own.

## 10. Out of Scope

- **HTML text.** Blink lays it out and the system draws it, so there is no
  glyph to intercept. HTML text stays in the blank font, and HTML pages
  don't load registered fonts.
- **Text not drawn through the 2D text methods,** such as Pixi's
  `HTMLText`, which draws through an SVG image.
- **An exact match with the browser's own drawing.** `fontkit`'s shaping
  isn't HarfBuzz, and there's no hinting. Latin text with kerning comes
  close. Ligatures, other OpenType features and complex scripts may
  differ. The images are still deterministic, and closer to the game than
  today.

## 11. Not Chosen

- **Reading the page's own `@font-face` rules,** or `document.fonts`.
  A `FontFace` doesn't expose its bytes, a test page often doesn't load
  the game's stylesheet, and what drew would depend on what the page had
  loaded so far. Do not reopen without new information.
- **The browser's own text engine, with the font loaded as a web font.**
  That is what v-snap's software path exists to avoid: each system
  positions and antialiases glyphs its own way.
- **Fonts in `vsnap.config.ts`,** the suggestion's place for them. See
  section 3: project code can draw text before the config's export is
  read.
- **Fonts declared per test file,** by a call in the file or a comment
  that the plugin reads, like `// @vitest-environment`. Decided
  2026-11-17, for two reasons:
  - *A test file's imports run before its body.* The view under test, and
    the game code under it, load before any statement in the file, so a
    call there comes too late for text drawn as a module loads, as in
    section 3. A side-effect import placed first doesn't help: loading a
    font is async, and a module with top-level `await` holds up only the
    modules that import it, not its siblings.
  - *Canvas test files share one page.* Canvas projects run with
    `isolate: false`, so a font one file registered would stay registered
    for every file after it, and glyph caches one file built would carry
    into the next. Whether a file's text drew in the game's font would
    depend on which files ran before it, so running one file alone and
    running the whole suite could draw different images. A comment read
    in Node gets past the first reason but not this one. Giving those
    files a fresh page each would need v-snap to split them into an
    isolated project of their own, and they'd lose the shared page's
    speed.

  Fonts belong to the game, not to a test, so every test of a game wants
  the same ones. In a repo with many entries, one map still works, since a
  registered family applies only where a font list names it. A project
  that wants each entry's fonts listed beside the entry can have its
  Vitest config import their paths from the entry's folder and pass them
  to `vsnap({ fonts })`; that runs in Node, so the order of loading
  doesn't come into it. Do not reopen without new information.

## 12. Docs and Licensing

- **[Configuration](../../packages/libraries/v-snap/docs/configuration.md):**
  the `fonts` option, with an example and the face matching in a sentence
  or two.
- **[Limits and Rules](../../packages/libraries/v-snap/docs/limits-and-rules.md):**
  the canvas text limit says text draws in your registered fonts, or
  v-snap's own; the font-list rule says the generic family is needed only
  for families you haven't registered; a new limit says bold isn't faked.
- **[How It Works](../../packages/libraries/v-snap/docs/how-it-works.md):**
  why registered fonts still draw alike everywhere.
- **[Troubleshooting](../../packages/libraries/v-snap/docs/troubleshooting.md):**
  the new load and parse errors, and the unpinned-family entry mentions
  `fonts` as the other fix.
- **Licensing:** a short note in Configuration. Registering a font commits
  its file to the project's repo and serves it to a local test page. A
  game that ships the font in its bundle has usually covered that, but
  some licences limit copies, so check yours. No more than a note.

A changeset for a minor version of v-snap goes with the first step.

## 13. Tests

- **v-snap's own visual tests** register fonts and draw with them. Two
  small static faces, Source Sans 3 Regular and Bold cut to ASCII, under
  the OFL that the package already ships, kept as test fixtures and left
  out of the published files. Images for: a registered family, a weight
  between the faces (picks by CSS's rule), italic with no italic face
  (sheared), a character the face lacks (falls back to the stand-in), and
  a list with no generic family (passes).
- **A unit test of face matching,** since the rule has three branches and
  a mistake picks the wrong face silently. One table of asked-for weights
  and the face each picks, checked at once.
- **Measurement:** a test that `measureText` widths come from the
  registered font, by fitting a line to a width that fits in one font and
  not the other.
- **Node-side checks:** a missing file, a file that isn't a font, a `.ttc`,
  and two keys that differ in case, each fail with a clear message.

## 14. Questions, Decided

1. **Plugin options or `vsnap.config.ts`?** Section 3 argues for the
   plugin. If the split across two files bothers more than the load order,
   the alternative is `vsnap.config.ts` with a rule that project code must
   not draw text as it loads. That rule would be hard to keep, and its
   failure is silent.
   **Decided (2026-11-17): the plugin's options,** as section 3
   recommends.
2. **Fake bold?** If projects with a regular face only are common, v-snap
   could thicken glyphs by stroking each run's path as it fills, at the
   width Skia uses. It needs care with `strokeText` and with
   `measureText`'s bounding box.
   **Decided (2026-11-17): not in the first version,** as section 5.4
   says. The docs give the fix, registering the bold file. Reopen if
   projects with a regular face only turn out to be common.
3. **Should a missing file only warn,** and fall back to the stand-in, so a
   project can run its tests before its fonts are in place?
   **Decided (2026-11-17): no, it fails,** as recommended. A test that
   silently draws in the wrong font is what this proposal removes.

## 15. Implementation Steps

1. `fonts` in `VsnapOptions`: resolve, check and parse each file in Node,
   read its descriptors, add its folder to `server.fs.allow`, and
   `provide` the faces to canvas pages.
2. The page loads the faces with v-snap's own, before anything else draws.
   `installCanvasText` takes them; `parse()` walks the list for registered
   families first; face matching (section 5.2) and italic (5.3); the
   variation cache keyed by font.
3. Runs and fallback (section 6). Check that the repo's visual tests and
   v-snap's own change no reference image.
4. v-snap's own fixture fonts and tests (section 13).
5. Docs (section 12) and a changeset.
6. Generic keys, `sans-serif` and `monospace` (section 7), with their own
   tests and docs.

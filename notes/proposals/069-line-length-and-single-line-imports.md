# Proposal: a line length of 120, and single-line imports

> Give the repo a line length, 120 characters, that it has followed by habit
> but never written down or checked. Then enforce it with `@stylistic/max-len`.
> Then add a rule of our own, `@mvtjs/single-line-imports`, that writes every
> import and re-export on one line within that length, and fixes them itself.
> Then turn that rule on everywhere. Four stages, each one landed and reviewed
> before the next. The payoff is that every imported name sits on the same
> line as the module it comes from, so a search for a name and its module
> always finds it.

**Status:** proposed. Nothing built.

**Written:** 2026-10-21, against vnext at `a4db4a34` plus the unstaged
chip-clock work. Measured by running ESLint over the whole repo with the
rule added on the command line, and by scripts over every tracked `.ts`,
`.tsx` and `.mts` file but `.d.ts` files (1,408 files).

**Related:**
[eslint.config.ts](../../eslint.config.ts),
[packages/tools/eslint-plugin/](../../packages/tools/eslint-plugin/README.md),
[.editorconfig](../../.editorconfig),
[.vscode/settings.json](../../.vscode/settings.json),
[the style guide](../../packages/sites/docs/reference/style-guide.md),
[skill-code-style.md](../../packages/sites/docs/ai-agents/skill-code-style.md),
[AGENTS.md](../../AGENTS.md).

| Decision | Recommendation | Section |
| --- | --- | --- |
| The line length | 120 characters, written in one place in `eslint.config.ts` and shared by both rules | 2 |
| How it is checked | `@stylistic/max-len`, ignoring strings, template literals, URLs and regular expressions, but not comments | 3 |
| How the existing long lines are fixed | By hand, a package at a time, with the rule turned off for packages not yet done | 3.3 |
| What the import rule checks | Every `import` and `export ... from` with named bindings: one line, at most 120 characters, one canonical shape for each module | 4 |
| How it shortens a long declaration | The cascade: merge, then split values from types, then split into the longest lines that fit | 4.2 |
| What it never touches | Side-effect imports, namespace imports and exports, `export *`, and declarations with comments inside | 4.5 |
| The order of names | As written. The rule never sorts | 4.4 |
| When it is turned on | After the rule's own tests pass, by running `lint:fix` over the repo and reviewing the result | 5 |

---

## 1. Where the Repo Is Today

Nothing sets a line length. `.editorconfig` has no `max_line_length`,
`eslint.config.ts` doesn't turn on `@stylistic/max-len` (and the
`stylistic.configs.customize` preset doesn't either), `.vscode/` has no
rulers, and neither the style guide nor AGENTS.md mentions one. Most code
stays under 120 by habit, but 2,228 lines are longer, in 608 files.

Imports are written three ways:

- **One line, of any length.** The longest is 686 characters, in
  [fuel-run's game-model.ts](../../packages/sites/arcade/src/entries/fuel-run/models/game-model.ts).
  203 import declarations are longer than 120 characters when written on one
  line.
- **Over several lines.** 155 import declarations and 66 re-exports. Some
  have one name per line, some several.
- **The same module imported twice**, usually once for values and once with
  `import type`. 21 files do this with imports, and 9 with re-exports.

Types are imported both ways too: 599 declarations mix values and types
inline (`import { a, type B }`), and 613 use `import type`.

## 2. Stage 1: Write Down 120

This stage changes no code. It records the number, so that people, editors
and agents all see the same one.

- `eslint.config.ts` gets one constant, `MAX_LINE_LENGTH = 120`, that stages
  2 and 4 both pass to their rules. One number, so the two rules can never
  disagree about what fits.
- `.editorconfig` gets `max_line_length = 120` for code files. JetBrains
  editors draw a guide from it and some VS Code extensions read it.
- `.vscode/settings.json` gets `editor.rulers: [120]` for TypeScript and
  JavaScript, since VS Code doesn't read `max_line_length` on its own.
- The style guide's formatting rules say "lines are at most 120 characters",
  and so do the summaries of them in AGENTS.md and `skill-code-style.md`.

Markdown is left out. The docs and notes are prose, which wraps as it
likes, and their tables can't be broken.

## 3. Stage 2: Enforce 120

### 3.1 The rule and its options

`@stylistic/max-len` with `code: MAX_LINE_LENGTH`, `tabWidth: 4`, and:

- `ignoreStrings`, `ignoreTemplateLiterals` and `ignoreRegExpLiterals`, since
  a long message or pattern reads worse broken up with `+`.
- `ignoreUrls`, since a link can't be broken.

Comments are checked. They are prose we write ourselves, and rewrapping
them is always possible.

### 3.2 What it reports

| Options | Lines reported | Files |
| --- | --- | --- |
| None | 2,228 | 608 |
| Those in 3.1 | 1,045 | 411 |

Of the 1,045:

- **103** are in one generated file,
  [refresh-copies.ts](../../packages/libraries/utils/src/jsx/refresh-copies.ts).
  Its generator writes a long parameter list 17 times. The fix is in the
  generator, and then the file is generated again.
- **319** are comment lines.
- **About 600** are code. Most are a call with an options object, a
  condition with several parts, or a signature with an inline object type.
  230 lines are over 140 characters, 47 over 160, and 2 over 200.
- **21** are JSX.

One thing to know about `ignoreStrings`: it skips any line that *contains* a
string, not just lines that are one long string. Every import and re-export
line has a string, its module id, so `max-len` never checks them. That is
fine here, because stage 4's rule checks them instead. But it also lets
through a long line of code that happens to contain a short string. Section
8 asks whether to tighten that later.

### 3.3 How the lines get fixed

`max-len` reports but can't fix, so this is done by hand. To keep it
reviewable:

1. Turn the rule on as an error everywhere, with an override that turns it
   off for the packages not yet done.
2. Fix one package at a time (the generator first), and remove that package
   from the override in the same change. New long lines can't creep back
   into a package that is already done.
3. When the override is empty, delete it.

How each kind of line is fixed:

- **Comments:** rewrap the paragraph, keeping its sentences as they are.
- **Calls and conditions:** break after an operator or a comma, in the shape
  `@stylistic` already enforces (operators at the start of the line).
- **Signatures with inline object types:** name the type. It usually reads
  better anyway.
- **An `eslint-disable-next-line` comment** only where breaking the line
  would make it worse, such as a table of data whose columns line up, with a
  reason given.

The number of lines is large, but the work is mechanical, and a package at a
time keeps each diff to a size someone can review.

## 4. Stage 3: Add `@mvtjs/single-line-imports`

### 4.1 What it checks

Every `import` declaration with named bindings or a default, and every
`export { ... } from` re-export, must be:

- on one line,
- at most `maxLength` characters, counted from the start of the line, so an
  import inside an indented `declare module` block counts its indentation,
- in its module's canonical shape, which is what the cascade in 4.2 produces.

One option, `maxLength`, which defaults to 120. The config passes
`MAX_LINE_LENGTH`.

Imports and re-exports are handled separately: an import is never merged
with a re-export of the same module.

### 4.2 The cascade

For each module, gather every name imported from it in the file. Then:

1. **Merge.** Write them all as one declaration. If it fits, that is the
   shape. Types that share a declaration with values are written inline,
   `import { a, type B } from 'x'`. If every name is a type, it is written
   `import type { A, B } from 'x'`.
2. **Split values from types.** Otherwise, write the values in one
   declaration and the types in an `import type` declaration. Each one that
   fits is done.
3. **Split by length.** For each declaration still too long, take the longest
   run of names from the front that fits, as one declaration. Do the same
   with what is left, until every name is placed.
4. **One name that doesn't fit** stays as it is, on one line. It can't be
   shortened, and isn't reported.

Re-exports follow the same steps with `export` and `export type`.

Here is what it does to the long import in
[audio90-driver.ts](../../packages/libraries/audio90/src/music-player/audio90-driver.ts),
which is 531 characters merged:

```ts
import { AUDIO90_CHARACTERS, AUDIO90_EFFECT_INDEX, AUDIO90_EFFECT_SETTING_INDEX } from '../audio90';
import { AUDIO90_VOICE_COUNT, AUDIO90_VOICE_SETTING_INDEX, createAudio90ChannelState, OP90_NOTE_OFF } from '../audio90';
import { OP90_NOTE_ON, OP90_RESERVE_VOICES, OP90_SET_CHARACTER, OP90_SET_EFFECT, OP90_SET_TEMPO } from '../audio90';
import { OP90_SET_VOICE, releaseAudio90Song, writeAudio90Row, writeAudio90SongStart } from '../audio90';
import { writeAudio90TempoScale } from '../audio90';
import type { Audio90, Audio90Writer, Audio90EffectId, Audio90EffectSetting, Audio90Instrument } from '../audio90';
import type { Audio90Song, Audio90VoiceSetting } from '../audio90';
```

### 4.3 Why the shape is canonical

The rule doesn't just check that each line is short. It works out the shape
the cascade gives, and reports when the file differs. So, for example,
`import type { A } from 'x'` beside `import { b } from 'x'` is reported when
`import { b, type A } from 'x'` would fit. That means the result depends only
on which names a file imports from each module, and in what order, never on
how someone happened to write them.

Without the rule for type-only modules in step 1, every one of the 613
`import type` declarations would be rewritten as `import { type A }`. An
early estimate that left it out touched 540 files rather than 182.

Running the fix twice changes nothing. Whether a merged declaration fits
doesn't depend on the order of its names, so steps 1 and 2 decide the same
way each time. Step 3 reads the names back in the order it wrote them, so it
splits them the same way each time.

### 4.4 Details

- **Order.** Names keep the order they are written in: by declaration, then
  within each. The rule never sorts. Sorting would make every first run
  noisier, and it is a separate decision.
- **Where the result goes.** The merged declaration replaces the module's
  first value import, so the order modules load in doesn't change. In step 2,
  the `import type` line goes right after the value line. The other
  declarations are removed, with their lines.
- **Defaults.** `import X, { a }` merges, and the default stays at the front
  of the first declaration. A type-only default (`import type X from`) can't
  share a declaration with named imports in TypeScript, so it stays on its
  own.
- **Renamed names** (`a as b`, `default as X`) are kept as written.
- **Import attributes** (`with { type: 'json' }`): only declarations with the
  same attributes merge, and the attributes count towards the length.
- **The fix.** One fix per module, replacing the first declaration and
  removing the rest. If other statements sit between them, ESLint applies
  fixes from other rules on later passes, as usual.

### 4.5 What it never touches

- Side-effect imports, `import 'x'`.
- Namespace imports and exports, `import * as ns` and `export * as ns`, which
  can't share a declaration with named imports, and `export * from`.
- `import x = require('x')`, and dynamic `import()`.
- A declaration with a comment inside its braces. It is still reported if it
  is too long or spans lines, but not fixed, so the comment is never lost.
  There are none in the repo today.

### 4.6 One change in behaviour

`tsconfig.base.json` sets `verbatimModuleSyntax`. Under it,
`import { type A } from 'x'` still loads `x` when the code runs, for its side
effects, but `import type { A } from 'x'` doesn't. Step 1 writes a type-only
module as `import type`, so in the 2 places that use the inline form for
types alone today, `x` stops being loaded. Both should be checked when the
fix is run (stage 4), though neither module is expected to have side effects.

### 4.7 Rules it must not be combined with

These would fight steps 2 and 3, each undoing the other's fix:

- `import/no-duplicates` (eslint-plugin-import is already loaded, for
  `no-extraneous-dependencies`),
- core ESLint `no-duplicate-imports`,
- `@typescript-eslint/consistent-type-imports`.

None is turned on. The config's comment beside the rule says to keep it that
way.

### 4.8 Building it

- The rule lives in
  `packages/tools/eslint-plugin/src/rules/single-line-imports.ts`, with its
  tests in `single-line-imports.test.ts` beside it, using `RuleTester` as the
  other rules do. It joins the `style` preset.
- It uses only the plain ESLint rule API and the node types every ESTree
  parser gives (`ImportDeclaration`, `ExportNamedDeclaration`, `importKind`,
  `exportKind`, `specifiers`, `attributes`), so it still loads in Oxlint, as
  the plugin's README promises.
- The tests cover each step of the cascade, the shapes in 4.4 and 4.5, a
  second run changing nothing, and indented declarations.
- The plugin's README lists it, and the style guide's section on imports
  describes the shape it gives, with the example from 4.2.

In this stage the rule is registered but not turned on, except to try it on
a few files from the command line.

## 5. Stage 4: Enforce Single-Line Imports

Turn the rule on as an error for every file the first config block covers,
with `maxLength: MAX_LINE_LENGTH`, and run `npm run lint:fix`.

Estimated from a script that handled named imports only, so these figures
are approximate:

| Max length | Files changed | Import declarations, before → after | Modules done at step 2 | Modules done at step 3 |
| --- | --- | --- | --- | --- |
| 120 | 182 | 3,594 → 3,904 | 63 | 143 |

Re-exports add to that: of 558, 66 span lines, 86 are over 120 characters on
one line, and 9 files re-export from the same module twice.

Unlike stage 2, this one is a single change, since the fix is automatic. To
check it:

- `npm run build`, for the types,
- `npm test`,
- `npm run build:packages`, since barrel files change shape, and the
  published types must not,
- the two modules from 4.6.

Stages 2 and 4 don't depend on each other: `max-len` skips import lines
(section 3.2), and the import rule checks nothing else. Stage 4 could go
before stage 2 if that turns out easier.

## 6. Costs and Risks

- **Noisier diffs for long lists.** Adding a name near the front of a list
  that spans several lines pushes later names along, so every line after it
  changes. A list with one name per line would change by one line. This
  affects about 140 modules at 120 characters, and is the main cost.
- **A short last line.** Step 3 fills each line greedily, so the last one can
  hold a single name, as `writeAudio90TempoScale` does in 4.2. Section 8 asks
  whether to balance the lines instead.
- **The module id repeats** on each line of a split. That is the point, for
  searching, but it is more to read than one module id under a list.
- **Editors.** VS Code's auto-import adds a name to an existing declaration
  and leaves it long. `lint:fix`, or fixing on save, rewrites it. Until then
  the file shows an error.

## 7. Settled Questions

Do not reopen these without new information.

- **Nothing existing does this.** `@stylistic/max-len` reports but can't
  fix. `import/no-duplicates` (with `prefer-inline`) merges, but never
  splits. `@typescript-eslint/consistent-type-imports` picks one style for
  types everywhere, with no regard to length. The repo uses no formatter,
  and Prettier, the usual one, writes long imports over several lines,
  which is what this replaces.
- **One line per declaration, not one name per line.** Searching is the
  reason: a name and its module on one line.
- **The line length is 120.** Most code already keeps to it.

## 8. Open Questions

1. **Tighten `ignoreStrings` later?** It lets through long code lines that
   contain any string. An `ignorePattern` matching only lines that are mostly
   a string would be stricter. Worth looking at once stage 2 is done, when
   the remaining lines show what is really needed.
2. **Balance the lines in step 3?** Splitting n names into the fewest lines,
   and then spreading them evenly, would avoid a short last line. It is a
   little more code, and the result still repeats each time. The cascade as
   written fills greedily.
3. **Fix on save in VS Code?** `editor.codeActionsOnSave` with ESLint would
   rewrite imports as they are added. A matter of taste, and slower on large
   files.
4. **Code samples in the docs** aren't linted. Should they follow 120 too,
   or something shorter to fit the docs' column?

## 9. Implementation Steps

Stage 1: write down 120.

1. Add `MAX_LINE_LENGTH` to `eslint.config.ts`, `max_line_length` to
   `.editorconfig`, and rulers to `.vscode/settings.json`.
2. Add the line length to the style guide, AGENTS.md and
   `skill-code-style.md`.

Stage 2: enforce 120.

3. Turn on `@stylistic/max-len` with the options in 3.1, as an error, with an
   override listing every package that still has long lines.
4. Fix the `refresh-copies.ts` generator, and generate the file again.
5. Fix each package's long lines, removing it from the override in the same
   change.
6. Delete the empty override.

Stage 3: add the rule.

7. Write `single-line-imports` and its tests, with the cascade, the shapes in
   4.4 and 4.5, and the `maxLength` option.
8. Add it to the plugin's `style` preset and README, and describe the shape
   in the style guide.
9. Try it on a few files from the command line, and adjust.

Stage 4: enforce it.

10. Turn it on in `eslint.config.ts`, with `MAX_LINE_LENGTH` and the comment
    from 4.7.
11. Run `npm run lint:fix`, check the two modules from 4.6, and run the
    build, the tests and `build:packages`.

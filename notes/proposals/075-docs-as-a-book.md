# Proposal: The Docs as a Book

> The docs have grown to about 90,000 words for people, plus 16,000 for AI
> agents. That is the length of a small book, but it doesn't read like one.
> Most core ideas are taught three or four times, on the Architecture
> pages, the Building with MVT pages and the Reference pages. Many pages
> depend on chapters that come after them. The voice changes with the age
> of the page. This proposal turns the docs into one book, where each idea
> is taught once, in the order a reader needs it, in the voice of the
> Principles pages. It has six parts of numbered chapters, five lettered
> appendices for reference, and eight more, one for each principle, that
> hold the principle pages in full. It also lists about thirty errors found along
> the way, which can be fixed now, before anything moves.

**Status:** proposed. Nothing is done yet. Section 10's errors can be fixed
at any time, without waiting for the rest. Where the principles go is
settled (2026-10-29): one summary chapter in Part IV (section 4.5), and
the full pages as appendices, one for each principle, named by its
acronym (section 4.8). Interactive examples were added on 2026-10-29
(section 9), folding in task 061.

**Written:** 2026-10-28, against the `audio90` branch at `6664758c`. Every
page in `packages/sites/docs/` was read in full, apart from
`articles/` (unpublished drafts). The sidebar, the theme, `public/llms.txt`,
`AGENTS.md` and the five `.claude/skills/` stubs were read too. Five
readers took one share each, against the same brief: for each page, what
it introduces, what it uses before it is introduced, what it repeats, and
how its voice compares with the Principles pages. Their claims marked
"checked" in section 10 were confirmed against the code or the text before
this was written.

**Related:**
[Docs home](../../packages/sites/docs/index.md) -
[The Principles Behind MVT](../../packages/sites/docs/architecture/principles/index.md) -
[Style Guide: Writing](../../packages/sites/docs/reference/style-guide.md#writing) -
[contributing.md](../../packages/sites/docs/contributing.md) -
[Docs site config](../../packages/sites/docs/.vitepress/config.ts) -
[015, the documentation overhaul](../archive/015-documentation-overhaul/task.md), which made today's shape -
[070, the principles pages](../archive/070-principles-docs.md), which made the voice this proposal adopts -
[074](../archive/074-audio90-standalone-package.md), whose docs step touches the Sound chapter -
[061, playground embeds for the docs](../archive/061-playground-embeds-for-the-docs.md), folded into section 9 -
[The playground's runtime](../../packages/sites/playground/src/runtime/), which the embed page reuses

---

## Summary

| # | Recommendation | Section |
| --- | --- | --- |
| 1 | Write one book, not three parallel tracks. Drop the separate language-neutral Architecture pages, and keep the specification as one appendix | [3](#3-one-book-not-three-tracks) |
| 2 | Six parts: The Big Picture, The Simulation, The Presentation, Why MVT Works, Advanced Presentation Topics, Quality and Performance. Then Appendices A to E, and The Principles in Depth | [4](#4-the-outline) |
| 3 | Sum up the principles in one chapter of Part IV, beside Why Views Poll and Where MVT Comes From, so later chapters can name them. Put each principle's full page in an appendix of its own, named by its acronym (SoC, SSOT...). **Settled** | [4.5](#45-part-iv-why-mvt-works), [4.8](#48-appendices) |
| 4 | Give each concept one home chapter. Elsewhere, a page states it in a sentence and links to its home | [5](#5-one-home-for-each-concept) |
| 5 | Adopt the Principles pages' voice everywhere, and a chapter shape adapted from theirs | [6](#6-voice-and-chapter-shape) |
| 6 | Mark this project's libraries with one kind of aside, "In this project", and move what is about the Arcade and this repo out of the book | [3.3](#33-general-ideas-this-projects-libraries-and-this-repo) |
| 7 | Move contributor material (code style, project structure, writing guide) into a separate "Working in This Repo" section, outside the book | [7.2](#72-working-in-this-repo) |
| 8 | Make the agent files point to the book rather than copy it | [7.3](#73-the-agent-files) |
| 9 | Let VitePress write Previous and Next from the sidebar, and keep old URLs working with a redirect map | [8](#8-links-urls-and-navigation) |
| 10 | Fix the errors in section 10 now. They don't depend on the restructure | [10](#10-errors-to-fix-now) |
| 11 | Run examples inline online, from a compact embed page built on the playground's runtime, and print a still in their place. Stay on VitePress, and make the print version with a print page, Paged.js and Playwright. Folds in task 061 | [9](#9-interactive-examples-online-and-in-print) |

## 1. Why a Book

A reference site can be read in any order, so it can afford to say things
twice. A book can't. Its reader starts at the beginning, meets each idea
once, and carries it forward. The docs are at the size where readers need
that. A reader who works through today's sidebar meets the frame sequence
eight times, but doesn't meet `watch()` properly until after four pages
that already use it.

The Principles pages show what the rest could be like. Each one opens with
a quoted summary, shows a broken example before naming the idea, talks to
the reader as "you", says what the idea costs as well as what it gives,
names its sources and ends with a checklist. They were written last, and
they read best.

## 2. What Is Wrong Today

### 2.1 Every core idea is taught three or four times

[015](../archive/015-documentation-overhaul/task.md) split the docs into
a language-neutral Architecture section (a "transferable specification") and
a TypeScript guide, Building with MVT. Reference then added a third pass
over the rules, and the principles a fourth over the reasons. Each track
teaches the same ideas from the start. The copies are often near-verbatim.

| Idea | Taught in full on | Copies |
| --- | --- | --- |
| The frame sequence and "why this order matters" | Home, Architecture overview, The Ticker, Architecture Views, Rules, The Game Loop (twice), Quickstart, CQS, Why Polling, View Composition | 8 or more |
| The access-pattern table (bindings, the model as a fixed binding, constants) | Architecture Views, Architecture Bindings, Views, Bindings, Bindings in Depth | 5 |
| Presentation state, and the three-line ticker sketch with `view.update` | Architecture overview, Architecture Views, The Game Loop, Views, Sound, Presentation State | 6 |
| The "delete the view and write a new one" test | Architecture Views, Views, SoC, Presentation State | 4 |
| `watch()`, the first poll, counts, `increased` | Sound, CQS, Hot Paths, View Composition, Change Detection | 5 |
| The metronome, with a near-identical heartbeat example | Sound, Taming Complex Views | 2 |
| The `update(deltaMs)` contract bullets | Architecture Models, Models, Time Management ("Recap") | 3 |
| The `createTimerModel` test | Models, Time Management, Testing Models | 3 |
| Leap safety and `advanceTime` (each page points to the other for the definition) | Time Management, Testing Models | 2 |
| GSAP pitfalls (zero-duration tweens, `paused: true`) | Time Management, Common Mistakes, the model skill | 3 |
| Immediate-mode data flow, retained-mode output | Architecture Views, Heritage, Declarative Views | 3 |
| Fixed and changeable binding values | Architecture Bindings, Bindings, Bindings in Depth, Style Guide | 4 |
| Testing an audio view with a stand-in `sound` | Sound, Testing Views (same `ShipAudioView`, same sentences) | 2 |
| The snapshot workflow ("baseline" on one page, "reference image" on another) | Testing, Testing Views, Visual Tests | 3 |
| Hot paths | The Ticker, The Game Loop, Architecture Rules, Hot Paths, Style Guide, Contributing, Glossary | 7 |
| Why polling beats events | Why Polling, Events and Signals (6 of 7 summary rows the same), SSOT, CQS, Heritage | 5 |
| The rules | Architecture Rules, Reference Architecture Rules (a stub that says the rules "have moved", yet is in the sidebar and linked as "All rules on one page") | 2 |

Some repetition is useful: an overview that previews, a summary that
recaps, a glossary entry that points. The copies above are not that kind.
Each one is a second full explanation, and each drifts from the first
(section 2.6).

### 2.2 The reading order runs backwards

Pages lean on chapters that come later in the sidebar.

| Page | Uses, before it is taught | Taught in |
| --- | --- | --- |
| Sound and Music | `watch`, counts, the first poll (it says it "assumes familiarity with Change Detection") | Reacting to Changes, a later chapter |
| View Composition, Collections, Hot Paths | `watch()` | Reacting to Changes |
| Views, Collections, Reading Layout Back | Presentation state, view models | Adding Visual Polish, a later chapter |
| Collections | `SlotList` and `OrderedSlotList`, model-side structures | Nowhere before this page |
| Declarative Views | `<List>`, `<Switch>` | Collections, two pages on |
| Time Management | `advanceTime`, phases | Testing Models, Phase-Based Transitions |
| Reduced Motion | "a transition that decides when play starts" | Open-Ended Phases, the next chapter |
| The eight principles | Presentation state (5 links), view composition (4), change detection (3), why polling, hot paths, testing, phases | All in Building with MVT, which comes after them in the sidebar |

The last row matters most. The principles sit in the Architecture section,
before the guide, but they depend on it. They were written for a reader who
already knows MVT, as their overview says: "Read them to understand why
the rules are what they are."

Today's chapter boundaries also cut through topics. Timing is split three
ways. Model-owned phases are in Animating Transitions, a view chapter.
View-owned timing is split between Adding Visual Polish and Animating
Transitions. The line between those two is "simple or complex", not
"model or view". The two chapters even contradict each other. Taming
Complex Views says splitting match effects into sub-views "would lose the
timing relationships", and Complex Sequences then does exactly that, with
a shared `Sequence`.

### 2.3 Three audiences on one page

The docs mix three kinds of material with no consistent signal between
them:

- **MVT itself.** It applies to any language and any renderer.
- **This project's libraries.** `@mvtjs/pixi`, `watch`, `<List>`,
  `setUpdate`, `v-snap` and `audio90`. These are for anyone using the
  libraries.
- **This repo and its Arcade.** The entry host, sessions, pausing in the
  Arcade, lint rule names, `npm run bench`, the per-game performance
  history. These are for contributors to this repo.

Some pages say "In This Project:", some "This project's...", some "A
project choice, not an MVT requirement", and some say nothing. The glossary
puts "Skills file" and "Entry" beside "Model" and "Tick". The Style Guide
teaches MVT design (fixed and changeable bindings, top-level views, JSX
versus plain TypeScript) in the middle of its naming rules.

### 2.4 The voice splits by the age of the page

| Voice | Pages |
| --- | --- |
| **Close to the Principles pages** | All eight principles and their overview, Declarative Views, Sound and Music, Reading Layout Back, Reduced Motion, Why Performance Matters, Benchmarking Methods (its rule sections), the first halves of Collections and Visual Tests, the rewritten parts of Open-Ended Phases, View Composition's "Shared Values", the Style Guide's Writing section |
| **Mixed** | Architecture overview, Models, Views, Bindings and Ticker (terse "specification" register), Heritage, Quickstart, The Game Loop, Models, Views, Bindings, View Composition, Why Polling, Change Detection, Presentation State, Taming Complex Views, Phase-Based Transitions, Complex Sequences, Testing, Testing Views, Hot Paths, Measurements, Glossary, Project Structure, the rest of the Style Guide |
| **Far from them** | Docs home, Time Management, Model Composition, Bindings in Depth, Events and Signals, Common Mistakes, Testing Models, Reference Architecture Rules, contributing.md |

The faults on the far side are consistent, which makes them easy to fix:

- **Fragments and noun-phrase lists.** "Key points:", "Benefits:",
  "**Why this matters:**", "No rendering context. No DOM. No timers.",
  "The defaults are invisible noise - present for construction but not for
  comprehension."
- **Summaries that list topics instead of saying something.** Time
  Management's opens "Everything about how time flows...: the `deltaMs`
  contract, forbidden time mechanisms, GSAP timeline recipes...". Bindings
  in Depth's opens "Advanced bindings topics: ...".
- **The abstraction before the example.** Two reactivity pages open with a
  boxed terminology note before any code.
- **A report or advocacy register.** Events and Signals repeats
  "**Observations:**" lists and argues more than it mentors.
- **Marketing.** The home page's "MVT solves this", and Heritage's
  "battle-tested" and "decades of proven use".
- **History.** "as earlier versions of this project did", and the
  per-game "used to allocate" paragraphs in Measurements.
- **"We" and "the developer"** in place of "you".

contributing.md even sets a different standard from the Style Guide.
It asks for a "professional, neutral, approachable tone", where the
Style Guide asks for a friendly colleague who talks to the reader as
"you".

### 2.5 The page furniture is inconsistent

- **Previous and Next links.** Only some pages have hand-written Previous
  and Next links. Models' **Next** skips two pages. The chain stops after
  Visual Tests. Yet VitePress already writes Previous and Next from the
  sidebar on every page (the theme doesn't turn it off), so the
  hand-written links are a third copy of the reading order.
- **Leftover labels.** Eighteen links still say "Models (Learn)" or "Views
  (Learn)", from the structure before 015.
- **Separators.** Related lines use " - " on some pages and " · " on
  others.
- **Prerequisites.** Some pages say "*Assumes familiarity with...*", and
  contributing.md's template says `**Prerequisites:**`.
- **Endings.** Only the principles end with a checklist and further
  reading.

### 2.6 Copies drift, and some are now wrong

When an idea lives in four places, a change reaches some of them. The
copies already disagree on facts. For example, `Object.values()` costs
"44x" on Hot Paths, "32x" on Measurements and "over 40 times" on Why
Performance Matters. One fix in Common Mistakes ("Always read bindings
inside `refresh()`") now contradicts the fixed-binding rule. Section 10
lists all of these, with where each is.

### 2.7 The agent files are a second copy of the book

`AGENTS.md`, `ai-agents/index.md`, five skill files, `public/llms.txt` and
contributing.md hold about 16,000 words. Much of it restates the human
docs:

- About 85% of `skill-code-style.md` is the Style Guide, nearly word for
  word.
- The naming conventions appear five times.
- The file-section banners appear six times, in two formats.
- The writing rules appear five times.

`skill-documentation.md` keeps them in step by hand ("A change to one
likely requires corresponding changes to the others"), and its list of
files to keep in step is itself out of date. Drift has started:

- `llms.txt` says music is the view's presentation state.
- One skill names the wrong controls type.
- Two skills say every view returns a Pixi `Container`.

Facts have leaked the other way too. The Arcade's visual-test options
(`pixelArt: false`, `kind: 'three'`) and "`MusicPlayer.play` cancels any
song queued" appear only in a skill.

The two orientation pages also point at each other. `AGENTS.md` calls
`ai-agents/` the "expanded orientation", and `ai-agents/index.md` calls
`AGENTS.md` "canonical".

## 3. One Book, Not Three Tracks

### 3.1 Drop the parallel Architecture section

The language-neutral Architecture pages (overview, Models, Views,
Bindings, The Ticker) are the main source of the repetition in section
2.1. Each has a twin in Building with MVT that teaches the same idea
again, in TypeScript. Today a reader reads both, or misses half.

The book teaches each idea once, in TypeScript. The principles already
made this choice, and say why: TypeScript shows an interface's needs and
promises plainly, where pseudocode would have to invent a type notation.
They keep made-up examples short and free of this project's conventions,
so the ideas still transfer to any language. The book's chapters do the
same.

The best of the Architecture pages moves into the chapters. That includes
Bindings' fixed and changeable values table and Views' immediate-mode
data and retained-mode output.

### 3.2 Keep the specification, as one appendix

The transferable specification is still worth having, for someone porting
MVT to another language or checking a design against it. It becomes
Appendix A, **MVT on One Page**. It holds the three parts and what each
owns, the two kinds of state, the tick, and the rules with their
**Serves** column, in language-neutral terms. It summarises the book and
links into it. It teaches nothing the book doesn't.

### 3.3 General ideas, this project's libraries, and this repo

The book is about building with MVT, using this project's libraries for
its examples. One kind of aside marks what is specific to the libraries:

> **In this project:** `setUpdate` and `setRefresh`, from `@mvtjs/pixi`,
> set a view's two steps on its container...

Material about the Arcade and this repo (the entry host, sessions, lint
rule names, `npm run` commands, history) moves out of the book into
"Working in This Repo" (section 7.2). A chapter can still use an Arcade
game as an example. Burrow Bust and the fruit machine teach well. What
it shouldn't teach is how the Arcade itself is run.

## 4. The Outline

Chapter numbers run through the whole book, so a page can say "see
Chapter 9". The "Sources" column says where each chapter's material comes
from today, and roughly how many words it has. The targets are rough. The
aim is chapters of 1,500 to 3,000 words.

### 4.1 Front matter

| | Chapter | Sources | About |
| --- | --- | --- | --- |
| | **Preface** | Docs home, "How This Section Relates" on the Architecture overview | Who the book is for. What MVT is, in a paragraph. How the parts fit, and which to skip if you're in a hurry. The conventions: TypeScript, "In this project" asides, the playground links. Replaces today's home page and its three-track table |

### 4.2 Part I: The Big Picture

| # | Chapter | Sources | About |
| --- | --- | --- | --- |
| 1 | **Why MVT** | Architecture overview, docs home | The problem, shown with a tangled bouncing ball. Three jobs, three owners, named in passing as Separation of Concerns, with a link to Chapter 13. Two kinds of state. The tick in one picture. What you get, and what it costs. Patterns you may know. The one place the whole frame sequence is drawn |
| 2 | **A First Game** | Quickstart | The same bouncing ball, untangled, then the playground. Chapter 1's example carries straight into it |

Chapter 1 should use the bouncing ball, not the SoC page's ship, so the
two don't share an example. Chapter 2 then fixes the very code Chapter 1
showed broken.

### 4.3 Part II: The Simulation

| # | Chapter | Sources | About |
| --- | --- | --- | --- |
| 3 | **Models** | Models, Architecture Models, Model Composition, the Style Guide's factory section | The `update(deltaMs)` contract, domain coordinates, factories, trees of models, collections of models (`SlotList` belongs here), actions named for what the player means, and what a model exposes for views to notice (counts, phases) |
| 4 | **Time and Phases** | Time Management (without GSAP), Phase-Based Transitions, the model half of Open-Ended Phases | Time arrives as `deltaMs`. How to structure `update()`. Leap safety. One `phase` and one `progress`. Phases that wait, and why `progress` stays at 1 |
| 5 | **The Tick** | The Ticker, The Game Loop | Ticks, why the order matters, input between ticks, the delta cap, pause, slow motion, stepping and replay. In this project: `updateView`, `refreshView`, `SKIP_DESCENDANTS` |

Phases move here because they are domain state machines. The MISU
principle already points here for them. Chapter 4 must settle the conflict
in section 10: Time Management calls a hand-written phase machine "Bad",
and Phase-Based Transitions recommends one.

The tick comes after the models. Time Management ends with "time comes
from the ticker", and Chapter 5 picks that up. The quickstart has
already shown that views refresh after models, so Chapter 5 can describe
a view's steps briefly and leave the detail to Chapter 6.

### 4.4 Part III: The Presentation

| # | Chapter | Sources | About |
| --- | --- | --- | --- |
| 6 | **Views** | Views, Architecture Views | The `refresh()` contract. Immediate-mode data and retained-mode output. A short first look at writing the body in JSX, enough to read later examples. Releasing what a view holds |
| 7 | **Bindings** | Bindings, Bindings in Depth, Architecture Bindings, the Style Guide's bindings sections | Query and relay bindings. Fixed and changeable values, including `ValueOrGetter`. Optional bindings. Wiring. Input as meaning, not controls. When to pass the whole model. The access-pattern table, once |
| 8 | **Noticing Changes** | Change Detection, plus the count material from Sound | `watch()`, the first poll, counts and `increased`, `memoiseLast`, and when to bother |
| 9 | **Presentation State** | Presentation State, the view half of Open-Ended Phases | The one full treatment: a view's `update(deltaMs)`, start valid, cyclic timers, view-owned phases, controls that are both output and input, and when it is really domain state |
| 10 | **Writing Views in JSX** | Declarative Views, the JSX part of Views | What JSX does for you, how declarative it really is, escape hatches (`onRefresh`, `onUpdate`, `ref`), costs, and mixing with plain TypeScript |
| 11 | **Composing Views** | View Composition | Parent views, many views of one model, shared values, two trees that need not match |
| 12 | **Lists and Switches** | The first half of Collections | `<List>`, slots, `ListSource`, the two rules for item views, `<Switch>` and `<Match>`, windowed and re-derived lists |

This order is set by dependencies. Chapter 8 comes before anything that
uses `watch`. Chapter 9 comes before Lists, whose second rule needs
presentation state. JSX comes after presentation state, since its escape
hatches include `onUpdate`. Views and Bindings come first because
everything else uses them.

Change Detection's "Dynamic Child Lists" section, which rebuilds every
child when a count changes, should go. `<List>` replaced it, and
Chapter 12 teaches `<List>`.

### 4.5 Part IV: Why MVT Works

| # | Chapter | Sources | About |
| --- | --- | --- | --- |
| 13 | **The Principles Behind MVT** | The principles overview | The goal. The eight principles, each with its one line and the question it asks. How they build on one another. The screen-shake case worked through. Using them in a review. When they pull against each other. About 1,500 words. Each principle is named in full with its acronym, which later chapters use, and links to its full page. "Examples Are in TypeScript" goes, since the whole book is in TypeScript |
| 14 | **Why Views Poll** | Why Polling, Events and Signals | One page, about 2,000 words from today's 4,800. Keep the measurements, "When Push Wins" and counts for sound. Drop the restated "Observations" and the duplicate summary table. Fix the advice that contradicts counts (section 10) |
| 15 | **Where MVT Comes From** | Heritage | Its immediate-mode section shortened to a link to Chapter 6. "Battle-tested" goes |

The principles appear at two depths that don't overlap. Chapter 13 gives
each one a paragraph. The Principles in Depth, at the back, give each
one a full page (section 4.8). A reader who stops at Chapter 13 still has the gist, and
anyone who wants the depth knows where it is.

This placement does four things well:

- **Every idea comes first.** Part IV names bindings, ticks, presentation
  state, phases and `watch`, and by then Parts I to III have taught them
  all. The full principle pages come after everything they link to,
  including testing and hot paths.
- **The reading keeps moving.** Someone reading straight through meets
  three short chapters of reasons, about 5,500 words, then goes on.
  No 18,000-word run of theory sits in the middle of the book.
- **Later chapters can point back.** Sound can say "this is CQS at work",
  and Testing can rest on "control, observe, repeat", each in a sentence,
  with a link to Chapter 13, instead of arguing the case again. Today, the
  Testing page's "Philosophy" restates DfT in a weaker form.
- **It matches how the full pages are used.** Deciding a case no rule
  covers, and naming a principle in a review finding, are both look-up
  uses. Each page's checklist and "Rules It Underpins" table already work
  that way.

Chapter 13 needs only small edits. The principles overview already does
this chapter's job, and its screen-shake example leads into Part V.

### 4.6 Part V: Advanced Presentation Topics

| # | Chapter | Sources | About |
| --- | --- | --- | --- |
| 16 | **Growing a Complex View** | Taming Complex Views, Complex Sequences | One ladder: inline first, then sub-views, then helpers (tweens, the metronome, easing), then shared sequences and reactions, then a view model. One match-effects story, not two that disagree |
| 17 | **Lists in Motion** | The second half of Collections | Items that carry presentation state, release delays, `OrderedSlotList`, drag and drop |
| 18 | **Sound and Music** | Sound and Music | Audio views. Its re-teaching of counts, the first poll and the metronome becomes links. Rewritten for one clock when 074 lands |
| 19 | **Reading Layout Back** | Reading Layout Back | Unchanged in substance |
| 20 | **Reduced Motion** | Reduced Motion | Last, since it uses phases, presentation state and sequences |

### 4.7 Part VI: Quality and Performance

| # | Chapter | Sources | About |
| --- | --- | --- | --- |
| 21 | **Testing Models** | Testing (opener), Testing Models | The only home for leap safety's testing side and `advanceTime`. It opens from "control, observe, repeat" in Chapter 13, and links to DfT for the why |
| 22 | **Testing Views** | Testing Views | Assertions or images: "the value problem". Audio views get a link to Chapter 18's testing section, not a copy |
| 23 | **Visual Tests** | Visual Tests, Testing Views' snapshot sections | Posing, advancing time, whole screens, keeping images the same, reviewing a change. One word for one thing: "reference image". "Choosing a Tool" shrinks to an aside that links to v-snap's README |
| 24 | **Why Performance Matters** | Why Performance Matters | Unchanged in substance |
| 25 | **Hot Paths** | Hot Paths | Owns the H-* rules, links to Chapter 8 rather than re-teaching `watch`, and quotes figures only from Appendix C's short version |

### 4.8 Appendices

| | Appendix | Sources | About |
| --- | --- | --- | --- |
| A | **MVT on One Page** | Architecture Rules, the spec parts of the Architecture pages | Section 3.2. Replaces both rules pages |
| B | **Glossary** | Glossary | Each entry is one or two sentences and a link. MVT terms first, then a labelled section of the libraries' terms. Adds the missing terms: phase, leaf view, top-level view, pose, `SlotList`, idempotent, static state. Drops the orphan "Stateful view" |
| C | **Measurements** | Measurements | The generated tables, and one short version that matches them. That short version is the only source other pages quote. The per-game history moves to the benchmarks README |
| D | **Measuring Performance** | Benchmarking Methods | Without "Running the Repo's Benchmarks", which moves to the benchmarks README |
| E | **Timelines with GSAP** | GSAP sections of Time Management | The paused-timeline recipe and its pitfalls, in one place. GSAP is "a convenience, not a requirement", so it doesn't belong in Chapter 4, but six games use it, so it deserves one good page |
After the lettered appendices comes a sidebar group called **The
Principles in Depth**. It holds the eight principle pages, unchanged in
substance, with their links updated to the new chapters. Each is labelled
with its acronym and full name, in the order of Chapter 13:

- SoC: Separation of Concerns
- SSOT: Single Source of Truth
- CQS: Command-Query Separation
- DIP: Dependency Inversion Principle
- CRP: Composite Reuse Principle
- DbC: Design by Contract
- MISU: Make Illegal States Unrepresentable
- DfT: Design for Testability

The acronyms are already the principles' names. The pages, the rules'
**Serves** column and the code review skill all use them, so a chapter
can cite "CQS" just as they do. Appendix A's **Serves** column links each
rule to its page here.

Common Mistakes goes. Each of its nine rows restates a page that already
covers it, one row is now wrong, and it misses the "Common Mistakes" tables
on Sound and Collections and the principles' "Common Misreadings". If a
symptom index is wanted later, it should only link ("my view shows a stale
value: see Chapter 7"). That is open question 4.

### 4.9 Outside the book

- **Working in This Repo**: a separate sidebar section (section 7.2).
- **AI Agents**: section 7.3.
- **The audio90 guides** stay in their package. They belong to `audio90`,
  which is published on its own. Chapter 18 links to them.
- **Articles** stay unpublished drafts, as now.

## 5. One Home for Each Concept

Each concept gets exactly one chapter that teaches it in full. Any other
page that needs it says it in a sentence, at most, and links to the home.
A summary or overview may restate it briefly, and should say it is a
summary.

| Concept | Home | Pages that keep only a sentence and a link |
| --- | --- | --- |
| The frame sequence | Ch. 1 (the picture), Ch. 5 (the detail) | Preface, Ch. 2, Ch. 6, Ch. 14, CQS, App. A |
| Two kinds of state | Ch. 1 | Ch. 9 |
| Presentation state, view models | Ch. 9 (view models in Ch. 16) | Ch. 1, Ch. 5, Ch. 6, Ch. 18, SSOT |
| The delete-the-view test | Ch. 9 | Ch. 6, SoC |
| `update(deltaMs)` contract | Ch. 3 | Ch. 4, App. A |
| Leap safety | Ch. 4 | Ch. 21 |
| `advanceTime` | Ch. 21 | Ch. 4 |
| Phases and progress | Ch. 4 | Ch. 9, Ch. 20, MISU |
| Counts and `watch()` | Ch. 8 | Ch. 3 (the model's side), Ch. 18, Ch. 25, CQS |
| The metronome | Ch. 16 | Ch. 18 |
| Access patterns (bindings, model, constants) | Ch. 7 | Ch. 6 |
| Fixed and changeable values | Ch. 7 | SSOT, App. A |
| Immediate-mode data, retained-mode output | Ch. 6 | Ch. 10, Ch. 15 |
| `<List>`, `SlotList` | Ch. 12 (views), Ch. 3 (models) | Ch. 17 |
| Each principle | Its full page, in The Principles in Depth | Ch. 13 (a paragraph each), Ch. 1 (SoC by name), and any chapter that names one |
| Testing a model | Ch. 21 | Ch. 3 (one sentence, no example) |
| Testing an audio view | Ch. 18 | Ch. 22 |
| Reference images and review | Ch. 23 | Ch. 22 |
| Hot paths | Ch. 25 | Ch. 5, App. A |
| Performance figures | App. C, its short version | Every page that quotes a number |
| Why polling | Ch. 14 | Ch. 8, Ch. 15, SSOT, CQS |
| GSAP timelines | App. E | Ch. 4 |
| The rules | App. A | Each chapter states its own rules where it teaches them |

The rules deserve a note. Today they are stated in their own pages and
again in tables. In the book, each chapter states the rules it teaches in
plain sentences, with the rule's name (M-time, V-reactive) so the reader can
find it in Appendix A. The appendix is the one table.

## 6. Voice and Chapter Shape

### 6.1 The voice

The voice is the Principles pages' voice, which the Style Guide's Writing
section already describes. Nothing new needs inventing; the older pages
need bringing up to it. In practice, a rewrite removes these:

- fragments before colons, and bold noun phrases standing in for sentences
  ("Key points:", "Benefits:", "**Why this matters:**")
- summaries that list topics instead of saying something
- terminology boxes before the first example
- "we", "the developer", and the third person in general
- history ("used to", "earlier versions of this project")
- marketing ("solves", "battle-tested", "zero changes")
- in-house names outside an "In this project" aside

contributing.md's tone rule ("professional, neutral") changes to match the
Style Guide.

### 6.2 The chapter shape

The principles have a fixed shape: The Principle, Symptoms, Applied to
MVT, Practical Benefits, Practical Costs, Common Misreadings, Checklist,
Rules It Underpins, Further Reading. That suits a principle. A chapter
about how to do something needs a looser version of it:

1. **Title**, then a quoted summary that says something, in two to five
   sentences.
2. **Related** links, separated by " · ". No hand-written Previous or Next
   (section 8).
3. **A concrete start.** A small example, often a broken one, before any
   abstraction.
4. **The idea, then how to do it**, in sections headed with plain phrases.
5. **"In this project"** asides, where the libraries come in.
6. **What it costs**, where there is a cost.
7. **Common mistakes**, where readers really make them. This replaces the
   separate Common Mistakes page.
8. **A checklist or summary**, short, at the end.
9. **Further reading**, where there are real sources.

Online, a chapter may also hold "Try it" examples, each placed after the
listing it runs. They are extras that the text never depends on, and the
print version leaves them out (section 9.1).

Not every chapter needs every section. Reading Layout Back and Reduced
Motion are already close to this shape, and are good models for the
practice chapters. Benchmarking Methods' "a concrete failure, then
**Rule:**" pattern is a good model for the appendices.

## 7. Reference, the Repo, and the Agent Files

### 7.1 Reference becomes appendices

- **The rules.** `reference/architecture-rules.md` is deleted. Eleven
  pages link to it. Those links, and `skill-documentation`'s and
  contributing.md's instructions to edit it, move to Appendix A.
- **The glossary.** It becomes Appendix B, trimmed to define-and-link.
  Today some entries re-explain at length ("Domain state" runs to about
  150 words), and three entries restate the loop order.

### 7.2 Working in this repo

A separate sidebar section, after the book, for people working on this
repo:

- **Code Style.** The Style Guide's conventions only: naming, factories,
  `null` and `this`, file sections and assertions. Its MVT teaching moves
  to Chapters 7 and 10.
- **Project Structure.** As now, with its trees no longer copied into
  `AGENTS.md`.
- **Writing Guide.** One guide. It merges the Style Guide's Writing
  section, contributing.md, and the human parts of `skill-documentation`.
  It includes section 6.2's chapter shape and the book's outline, so a new
  page knows where it goes.
- **Adding an Entry.** A link to the entries README, which stays the
  home.
- **Running the Benchmarks.** A link to the benchmarks README, which
  takes Benchmarking Methods' last section and Measurements' history.

### 7.3 The agent files

The agent files should point into the book, not copy it. This is the
book's own SSOT principle applied to its own docs.

- **One orientation.** `AGENTS.md` stays the orientation. `ai-agents/index.md`
  is deleted or reduced to a link to it. `AGENTS.md` stops copying the
  Project Structure trees, and links to them instead.
- **Skills as checklists.** Each skill becomes a short task checklist that
  links to the book's sections by anchor, as `skill-code-review`'s section
  2 already does with the principles. It adds only what is for agents: the
  commands, the lint rules, the checks that must pass before handing over,
  and the report format. `skill-code-style` shrinks the most, since about
  85% of it is the Style Guide.
- **Facts move to the people's pages.** The facts that live only in skills
  move into the human pages: the Arcade's visual-test options, and
  `MusicPlayer.play` cancelling a queued song.
- **`llms.txt`.** It becomes a list of links to the book's chapters, or is
  generated from `AGENTS.md`. It shouldn't be a sixth hand-kept summary.
- **Out of the sidebar.** Once the skills are short link lists, people
  don't need them in the book's sidebar. Open question 5 asks whether they
  leave the published site.

## 8. Links, URLs and Navigation

- **Previous and Next.** VitePress writes Previous and Next links from the
  sidebar, and this theme keeps them. Remove the hand-written ones. The
  sidebar then becomes the one record of the reading order, and a link
  can't skip a page again.
- **Chapter numbers.** Put them in the sidebar text and the page titles
  ("7. Bindings"), so a page can say "Chapter 7". Keep them out of file
  names, so inserting a chapter doesn't rename files.
- **Old URLs.** 91 files outside the docs site link into it (READMEs,
  code comments, `AGENTS.md`, the notes), and the live site's URLs may be
  shared. Add a redirect map: old path to new path, with a small redirect
  page written for each old path at build time. Then update the repo's own
  links in one scripted pass.
- **Dead links.** `ignoreDeadLinks` covers only `/playground/` today, so
  the build already catches broken links within the docs. Keep it that
  way through the moves.

## 9. Interactive Examples, Online and in Print

Some print books have a website of extras. This book can have the same
thing, inline: online, a chapter can run its examples beside the text that
explains them, and the reader can change them and watch what happens. A
printed copy, or a PDF, leaves the extras out, or shows a still in their
place, and reads just as well.

This section folds in task
[061](../archive/061-playground-embeds-for-the-docs.md), which asked for a
compact playground page to embed in the docs. 061 is archived, and its
questions are answered in section 9.4.

### 9.1 Writing for both layouts

Two rules keep the flow intact when the extras are removed:

- **An interactive example is always an extra.** The text around it makes
  sense without it. The text never says "as you saw above" about an
  example, and an example is never the only place a fact appears.
- **The code the text explains stays as an ordinary listing.** The listing
  prints. The example runs that same code, beside it or just after it.

The listing and the example share one source. VitePress can import a code
listing from a file, or from a marked region of one, with `<<<`. A
chapter's listing comes from the example's own files in
`packages/sites/playground/examples/<id>/`, so the printed code is always
the code that runs. Whether `<<<` takes a path relative to the page,
outside the docs folder, needs checking. If it doesn't, a short Vite alias
will do.

A chapter adds an example with one component, `<TryIt example="<id>" />`,
registered in the theme the way `PlaygroundLink` is today. Online, it
renders the embed (section 9.4). In print, it renders the example's still
and a short link to the page online, or nothing at all (open question 7).
Section 6.2's chapter shape gains one optional item: a "Try it" example,
placed after the listing it runs.

### 9.2 The platform: stay on VitePress

VitePress has no print output of its own. The alternatives were weighed
against adding one:

| Option | Web and print from one source | Fit |
| --- | --- | --- |
| **VitePress, with a print build** | Through a separate build (section 9.5) | The best fit. It keeps Vue components, Vite, the dev server the Arcade shares, and the look the docs share with the Arcade and the playground |
| Quarto | Built in, with HTML, PDF and EPUB outputs, and content marked for one output only | It does exactly this split, but it is a separate toolchain built on Pandoc rather than npm, and it gives up the Vite integration and the shared site |
| mdBook | In part. It writes a single "print" page of the whole book | A Rust tool, and weaker for interactive content |
| Pandoc, beside VitePress, for print only | PDF and EPUB from the same Markdown, with a filter that strips the extras | Real book typesetting, but VitePress's containers, components and diagrams would each need converting |

Quarto would justify a move only if print became the main output. For a
book that is read online first, VitePress plus a print build is the
smaller change.

### 9.3 What the playground already has

The playground's runtime is already separate from its interface:

- `prepare-project.ts` turns a project's files into runnable modules. It
  transpiles them with sucrase, guards their loops and rewrites their
  imports.
- `buildSandboxDocument` (in `sandbox-document.ts`) wraps those modules in
  the HTML of a sandbox iframe.
- `run-sandbox.ts` runs the project inside it: the project's `update`,
  then `updateView` and `refreshView`, then a draw, every frame.

An embed page can reuse all three as they are. What it should leave out is
the language service, which is most of the playground's weight. A
production build of the playground on 2026-10-29 (the `audio90` branch at
`6664758c`) measured:

| Part | Gzipped |
| --- | --- |
| Language service worker | 1,019 KB, plus about 7 MB of type files (unzipped) that it loads |
| The playground page: CodeMirror and its themes, sucrase, the interface | 310 KB |
| Pixi | 77 KB |
| three.js | 184 KB |

### 9.4 The embed page

A compact page, `/playground/embed.html`, shows one example, sized for an
iframe. The docs component points an iframe at it. An iframe keeps the
docs build free of the playground's code, and the docs and the playground
already share one origin and one dev server.

It comes at two levels:

- **Run.** The preview, with pause, step and restart. It loads the sandbox
  runtime and the example's renderer only, roughly 100 KB gzipped for a
  Pixi example. That is an estimate from the chunks above, to be measured.
- **Edit and run.** It adds a CodeMirror editor on one file, with no type
  checking, and a link that opens the example in the full playground.

061 left four questions open. This proposal answers them:

| 061's question | Answer |
| --- | --- |
| Which file the embed shows, and whether the reader can switch | The page names the file, the one its listing shows, with `file=<path>`. A small list switches between the example's other files |
| Whether changes in an embed are kept | Only while the page is open. An embed never adds to the reader's project list. "Open in the playground" carries the edited project across as a share link, which the playground already reads (`share-links.ts`) |
| How much of the playground an embed loads | No language service. Each level loads what is listed above, and the load size is measured and agreed before it ships |
| How it looks in the docs' light and dark themes | The component passes the docs' theme as a parameter, and sends a message when the reader changes it |

A chapter may hold several examples, so:

- **Each embed loads when it scrolls into view, and runs after a click.**
  Browsers keep only around sixteen WebGL contexts at once and drop the
  oldest, so several running examples on one page would break each other.
  A click is also what a browser needs before it plays sound.
- **One example runs at a time.** Starting one pauses the others.
- **The still shows until the click.** The same still the print build uses
  (section 9.5) is the embed's poster, so the page doesn't jump when an
  example loads.

### 9.5 The print build

- **A print page.** One VitePress page strings every chapter together in
  sidebar order. A print stylesheet hides the online extras and shows each
  example's still.
- **Book layout.** Paged.js, an npm library, lays the print page out as a
  book. It adds page numbers, running headers, a contents page with page
  numbers, and chapters that start on a new page.
- **The PDF.** Playwright prints the laid-out page with `page.pdf()`. It
  uses Playwright's own headless shell, which the visual tests already
  install, rather than an installed Chrome. Tools such as
  `vitepress-export-pdf` drive a full Chrome through Puppeteer, which this
  repo avoids.
- **Stills.** Each playground example gets a visual test, as every Arcade
  entry has, posed at a moment that shows what the example does. Its
  reference image is the still, for print and for the embed's poster, so
  no one takes a screenshot by hand and no still goes out of date. The
  examples have no visual tests yet; only the playground's own interface
  does.
- **EPUB** can follow from the same print page, if it is wanted.

## 10. Errors to Fix Now

These don't depend on the restructure, and some are wrong today. "Checked"
means confirmed against the code or the text while writing this proposal.
The rest are as the reviewers reported them, with the page named so each
is quick to confirm.

| # | Page | Problem | Checked |
| --- | --- | --- | --- |
| 1 | Complex Sequences, "Model-driven sequences" | Shows `clearSequence.progress = bindings.progress()`, but `Sequence.progress` is `readonly`, with a getter only (`packages/libraries/utils/src/sequence.ts`). The section documents an API that doesn't exist | Yes |
| 2 | `public/llms.txt` | "Music and repeating sounds are the view's presentation state." Music plays on the chip's sequencer, as `AGENTS.md` says | Yes |
| 3 | `ai-agents/skill-mvt-view.md` | "Advance its clock with `AudioControls.update`". It is `HeadlessControls.update` | Yes |
| 4 | `ai-agents/skill-mvt-view.md` | A note about Windows logon attempts on the owner's own machine, published on the public site | Yes |
| 5 | Common Mistakes, mistake 2 | "Always read bindings inside `refresh()`" contradicts fixed bindings (SSOT, "A fixed binding is not a stale copy") | Yes |
| 6 | Hot Paths, Measurements, Why Performance Matters | `Object.values()` is 44x, 32x and "over 40 times" slower. Also: template-string keys 16x and 12x. Map with numeric keys 2.4x and 1.3x. The idle polling cost is 5-8 µs, 5-15 µs and 4-13 µs. Measurements' short version disagrees with its own body. The JSX cost is 1.1-1.6x in the Style Guide and 1.8-2.6x in Measurements | `Object.values()` only |
| 7 | Time Management against Phase-Based Transitions | Time Management labels a hand-written phase state machine "Bad - manual sequencing". Phase-Based Transitions recommends one | Yes |
| 8 | Docs home | The chapter list misses Declarative Views, Bindings in Depth, Collections, Sound and Visual Tests. The frame sequence leaves out the views' update step, and so does `llms.txt`'s | Yes |
| 9 | Phase-Based Transitions, "A Real Example" | Kwazy Cactii's `swapProgress`, `matchProgress` and `settleProgress` are the per-phase-progress shape the page says to avoid | |
| 10 | Taming Complex Views | The view-model example spawns particles in `refresh()` for as long as a flag is true, which isn't idempotent. The `EdgeTween` example uses a `wasHit()` flag, where the house answer is a count. `createMatchEffectsViewModel(isMatching)` takes a positional parameter | |
| 11 | Taming Complex Views against Complex Sequences | One says splitting match effects into sub-views loses the timing. The other splits them, as Kwazy Cactii does | |
| 12 | Events and Signals, Why Polling | "Events are the only mechanism... for one-shot occurrences", an audio manager reacting to `'enemy-destroyed'`, and "a `lastEvent` property or a message queue" all contradict counts | |
| 13 | Change Detection, View Composition | Both teach rebuilding every child view when a count changes. `<List>` replaced that | |
| 14 | Visual Tests | Says a test tool can seed `Math.random` so a model deals the same board. DIP and DfT say a model is given its random source | |
| 15 | Open-Ended Phases against `ArcadeModel` | The page says a model keeps its time to itself and exposes `progress`. The Arcade's model exposes `elapsedMs`, and Reduced Motion describes the Arcade drawing from it. Either the code or the page needs a note | |
| 16 | Bindings against Architecture Bindings | Relay input is "processed on the next `update()`" on one page, and "may be processed immediately or queued" on the other. Relay bindings "should be optional" on one, "should usually be" on Bindings in Depth | |
| 17 | View Composition | `onDirectionChanged={(dir) => { model.player.heading = dir; }}` writes a model field directly. Other examples call an action named for what the player means | |
| 18 | Bindings in Depth | Its `GameView` example builds one `BulletView` per bullet at construction, then says to use `<List>`. It teaches the anti-pattern first | |
| 19 | Models, Testing Models, Taming Complex Views | Factories with positional parameters (`createTimerModel(3000)`), against the one-options-object convention | |
| 20 | Model Composition | The test reaches into `game.asteroids[0].isAlive` and calls `update(16)` directly. Testing Models says not to do either | |
| 21 | Style Guide, two skills | "Every view... returns a Pixi `Container`" ignores `@mvtjs/three` and `@mvtjs/html`. The glossary's View entry gets it right | |
| 22 | Sound and Music | Says this repo's chips run on game time. 074 chose one clock, the sound card's. This is fixed by 074's docs step, not here | |
| 23 | The Game Loop | "Spiral of death" describes a fixed-step loop that falls further behind. A capped variable delta can't spiral. The cap is right, but the name is wrong | |
| 24 | Models | Its **Next** link skips Time Management and Model Composition | Yes |
| 25 | 18 pages | "Models (Learn)" and "Views (Learn)" link labels, left from before 015 | |
| 26 | Testing, Visual Tests | Typos: "snapshop", "An spy". Several unwrapped lines | |
| 27 | Glossary | "Continuous state" and "Discrete state" link with the text "[Reactivity]", a page title that no longer exists | |
| 28 | contributing.md | Its template, its `learn/` and `topics/` folders and its section table are from before 015. The table leaves out six current pages | |
| 29 | `skill-documentation.md` | Says MVT is "documented in the guide pages under Building with MVT", ignoring Architecture. Its list of files to keep in step leaves out the rules, the principles, `llms.txt` and contributing.md | |
| 30 | `AGENTS.md`, `skill-code-style.md` | Show the file-section banner as `// --- Interface ---`. The Style Guide and all 109 model files in the entries use the long banner | |

## 11. Considered and Not Recommended

- **Keep the language-neutral Architecture section beside the guide.**
  It is the main source of the repetition, and the principles already
  show that short TypeScript examples transfer to other languages. The
  specification survives as Appendix A. Reopen only if readers porting
  MVT to other languages say Appendix A isn't enough.
- **Keep Common Mistakes as a chapter.** Every row restates a page that
  covers it, and the chapter shape in section 6.2 gives each chapter its
  own mistakes.
- **Keep Bindings in Depth separate.** It has about 300 words that no
  other bindings page has. That isn't enough for a chapter of its own.
- **Keep Adding Visual Polish and Animating Transitions as chapters.**
  Their line is "simple or complex", which cuts timing in the wrong
  place. Part II takes the model's timing, Chapter 9 takes the view's,
  and Chapter 16 takes the ladder from simple to complex.
- **Rewrite the principles.** They are the standard. Only their links
  change, and their place in the book.
- **The eight principle pages in the middle of the book.** An earlier draft
  put them all after the core, as a part of their own. That met every
  dependency, but it put about 18,000 words of theory between the core and
  the practice chapters. Part IV's one principles chapter keeps what that
  placement was for, so later chapters can name the principles, without
  the long detour. **Settled 2026-10-29. Do not reopen without new
  information.**
- **The full principle pages as unnumbered back matter.** A later draft
  put them in a group of their own, neither chapters nor appendices. It
  left them without a clear home or a way to cite them. Appendices give
  them both. **Settled 2026-10-29.**
- **Numbering the principle appendices P1 to P8.** Numbers would match
  Appendices A to E and show the order, but they would be a second name
  for principles that already have one. "P3" means nothing until you look
  it up, where "CQS" carries its meaning. Numbers also break when a
  principle is added or moved. The sidebar's order shows the order. The
  rules are named the same way, M-time not R1. **Settled 2026-10-29.**
- **A summary of the principles in Chapter 1.** At Chapter 1, the reader
  hasn't met bindings, ticks, presentation state or phases, so a summary
  there would name ideas before they mean anything. Chapter 1 names SoC
  alone, since its "three jobs, three owners" is SoC. **Settled
  2026-10-29.**
- **Moving the docs to Quarto, mdBook or Pandoc for print.** Section 9.2
  weighs them. Only Quarto does the web and print split out of the box,
  and it would cost the Vite integration and the shared site. Reopen if
  print becomes the main output.
- **Running examples inside the docs page itself, without an iframe.**
  The docs build would then bundle the playground's runtime and its
  libraries, and an example's errors and loops would share the reader's
  page. The sandbox iframe already isolates both.
- **A hosted sandbox such as StackBlitz or CodeSandbox.** It would load
  far more than the embed page, depend on a third party, and need the
  libraries from npm rather than from the repo. The playground already
  does the job.

## 12. Open Questions

1. ~~**Where the principles go.**~~ Settled 2026-10-29: one summary
   chapter in Part IV (section 4.5), and the full pages as appendices,
   each named by its acronym (section 4.8).
2. **Phases in the model part.** Chapter 4 holds model phases and Chapter
   9 view-owned phases. Is splitting "phases" across two parts clear, or
   should a short section in Chapter 9 bring both sides together?
3. **Chapter numbers in titles.** They help a book, but every insertion
   renumbers what follows. Is that churn worth it, or should chapters be
   numbered only in the sidebar?
4. **A troubleshooting index.** Should a short Appendix F list symptoms,
   each linking to the chapter section that explains it, or is that one
   more thing to keep in step?
5. **The skills on the published site.** Once they are link lists, should
   they leave the docs site (with `srcExclude`), or stay in a collapsed
   section for anyone curious?
6. **The book's title.** The site is titled "MVT Games", but the book
   would be about MVT. Something like *Building Games with MVT* would say
   what it is. This affects the Preface and the site title, nothing else.
7. **What print shows in place of an example.** A still and a short link,
   a still and a QR code, or nothing? A still helps where the example
   shows motion the text describes. A QR code suits paper but means little
   in a PDF.
8. **Whether to make a print version now.** The embeds are useful online
   whether or not a PDF exists. The print build could wait until there is
   a reason for a PDF, as long as section 9.1's rules are followed from
   the start, so the extras can be stripped later.
9. **Which level an embed opens at.** Run is lighter. Edit and run
   invites the reader to change the code, which is the point of an
   example. A chapter could choose for each example.

## 13. Implementation Steps

Each step from 3 on is one reviewable chunk, in reading order, so each
review sees whole parts of the book.

1. Fix section 10's errors (except row 22, which goes with 074). No pages
   move.
2. Settle the open questions, and write the Writing Guide (section 7.2)
   with the chapter shape and the outline, so every rewrite follows the
   same standard.
3. Lay out the skeleton. Set up the new folders and sidebar, the redirect
   map, and the removal of hand-written Previous and Next. Move pages
   without rewriting them, so the diff shows the moves. Update the repo's
   links in one scripted pass.
4. Front matter and Parts I and II: Preface, Chapters 1-5.
5. Part III: Chapters 6-12.
6. Part IV: Chapter 13 from the principles overview, Chapter 14 (the
   merge) and Chapter 15. The principle pages move to The Principles in
   Depth, with their links updated.
7. Parts V and VI: Chapters 16-25.
8. Appendices A-E, the glossary rewrite, and the deletion of the
   reference rules stub and Common Mistakes.
9. Working in This Repo: the split Style Guide, Project Structure and the
   README moves.
10. The agent files: `AGENTS.md`, the skills as checklists, `llms.txt`.
11. A final read straight through, start to finish, checking that no page
    uses an idea before its chapter.

The interactive examples (section 9) don't wait for the restructure. Steps
12 and 13 can run beside steps 4 to 7, and step 14 waits for the chapters
to settle.

12. The embed page (section 9.4). Run first, then Edit and run. Measure
    each level's load size and agree it before it ships, as 061 asked.
    Lint, type checks, tests and the docs build pass.
13. `<TryIt>` and the stills. Give each playground example a visual test
    posed for its still, add the component to the docs theme, and use it
    on at least one page, starting with Chapter 2's bouncing ball. Its
    listing comes from the example's files with `<<<`.
14. The print build (section 9.5): the print page, Paged.js, the PDF from
    Playwright's headless shell. Only if open question 8 says now.

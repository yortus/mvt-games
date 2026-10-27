# Proposal: The Docs as a Book

> The docs have grown to about 90,000 words for people, plus 16,000 for AI
> agents. That is the length of a small book, but it doesn't read like one.
> Most core ideas are taught three or four times, on the Architecture
> pages, the Building with MVT pages and the Reference pages. Many pages
> depend on chapters that come after them. The voice changes with the age
> of the page. This proposal turns the docs into one book, in six parts
> and five appendices, where each idea is taught once, in the order a
> reader needs it, in the voice of the Principles pages. It also lists
> about thirty errors found along the way, which can be fixed now, before
> anything moves.

**Status:** proposed. Nothing is done yet. Section 9's errors can be fixed
at any time, without waiting for the rest.

**Written:** 2026-10-28, against the `audio90` branch at `6664758c`. Every
page in `packages/sites/docs/` was read in full, apart from
`articles/` (unpublished drafts). The sidebar, the theme, `public/llms.txt`,
`AGENTS.md` and the five `.claude/skills/` stubs were read too. Five
readers took one share each, against the same brief: for each page, what
it introduces, what it uses before it is introduced, what it repeats, and
how its voice compares with the Principles pages. Their claims marked
"checked" in section 9 were confirmed against the code or the text before
this was written.

**Related:**
[Docs home](../../packages/sites/docs/index.md) -
[The Principles Behind MVT](../../packages/sites/docs/architecture/principles/index.md) -
[Style Guide: Writing](../../packages/sites/docs/reference/style-guide.md#writing) -
[contributing.md](../../packages/sites/docs/contributing.md) -
[Docs site config](../../packages/sites/docs/.vitepress/config.ts) -
[015, the documentation overhaul](../archive/015-documentation-overhaul/task.md), which made today's shape -
[070, the principles pages](../archive/070-principles-docs.md), which made the voice this proposal adopts -
[074](074-audio90-standalone-package.md), whose docs step touches the Sound chapter

---

## Summary

| # | Recommendation | Section |
| --- | --- | --- |
| 1 | Write one book, not three parallel tracks. Drop the separate language-neutral Architecture pages, and keep the specification as one appendix | [3](#3-one-book-not-three-tracks) |
| 2 | Six parts, with appendices: The Idea, The Simulation, The Presentation, Why It Works (the principles), Presentation in Practice, Building with Confidence | [4](#4-the-outline) |
| 3 | Put the principles after the core and before the practice chapters, so the practice chapters can name them rather than re-argue them | [4.5](#45-part-iv-why-it-works) |
| 4 | Give each concept one home chapter. Elsewhere, a page states it in a sentence and links to its home | [5](#5-one-home-for-each-concept) |
| 5 | Adopt the Principles pages' voice everywhere, and a chapter shape adapted from theirs | [6](#6-voice-and-chapter-shape) |
| 6 | Mark this project's libraries with one kind of aside, "In this project", and move what is about the Arcade and this repo out of the book | [3.3](#33-general-ideas-this-projects-libraries-and-this-repo) |
| 7 | Move contributor material (code style, project structure, writing guide) into a separate "Working in This Repo" section, outside the book | [7.2](#72-working-in-this-repo) |
| 8 | Make the agent files point to the book rather than copy it | [7.3](#73-the-agent-files) |
| 9 | Let VitePress write Previous and Next from the sidebar, and keep old URLs working with a redirect map | [8](#8-links-urls-and-navigation) |
| 10 | Fix the errors in section 9 now. They don't depend on the restructure | [9](#9-errors-to-fix-now) |

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
inside `refresh()`") now contradicts the fixed-binding rule. Section 9
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

### 4.2 Part I: The Idea

| # | Chapter | Sources | About |
| --- | --- | --- | --- |
| 1 | **Why MVT** | Architecture overview, docs home | The problem, shown with a tangled bouncing ball. Three jobs, three owners. Two kinds of state. The tick in one picture. What you get, and what it costs. Patterns you may know. The one place the whole frame sequence is drawn |
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
in section 9: Time Management calls a hand-written phase machine "Bad",
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

### 4.5 Part IV: Why It Works

| # | Chapter | Sources | About |
| --- | --- | --- | --- |
| 13 | **The Principles Behind MVT** | Principles overview | Unchanged in substance |
| 14-21 | **The eight principles** | SoC, SSOT, CQS, DIP, CRP, DbC, MISU, DfT | Unchanged in substance. Their links are updated to the new chapters |
| 22 | **Why Views Poll** | Why Polling, Events and Signals | One page, about 2,000 words from today's 4,800. Keep the measurements, "When Push Wins" and counts for sound. Drop the restated "Observations" and the duplicate summary table. Fix the advice that contradicts counts (section 9) |
| 23 | **Where MVT Comes From** | Heritage | Its immediate-mode section shortened to a link to Chapter 6. "Battle-tested" goes |

The principles go after the core and before the practice chapters. That
placement gets three things right:

- **Their dependencies are met.** By Chapter 13, the reader has met
  presentation state, `watch`, composition and phases, which the principle
  pages lean on.
- **The practice chapters can point back.** Sound can say "this is CQS at
  work" and link back, instead of arguing it again.
- **Testing can rest on DfT.** Today, the Testing page's "Philosophy"
  restates DfT in a weaker form and doesn't link to it.

The cost is a long run of theory, about 21,000 words, in the middle of
the book. The part's opening page should say so plainly. A reader keen to
build can skip to Part V and come back. The alternative, the principles
as the last part, is open question 1.

### 4.6 Part V: Presentation in Practice

| # | Chapter | Sources | About |
| --- | --- | --- | --- |
| 24 | **Growing a Complex View** | Taming Complex Views, Complex Sequences | One ladder: inline first, then sub-views, then helpers (tweens, the metronome, easing), then shared sequences and reactions, then a view model. One match-effects story, not two that disagree |
| 25 | **Lists in Motion** | The second half of Collections | Items that carry presentation state, release delays, `OrderedSlotList`, drag and drop |
| 26 | **Sound and Music** | Sound and Music | Audio views. Its re-teaching of counts, the first poll and the metronome becomes links. Rewritten for one clock when 074 lands |
| 27 | **Reading Layout Back** | Reading Layout Back | Unchanged in substance |
| 28 | **Reduced Motion** | Reduced Motion | Last, since it uses phases, presentation state and sequences |

### 4.7 Part VI: Building with Confidence

| # | Chapter | Sources | About |
| --- | --- | --- | --- |
| 29 | **Testing Models** | Testing (opener), Testing Models | The only home for leap safety's testing side and `advanceTime`. It opens from DfT's "control, observe, repeat" and links there for the why |
| 30 | **Testing Views** | Testing Views | Assertions or images: "the value problem". Audio views get a link to Chapter 26's testing section, not a copy |
| 31 | **Visual Tests** | Visual Tests, Testing Views' snapshot sections | Posing, advancing time, whole screens, keeping images the same, reviewing a change. One word for one thing: "reference image". "Choosing a Tool" shrinks to an aside that links to v-snap's README |
| 32 | **Why Performance Matters** | Why Performance Matters | Unchanged in substance |
| 33 | **Hot Paths** | Hot Paths | Owns the H-* rules, links to Chapter 8 rather than re-teaching `watch`, and quotes figures only from Appendix C's short version |

### 4.8 Appendices

| | Appendix | Sources | About |
| --- | --- | --- | --- |
| A | **MVT on One Page** | Architecture Rules, the spec parts of the Architecture pages | Section 3.2. Replaces both rules pages |
| B | **Glossary** | Glossary | Each entry is one or two sentences and a link. MVT terms first, then a labelled section of the libraries' terms. Adds the missing terms: phase, leaf view, top-level view, pose, `SlotList`, idempotent, static state. Drops the orphan "Stateful view" |
| C | **Measurements** | Measurements | The generated tables, and one short version that matches them. That short version is the only source other pages quote. The per-game history moves to the benchmarks README |
| D | **Measuring Performance** | Benchmarking Methods | Without "Running the Repo's Benchmarks", which moves to the benchmarks README |
| E | **Timelines with GSAP** | GSAP sections of Time Management | The paused-timeline recipe and its pitfalls, in one place. GSAP is "a convenience, not a requirement", so it doesn't belong in Chapter 4, but six games use it, so it deserves one good page |

Common Mistakes goes. Each of its nine rows restates a page that already
covers it, one row is now wrong, and it misses the "Common Mistakes" tables
on Sound and Collections and the principles' "Common Misreadings". If a
symptom index is wanted later, it should only link ("my view shows a stale
value: see Chapter 7"). That is open question 4.

### 4.9 Outside the book

- **Working in This Repo**: a separate sidebar section (section 7.2).
- **AI Agents**: section 7.3.
- **The audio90 guides** stay in their package. They belong to `audio90`,
  which is published on its own. Chapter 26 links to them.
- **Articles** stay unpublished drafts, as now.

## 5. One Home for Each Concept

Each concept gets exactly one chapter that teaches it in full. Any other
page that needs it says it in a sentence, at most, and links to the home.
A summary or overview may restate it briefly, and should say it is a
summary.

| Concept | Home | Pages that keep only a sentence and a link |
| --- | --- | --- |
| The frame sequence | Ch. 1 (the picture), Ch. 5 (the detail) | Preface, Ch. 2, Ch. 6, CQS, Ch. 22, App. A |
| Two kinds of state | Ch. 1 | Ch. 9 |
| Presentation state, view models | Ch. 9 (view models in Ch. 24) | Ch. 1, Ch. 5, Ch. 6, Ch. 26, SSOT |
| The delete-the-view test | Ch. 9 | Ch. 6, SoC |
| `update(deltaMs)` contract | Ch. 3 | Ch. 4, App. A |
| Leap safety | Ch. 4 | Ch. 29 |
| `advanceTime` | Ch. 29 | Ch. 4 |
| Phases and progress | Ch. 4 | MISU, Ch. 9, Ch. 28 |
| Counts and `watch()` | Ch. 8 | Ch. 3 (the model's side), CQS, Ch. 26, Ch. 33 |
| The metronome | Ch. 24 | Ch. 26 |
| Access patterns (bindings, model, constants) | Ch. 7 | Ch. 6 |
| Fixed and changeable values | Ch. 7 | SSOT, App. A |
| Immediate-mode data, retained-mode output | Ch. 6 | Ch. 10, Ch. 23 |
| `<List>`, `SlotList` | Ch. 12 (views), Ch. 3 (models) | Ch. 25 |
| Testing a model | Ch. 29 | Ch. 3 (one sentence, no example) |
| Testing an audio view | Ch. 26 | Ch. 30 |
| Reference images and review | Ch. 31 | Ch. 30 |
| Hot paths | Ch. 33 | Ch. 5, App. A |
| Performance figures | App. C, its short version | Every page that quotes a number |
| Why polling | Ch. 22 | SSOT, CQS, Ch. 23 |
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

## 9. Errors to Fix Now

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

## 10. Considered and Not Recommended

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
  and Chapter 24 takes the ladder from simple to complex.
- **Rewrite the principles.** They are the standard. Only their links
  change, and their order relative to the rest.

## 11. Open Questions

1. **Where the principles go.** This proposal puts them in the middle
   (Part IV). The alternative is the end, as a capstone. That would satisfy
   every dependency too, but the practice chapters would then link
   forward to the reasons, and Testing would repeat DfT's case or point
   forward to it.
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

## 12. Implementation Steps

Each step from 3 on is one reviewable chunk, in reading order, so each
review sees whole parts of the book.

1. Fix section 9's errors (except row 22, which goes with 074). No pages
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
6. Part IV: the principles' links, Chapter 22 (the merge), Chapter 23.
7. Parts V and VI: Chapters 24-33.
8. Appendices A-E, the glossary rewrite, and the deletion of the
   reference rules stub and Common Mistakes.
9. Working in This Repo: the split Style Guide, Project Structure and the
   README moves.
10. The agent files: `AGENTS.md`, the skills as checklists, `llms.txt`.
11. A final read straight through, start to finish, checking that no page
    uses an idea before its chapter.

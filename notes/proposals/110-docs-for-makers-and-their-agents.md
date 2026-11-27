# Proposal: Docs for game makers and their agents

> The docs became a book, *Building Web Games with MVT*, to prove to a
> doubtful reader that MVT works. That job is done. The readers who matter
> next are the ones proposal 109 describes. They make small web games for
> themselves and their friends, or for a small studio, and coding agents
> write much of the code. This proposal turns the book back into docs.
> They're about 45,000 words, down from 110,000, and grouped by task rather
> than by reading order. They lead with what this stack does that others
> don't make easy. Games replay exactly, agents can check their own work,
> lint enforces the rules, and you control time. Four things are still
> settling, and each gets a marked page of its own: the view tick API,
> timelines and animation, sound cues and banks, and PixiJS 3D. The work
> comes in six stages. The first can land at once. The second waits for
> the `pixi-3d` worktree to merge.

**Status:** proposed. Nothing done yet. The `pixi-3d` worktree has since
merged into vnext (by 2026-11-24), so stage 1 can start too.

**Written:** 2026-11-22, on `vnext` at `e78eb349`, from a review of the
whole book (every chapter's outline, the Preface, Chapters 1 to 3, 9 and 25,
the Conclusion and Appendix H read in full), the docs' build
(`packages/sites/docs/.vitepress/book.ts` and `config.ts`, the print
scripts, `deploy.yml`), the files outside the docs that link into them, and
the open worktrees (`pixi-3d`, `timelines`, `studio`).

**Related:**
[the docs](../../packages/sites/docs/),
[book.ts](../../packages/sites/docs/.vitepress/book.ts) (sidebar, numbering, redirects, print list),
[site-nav.ts](../../packages/sites/site-kit/scripts/site-nav.ts) (the nav's Book link),
[the agent skills](../../packages/sites/docs/ai-agents/index.md),
[the lint plugin](../../packages/internal/eslint-plugin/src/rules/),
[075](../archive/075-docs-as-a-book.md) (which made the book),
[090](../tasks/backlog/090-book-follow-ons.md) (the book's follow-ons, pruned in stage 1),
[103](./103-timelines-animations-and-players.md) (timelines, animations and players),
[107](./107-complete-pixi-3d-jsx.md) (PixiJS 3D, in the `pixi-3d` worktree),
[109](./109-indie-game-maker.md) (gamefab, whose users these docs are for),
[073](../tasks/backlog/073-models-take-their-random-source.md) (models take their random source).

| # | Decision or recommendation | Section |
| --- | --- | --- |
| 1 | The docs are for makers who build with agents: the agent, the coder who reads the code, and later the director and the cartridge author. No longer for a sceptic who needs convincing | 2 |
| 2 | Lead with what's hard to get elsewhere: exact replays, checks agents run, rules in lint, time control, the sound chip, live examples. Stop defending polling | 3 |
| 3 | Docs, not a book: no parts, chapter numbers, PDF or per-page boilerplate. Keep the plain voice and the live examples | 4, 8 |
| 4 | Seven groups: Start, Guide, Renderers, Recipes, Working with Agents, Reference, Background. Working in This Repo stays apart | 5 |
| 5 | Four pages are marked as settling, each the one home for its topic, so the work in progress lands in one place: the view tick API, timelines and animation, sound cues and banks, PixiJS 3D | 6 |
| 6 | **Placeholder** for provisional content and values that ship until replaced or tuned. **Stand-in** stays the testing term, for a part that replaces a real one during a test | 7 |
| 7 | One source for the rules: the Rules page, the lint rules (each linking to its page) and the skills agree, and the skills link rather than restate | 9 |
| 8 | Every current page has a fate (section 10). Old addresses redirect | 10, 11 |
| 9 | Six stages. Stage 0 at once; stage 1 after `pixi-3d` merges; stage 5 as each settling topic lands; stage 6 with 109 | 13 |

---

## 1. Why change

The book was written for one reader: someone who knew web apps, cared about
software design, and had to be persuaded that MVT beat writing games in a
reactive UI framework. It shows. About 39% of it is on presentation, 19% on
eight design principles, and much of the rest compares MVT with React,
signals and events. "React" appears 181 times. That argument is won, so
these pages no longer need to make it.

The readers who matter now are 109's: people who want to make small 2D (and
soon 3D) web games, for themselves and their friends, or to publish, with a
coding agent doing much of the work. They don't need to be persuaded. They
need to get a game working, keep it working as it grows, and trust what the
agent changed. The book serves them badly:

- **It's long.** The quickest route it offers (Parts I to III) is about
  45,000 words.
- **It's missing what games need.** There's no chapter on input, game flow
  (title, pause, game over), randomness and replays, loading, project
  layout or publishing. Replays are claimed 28 times and never shown.
- **Its first game isn't a game.** Chapter 3 is a bouncing ball with no
  input or score.
- **Its precision is spent on the wrong reader.** Rules like "a second
  `update(0)` changes nothing" are exactly what an agent needs, but they're
  spread through 110,000 words of narrative.
- **Its apparatus costs upkeep.** Part and chapter numbers, numbered
  experiments, section references, and a PDF printed on every deploy, for
  readers who would rather search.

## 2. Who the docs are for

| Reader | Needs | Served by |
| --- | --- | --- |
| **The agent** that writes the code | Exact rules, each with its reason; one home for each idea; what to do when no rule covers a case; how to check its own work | Reference (the rules, lint rule pages), Working with Agents, the skills |
| **The coder** who reads and changes the code, or works in a small studio | A guide by task, the APIs, recipes for common jobs | Start, Guide, Renderers, Recipes, the libraries' own guides |
| **The director** (109's maker), who may not code | How to write a spec, playtest, tune, read the scores, grow cartridges. MVT only as one page on why changes are safe and gradable | The Maker's docs, later (stage 6) |
| **The cartridge author** | How to write skills, components, scenarios, graders and bots | The Maker's docs, later (stage 6) |

The first two are served by this proposal. The last two wait for 109, since
there's nothing yet to document. Docs for a product that doesn't exist go
stale before it ships.

These docs are useful whether or not 109 goes ahead: a coder building a game
with an agent, using the published libraries, is the same reader either way.

## 3. What to lead with

### 3.1 What this stack does that others don't make easy

These get the most care, the clearest examples and a place near the start:

- **Exact replays.** Models move only through `update(deltaMs)`, with time
  from the ticker and numbers from a seeded random source, so the same seed
  and input play the same game. This is 109's "feedback pinned to a tick",
  and the docs have never shown it working.
- **Checks an agent can run on its own work.** Model tests without a screen,
  scenarios and bots played headless, and v-snap images of each view. Shown
  as the agent checking itself, as well as you testing.
- **Rules that lint enforces.** An agent that breaks a rule finds out at
  once, with a link to why (section 9).
- **Time under control.** Pause, slow motion, fast forward, stepping and
  replays, all from the `deltaMs` the ticker passes.
- **Sound as data.** Two sound chips with a tracker, and placeholder sounds
  made by code (section 6.3 says where this is heading).
- **Examples that run in the page,** which open in the playground.

### 3.2 What to stop arguing

Chapter 10 (Why Views Poll), the case for polling repeated in Chapters 2, 9
and 23 and Appendix C, the long comparisons with React and Solid, and
Chapter 1's tour of engines, renderers and UI frameworks. A short Design
Choices page (section 5.7) keeps one paragraph on each question a newcomer
asks, with the measurements a link away.

The "In this book" asides go too. They kept MVT apart from the `@mvtjs`
libraries, to show that MVT isn't a library. That mattered for the proof.
Now the stack is the product and MVT is its shape, so the docs say plainly
"`setRefresh`, from `@mvtjs/pixi`, sets ..." One page (MVT Elsewhere, from
Appendix H) keeps the claim that MVT works without them.

**Settled; do not reopen without new information:** the docs no longer
argue for polling against events or signals.

## 4. Docs, not a book

- **The nav says Docs.** `site-nav.ts` and the playground's `index.html`
  change "Book" to "Docs"; the home page is the docs' home, not a preface.
- **No PDF.** The print scripts, the deploy step and the sidebar's PDF link
  go. Nobody has asked for a printed copy.
- **No numbers.** No parts, chapter or appendix numbers, numbered headings
  or "Experiment 4A" labels. Links say a page's title ("see
  [Bindings](...)"), not "see Chapter 8". Experiments keep their pictures,
  Run buttons and playground links, labelled "Try it".
- **No boilerplate on every page.** No **Related:** line, Summary section or
  Further Reading by habit. Further Reading stays only where a source is
  genuinely worth reading next.
- **Common Mistakes, at most three.** A guide page keeps the two or three
  mistakes a newcomer or an agent is most likely to make. The rest move to
  Troubleshooting, arranged by symptom, which is how both people and agents
  look for them.
- **The voice stays.** Short, complete sentences in everyday words, "you"
  for the reader, terms explained where first used, as the writing guide
  says. That voice suits readers whose first language isn't English, and
  agents, as well as it suits learners.

**Settled; do not reopen without new information:** the docs aren't a book,
and aren't printed.

## 5. The shape

Paths are under `packages/sites/docs/`. Word counts are targets for each
page after stage 2, to keep the total near 45,000. Pages marked *(new)* are
written in stage 3 or 4; pages marked *(settling)* are section 6's.

### 5.1 Home (`index.md`, 600)

What this is: small web games built in MVT's shape, often with agents, and
what that gets you (the list in section 3.1). Where to start, by reader:
making your first game, working with an agent, looking something up.

### 5.2 Start (`start/`)

| Page | Words | From |
| --- | --- | --- |
| `how-mvt-works.md` | 2,000 | Chapter 2 (the tangled ball, three parts, two kinds of state, the tick), a paragraph from Chapter 1, and the Conclusion's "What MVT Doesn't Do" |
| `your-first-game.md` | 2,500 | Chapter 3, grown into a small game with input, a score and a game over (stage 3) |

### 5.3 Guide (`guide/`)

Written renderer-neutral where it can be, with Pixi for the examples, so a
second renderer (section 6.4) doesn't mean rewriting the guide.

| Page | Words | From |
| --- | --- | --- |
| **The simulation** | | |
| `models.md` | 2,500 | Chapter 4 |
| `the-tick.md` | 2,000 | Chapter 5, plus why MVT steps by the frame's time with a cap, not in fixed steps, and when you'd want fixed steps |
| `phases-and-game-flow.md` | 2,500 | Chapter 6, plus a game's screens (title, play, pause, game over) as phases of the top-level model |
| `input.md` *(new)* | 2,000 | Rule 8, relay bindings (Chapter 8), held controls as state and one-off commands as actions, keys, pointers, touch and gestures, the arcade controls |
| `randomness-saving-and-replays.md` *(new)* | 2,000 | A seeded random source, saving a model, recording and playing back input, with an example that replays a game |
| **The presentation** | | |
| `views.md` | 2,000 | Chapter 7; the tick API's details link to its reference page (section 6.1) |
| `bindings.md` | 2,000 | Chapter 8 |
| `noticing-changes.md` | 2,000 | Chapter 9: the idea, reactions and counts. The API's detail moves to `@mvtjs/utils`'s guide |
| `presentation-state.md` | 2,000 | Chapter 11 |
| `writing-views-in-jsx.md` | 1,500 | Chapter 12; attribute detail moves to the renderer pages and cheat sheets |
| `composing-views.md` | 1,500 | Chapter 13 |
| `lists-and-switches.md` | 2,000 | Chapter 14 |
| `effects-and-animation.md` *(settling)* | 2,500 | Chapter 18's ladder (inline, sub-views, helpers, shared timing, view models); section 6.2 |
| `sound-and-music.md` *(settling)* | 2,000 | Chapter 20; section 6.3 |
| **Checking and speed** | | |
| `testing-models.md` | 1,500 | Chapter 15 |
| `testing-views.md` | 1,500 | Chapters 16 and 17 merged: assertions where they help, v-snap images for the rest |
| `performance.md` | 1,500 | Chapters 23 and 24 merged: the frame's deadline, garbage, the hot-path rules |
| `project-layout-and-tunables.md` *(new)* | 1,200 | A game's folders (`data/`, `models/`, `views/`, `start/`), tunables first, the top-level `GameModel` and `GameView`, generalised from the entries' README |

### 5.4 Renderers (`renderers/`)

One short page each (800 to 1,200 words): setting up, the JSX runtime, what
the renderer adds (the pointer picker, text, bridges), and its limits.

- `pixi.md`
- `pixi-3d.md` *(settling, section 6.4)*
- `html.md`
- `three.md`

These are new pages, filled from the renderer asides in Chapters 7 and 12,
the glossary, and each library's README.

### 5.5 Recipes (`recipes/`)

Short pages for one job each, which a guide page links to when the job comes
up:

| Page | From |
| --- | --- |
| `lists-in-motion.md` | Chapter 19 |
| `drag-and-drop.md` | Chapter 19's drag section, and the grid gestures |
| `reading-layout-back.md` | Chapter 21 |
| `reduced-motion.md` | Chapter 22 |
| `gsap-in-a-model.md` | Appendix E. Revisit once 103 lands: if timelines do the job, this shrinks to a note |

### 5.6 Working with Agents (`agents/`) *(new, stage 4)*

| Page | Words | Contents |
| --- | --- | --- |
| `index.md` | 1,200 | Why this shape suits agents; an `AGENTS.md` and skills for a game project; what to keep in the agent's reach and what not to |
| `checks-agents-run.md` | 1,200 | Types, lint, model tests, v-snap images, replays, and later 109's scenarios: what each catches, how an agent runs it, how to read a failure |
| `deciding-new-cases.md` | 1,500 | Chapter 34 with Chapter 25's table of the eight principles: how to decide a case no rule covers, and what to do when principles pull apart |

### 5.7 Reference (`reference/`)

| Page | From |
| --- | --- |
| `rules.md` | Appendix A, each rule naming the lint rule that checks it, if any |
| `lint-rules/<rule>.md` *(new)* | One short page a rule: what it catches, why, how to fix it (section 9) |
| `view-tick-api.md` *(settling, section 6.1)* | Chapter 7's tick section and the tick cheat sheet |
| `cheat-sheets.md` | Appendix G |
| `glossary.md` | Appendix B, trimmed to the terms these pages use, plus section 7's two |
| `troubleshooting.md` | Appendix F, plus the Common Mistakes moved out of the guide |

### 5.8 Background (`background/`)

For the curious, and for anyone deciding whether to trust the design. Not
on the route to a working game.

| Page | Words | From |
| --- | --- | --- |
| `design-choices.md` *(new)* | 1,500 | One short answer each: why views read every frame (Chapter 10 condensed), why views have two steps (092's decision), why the frame's time and not fixed steps, why factories, no `null` and string unions (house style, not MVT) |
| `the-principles.md` | 2,000 | Chapters 25 to 33 condensed: the goal, each principle in a paragraph with the rules it produces |
| `measurements.md` | 1,500 | Appendix C, trimmed to the tables and what they show |
| `mvt-elsewhere.md` | 1,200 | Appendix H |

### 5.9 Working in This Repo

Unchanged, outside the docs' main groups. Appendix D (Measuring
Performance) moves here, or into the benchmarks' README, since it's about
benchmarking this repo's code.

### 5.10 Where the words go

| Group | Words |
| --- | --- |
| Home and Start | 5,000 |
| Guide | 33,000 |
| Renderers and Recipes | 9,000 |
| Working with Agents | 4,000 |
| Reference (without lint rule pages and the glossary) | 5,000 |
| Background | 6,000 |

That's about 62,000 at its fullest, with the new pages. Without the new
pages, what's carried over comes to about 45,000. The guide is the place to
cut further if it reads long.

## 6. Room for what's still settling

Four topics are changing. Each gets one page that's its only home, so the
new design lands in one place, and every other page links there rather than
restating it. Until it lands, the page says what works today, briefly, and
carries a notice.

**The notice.** A page sets `status: settling` in its frontmatter, and the
theme shows a short callout at its top: "This part is still settling. What's
here works today, and will change when [the new design] lands." Agents read
the same notice. The skills say to use what the page shows today, and not
to build helpers around it. Removing the line is part of
landing the new design.

**What not to do in the meantime:** don't polish or expand the old material
on these topics. Stage 2 cuts it to what a reader needs to use it today.

### 6.1 The view tick API

- **Home:** `reference/view-tick-api.md`. `guide/views.md` has one section
  on updating and refreshing views, in terms of what happens (every update
  step, then every refresh step, parents first), and links here for the
  functions.
- **Until then:** `setUpdate`, `setRefresh`, `updateView`, `refreshView`,
  `SKIP_DESCENDANTS` and the tick counter, as they are, in about 800 words.
  The tick cheat sheet stays generated from the libraries, so it follows
  the code.
- **When it lands:** the reference page is rewritten; the guide's section
  changes only if what happens changes.

### 6.2 Timelines and animation

- **Home:** the "shared timing" step of `guide/effects-and-animation.md`,
  and a recipe if 103's players need one.
- **Until then:** Chapter 18's "Share a Sequence" section (about 1,500
  words today) shrinks to a short, plain account of `createSequence` and
  `createSequenceTracker` in a settling block. It doesn't move into
  `@mvtjs/utils`'s guide, since 103 section 9 retires both.
- **The rest of the page is stable:** the ladder of five (keep an effect
  inline, split into sub-views, reach for a helper, share timing, extract a
  view model) holds whichever tool shares the timing.
- **When it lands:** 103's own docs step writes timelines, animations and
  players into this page, then decides what's left of `gsap-in-a-model.md`.

### 6.3 Sound cues and banks

- **Home:** the "playing a sound" part of `guide/sound-and-music.md`.
- **Stable parts stay as they are:** sound is presentation; play on a
  change, never on a state; counts for moments that repeat; music on the
  chip's own clock; testing an audio view.
- **Until then:** audio views that call reactions and play on the chips, as
  today, in a settling block.
- **When it lands:** a view raises a named cue, and a bank, kept as data,
  says what each cue sounds like, so sounds can be changed beside the game
  and apart from its code. There's no proposal for this yet; one is needed,
  and its docs step writes into this page. It fits 109's files-are-truth
  rule and its sound editor, so the bank's format should be one the Maker's
  editors can read and write.

### 6.4 PixiJS 3D

- **Home:** `renderers/pixi-3d.md`, and a line on the home page and in
  How MVT Works saying the games can be 2D or 3D.
- **Now:** 107's stage 7, under way in the `pixi-3d` worktree, is writing
  its docs into Chapters 1, 7 and 12, the glossary and the view skill. That
  lands first, as it is. Stage 1 of this proposal then moves the material
  specific to PixiJS 3D into `renderers/pixi-3d.md`, and leaves the guide
  renderer-neutral.
- **Open:** where three.js stands once PixiJS 3D is a core renderer
  (section 12).

## 7. Placeholder and stand-in

109 makes provisional content part of everyday work: sprites, maps, sounds,
music, tunable values, animation values, text. One term should cover all of
them, and it shouldn't collide with a term the docs already use.

**Use "placeholder"** for content or a value that is in the game for now,
and ships in builds until someone replaces it or tunes it: placeholder art,
a placeholder song, placeholder speeds. It's the word game developers
already use for all of these ("placeholder art", "these numbers are
placeholders"), it reads naturally for values as well as assets, and 109
already uses it.

**Keep "stand-in"** for testing: a part that takes a real part's place
during a test, and never ships. Stand-in bindings, a stand-in model, a
stand-in chip. The docs and v-snap's docs already use it this way, 31 times.

The difference is what happens next. A placeholder gets replaced or tuned
in the game. A stand-in only ever lives in a test. One word for both would
blur the line that matters most when an agent decides whether something is
finished.

Stage 0 adds both to the writing guide's terms; stage 2 adds them to the
glossary.

**Settled; do not reopen without new information:** "placeholder" for
provisional content and values, "stand-in" for test doubles.

## 8. A page's shape

1. The title, and a summary in a quote block, two to four sentences.
2. The idea, shown with a small example, then a Try It where one helps.
3. The details, in sections a reader can jump to.
4. Common Mistakes, at most three.
5. See Also, a short list of links, only where it helps.

Library-specific asides become plain statements. Examples keep the house
style (factories with one options object, `undefined`, string unions), and
Design Choices says once that it's a style, not part of MVT.

## 9. One source for the rules

The same rules reach three readers: people (the docs), agents (`AGENTS.md`
and the skills) and machines (lint). Today they're written three times, and
the skills point at chapters for their reasons.

- **The Rules page is the source.** Each rule says what it requires, why in
  a sentence, and which lint rule checks it, if any.
- **Each lint rule links to its page.** Each rule in
  `packages/internal/eslint-plugin/src/rules/` sets `meta.docs.url` to
  `reference/lint-rules/<rule>`, so the error an agent sees carries a link
  to what's wrong and how to fix it. None sets one today. The pages are
  short: what it catches, why, a wrong and a right example, and how to fix
  it.
- **Rules about MVT and house style are told apart.** `no-wall-clock`,
  `no-module-state`, `no-control-names` and the watch rules
  (`no-conditional-poll`, `no-inline-watch`, `no-repeated-poll`,
  `no-unused-watch`) are about MVT. `no-null`, `no-this`, `no-em-dash`,
  `no-deep-imports` and `no-relative-imports-into-src` are this repo's
  style. The pages say which.
- **The skills link, not restate.** Each skill keeps its short checklist
  and links to the Rules page and guide pages for the reasons. Stage 4
  writes general versions for a game project outside this repo, which 109
  section 3.3 needs; the repo's own skills then add only what's specific to
  this repo.

## 10. What happens to each page

| Today | Becomes | How |
| --- | --- | --- |
| Preface (`index.md`) | Home | Rewritten |
| 1. Games in the Browser | `start/how-mvt-works.md` (a paragraph) | Mostly cut |
| 2. Why MVT | `start/how-mvt-works.md` | Condensed; "Patterns You May Know" cut to a few rows |
| 3. A First Game | `start/your-first-game.md` | Moved, then grown (stage 3) |
| 4. Models | `guide/models.md` | Condensed |
| 5. The Tick | `guide/the-tick.md` | Condensed, plus a timestep section |
| 6. Time and Phases | `guide/phases-and-game-flow.md` | Condensed, plus game flow |
| 7. Views | `guide/views.md`, `reference/view-tick-api.md`, renderer pages | Split |
| 8. Bindings | `guide/bindings.md` | Condensed |
| 9. Noticing Changes | `guide/noticing-changes.md`, `@mvtjs/utils`'s guide | Split |
| 10. Why Views Poll | `background/design-choices.md` (a section) | Mostly cut |
| 11. Presentation State | `guide/presentation-state.md` | Condensed |
| 12. Writing Views in JSX | `guide/writing-views-in-jsx.md`, renderer pages | Split |
| 13. Composing Views | `guide/composing-views.md` | Condensed |
| 14. Lists and Switches | `guide/lists-and-switches.md`, `@mvtjs/utils`'s guide | Split |
| 15. Testing Models | `guide/testing-models.md` | Condensed |
| 16. Testing Views, 17. Visual Tests | `guide/testing-views.md` | Merged |
| 18. Growing a Complex View | `guide/effects-and-animation.md` | Condensed; sequences cut to a settling block |
| 19. Lists in Motion | `recipes/lists-in-motion.md`, `recipes/drag-and-drop.md` | Split |
| 20. Sound and Music | `guide/sound-and-music.md` | Condensed; settling block |
| 21. Reading Layout Back | `recipes/reading-layout-back.md` | Moved |
| 22. Reduced Motion | `recipes/reduced-motion.md` | Moved |
| 23. Why Performance Matters, 24. Hot Paths | `guide/performance.md` | Merged |
| 25. The Eight Principles, 34. Using the Principles | `agents/deciding-new-cases.md` | Merged |
| 26 to 33, one principle each | `background/the-principles.md` | Condensed into one page |
| Conclusion | `start/how-mvt-works.md` ("What MVT Doesn't Do") | Mostly cut |
| A. MVT on One Page | `reference/rules.md` | Moved, then linked to lint (stage 4) |
| B. Glossary | `reference/glossary.md` | Trimmed |
| C. Measurements | `background/measurements.md` | Trimmed |
| D. Measuring Performance | Working in This Repo, or the benchmarks' README | Moved |
| E. Timelines with GSAP | `recipes/gsap-in-a-model.md` | Moved |
| F. Troubleshooting | `reference/troubleshooting.md` | Grows |
| G. API Cheat Sheets | `reference/cheat-sheets.md` | Moved |
| H. MVT Beyond the Web | `background/mvt-elsewhere.md` | Moved |

What's cut stays in git history. Before stage 1, tag the last commit of the
book (`book-2026-11`, say) so it's easy to find.

## 11. What moving the pages touches

- **`book.ts`** becomes the docs' sidebar (renamed `sidebar.ts`): the
  groups of section 5, no numbering (`numberHeadings`,
  `numberExperiments`, `fillSectionReferences` and the section-label cache
  go or change), no printed-book list. Its `REDIRECTS` gains an entry for
  every old address, so links to the book keep working.
- **About 315 `[§](...)` references and 300 "Chapter N" or "Appendix X"
  mentions** in the pages become links by title.
- **Outside the docs, 25 files link in:** `AGENTS.md`, the skills, the
  libraries' READMEs (pixi, utils's JSX README and design notes, v-snap),
  the benchmarks' README, the entries' README, Reordering Lists' README,
  the site kit's arcade README, `llms.txt`, the working-in-this-repo pages,
  and the playground's cheat sheets, reference view and `to-chapter-url.ts`
  (which becomes `to-docs-url.ts`).
- **The deploy:** `deploy.yml`'s print step and `deploy-zz9.yml`'s comment
  about the PDF.
- **The nav:** `site-nav.ts` and the playground's `index.html`.
- **The playground's `book/` folder** of examples keeps its name for now
  (section 12).

## 12. Open questions

- **three.js after PixiJS 3D.** Does three.js stay a core renderer with its
  own page, or become an example of using MVT with another renderer, in MVT
  Elsewhere? It decides whether `renderers/three.md` is written in full.
- **The site's title.** "MVT Games" today. Keep it until 109 has a name.
- **Recipes as a group.** If it stays under five pages, it could fold into
  the guide as a last section.
- **Your First Game.** Grow it in stage 3, as proposed, or wait for 109's
  project template (stage 6) and write it once as a standalone project?
  Growing it now gives the guide a through-line sooner.
- **The playground's `book/` folder.** Rename it `docs/` to match, at the
  cost of touching the playground's loader and every `<TryIt>`?
- **Where the general skills live.** In the docs, published, or in the game
  kit's package, beside the project template 109 needs?
- **A proposal for sound cues and banks** (section 6.3), so its docs step
  has something to follow.

## 13. Stages

Each stage is reviewed before the next starts. Stages 2 and 3 are reviewed
a chunk at a time.

### Stage 0: Book to docs, in name (small, any time)

Touches no chapter's text, so it doesn't collide with the `pixi-3d`
worktree.

- The nav's "Book" becomes "Docs", in `site-nav.ts` and the playground's
  `index.html`.
- The PDF goes: the print scripts, `PRINTED_BOOK_FILE`, the sidebar's link,
  the Preface's "online-only" block, and the deploy step.
- The Preface's title and opening say "MVT docs", not a book; its "Who This
  Book Is For" says who the docs are for (section 2).
- The writing guide gains the two terms of section 7.
- 090 is pruned: items this proposal answers (the book's length, the
  sequence API's positional arguments, the libraries' READMEs naming the
  book, Chapter 1's unchecked link) are struck through, pointing here; the
  rest stay (the arcade models that drop leftover time, Kwazy Cactii's
  board progress, `for...of`, the two meanings of "pose", the pixi README's
  figures, the embed's items).

**Done when:** the build and `npm test` pass, the nav says Docs, no PDF is
built or linked, and the deploy runs without the print step.

### Stage 1: The new shape (after `pixi-3d` merges)

Mechanical: pages move and lose their apparatus, but their content doesn't
change yet. The diff is mostly moves, so it's quick to review. It waits for
107 to merge, because the `pixi-3d` worktree is editing Chapters 1, 7 and
12 and the glossary.

- Tag the book's last commit (section 10).
- Create the folders of section 5 and move each page to its new home,
  keeping its text. Where section 10 splits or merges pages, move the whole
  page to its main home for now; stage 2 splits and merges.
- Move 107's PixiJS 3D material into `renderers/pixi-3d.md`.
- Create the settling pages that don't yet exist (`reference/view-tick-api.md`,
  `renderers/pixi-3d.md` if 107 didn't make one) with their notice, and the
  theme's callout for `status: settling`.
- Rename `book.ts` to `sidebar.ts`, build the sidebar from section 5, drop
  numbering, add redirects for every old address.
- Replace every `[§]` reference and every "Chapter N" and "Appendix X"
  mention with a link by title.
- Update the 25 files that link in (section 11), `llms.txt` and `AGENTS.md`.
- Delete the per-page **Related:** lines.
- Worktrees opened after this stage write their docs into the new paths.

**Done when:** the build has no dead links; every address in the old
sidebar redirects to a page (checked by a unit test over `REDIRECTS` and
the old page list); `grep` finds no "Chapter [0-9]", "Appendix [A-H]",
"this book" or `[§]` in the docs; the sidebar matches section 5.

### Stage 2: Cut and condense (six chunks)

Each chunk brings its pages to section 5's targets, applies section 8's
page shape, moves surplus Common Mistakes into Troubleshooting, and drops
the "In this book" asides.

1. **Start and Home:** `index.md`, `how-mvt-works.md` (Chapters 1 and 2 and
   the Conclusion), `your-first-game.md` (Chapter 3, unchanged in scope).
2. **The simulation:** models, the tick, phases.
3. **The presentation:** views, bindings, noticing changes, presentation
   state, JSX, composing views, lists and switches, effects and animation,
   sound and music. The settling blocks of section 6 are written here.
4. **Checking and speed:** the two testing pages, performance.
5. **Background and Reference:** design choices, the principles, the
   measurements, MVT elsewhere, the rules, the glossary (trimmed, with
   section 7's terms), troubleshooting. Appendix D moves out.
6. **The libraries' guides:** the API detail cut from Noticing Changes,
   Lists and Switches and JSX goes into `@mvtjs/utils`'s, `@mvtjs/pixi`'s
   and `@mvtjs/html`'s own READMEs or `docs/` folders, written to stand
   alone (as audio90's and v-snap's are), without links back into these
   docs. The renderer pages are filled.

**Done when:** each chunk is reviewed; the carried-over pages total about
45,000 words; no guide page has more than three Common Mistakes.

### Stage 3: The gaps that don't wait on anything (five chunks)

1. **Input** (`guide/input.md`), with a Try It.
2. **Randomness, saving and replays**, with a Try It that records a short
   game and replays it exactly. Its example model takes its random source
   as an option, as 073 asks of the entries; 073 itself isn't a
   prerequisite.
3. **The timestep section** in the tick page, and **game flow** in the
   phases page.
4. **Project layout and tunables**, generalised from the entries' README.
5. **Your first game,** grown to a small game with input, a score and a
   game over, if section 12 decides so.

**Done when:** each page is reviewed and its examples run in the page and
in the playground.

### Stage 4: Agents, and one source for the rules

1. **Lint rule pages**, one for each rule, and `meta.docs.url` on each rule.
   A unit test in the lint plugin checks that every rule has a URL and that
   its page exists.
2. **The Rules page** names each rule's lint rule, and says which rules are
   MVT and which are house style.
3. **Working with Agents:** the three pages of section 5.6.
4. **General skills** for a game project outside this repo, and the repo's
   skills trimmed to what's specific to it, linking to the docs for the
   reasons.

**Done when:** an agent given only a new project's `AGENTS.md`, the general
skills and the published docs can explain any lint error by following its
link; the repo's skills restate no rule's reason.

### Stage 5: Settling topics land (ongoing)

Not a stage that finishes by itself. As each topic's own work lands, its
docs step writes into its home (section 6) and removes the notice:

- the view tick API's improvements, into `reference/view-tick-api.md`;
- 103, into `guide/effects-and-animation.md`, then a decision on
  `gsap-in-a-model.md`;
- sound cues and banks (once proposed), into `guide/sound-and-music.md`;
- PixiJS 3D's later stages, into `renderers/pixi-3d.md`.

**Done when** no page carries a settling notice; until then, each landing
is reviewed with its own proposal.

### Stage 6: With 109

When 109's game kit, lint plugin and project template are published:

- a Quick Start in `start/` that makes a standalone project from the
  template, runs it, changes it and tests it (and so checks the template
  outside the repo, as 109 section 8 asks);
- `guide/publishing.md`: building, itch.io, a static host;
- the Input and Project Layout pages switch from this repo's helpers to the
  game kit's;
- later, top-level groups for the Maker (for the director) and for
  cartridges, written against the Maker as it is built.

**Done when** 109's stage 1 ships with its docs.

# Writing Guide

> How to write for *Building Web Games with MVT*, this repo's book, and for
> everything else in the repo that people read. The book teaches each idea
> once, in the order a reader needs it, in one voice. This guide says what
> that voice sounds like, where each idea lives, and how a chapter is
> shaped, so that a page you add reads like the pages around it.

**Related:** [Code Style](code-style.md) ·
[Project Structure](project-structure.md) ·
[Glossary](../appendices/b-glossary.md)

---

## Who You're Writing For

These rules cover all prose in the repo: the book, READMEs, JSDoc, code
comments, test names and error messages. Write for a reader who knows
TypeScript, but not this repo or the problem's domain.

Three kinds of writing have three kinds of reader:

| Writing | Reader | Contents |
| --- | --- | --- |
| **The book** (`chapters/`, `appendices/`) | Anyone building web games with MVT, using this repo's libraries for the examples | MVT itself, and how the `@mvtjs` libraries do it |
| **Working in This Repo** (`working-in-this-repo/`) | People changing this repo | Its code conventions, its layout, this guide, and links to the READMEs for adding an entry or running the benchmarks |
| **Package docs** (each package's README and `docs/`) | People installing that package from npm | That package alone. They never mention the Arcade, the monorepo or the book's in-house names, so a package can move to a repo of its own |

The agent files (`AGENTS.md`, and the skills in
`packages/sites/docs/ai-agents/`) are a fourth kind. They are short
checklists for AI agents, and they link into the book rather than copy
it. They are not published on the site.

## The Voice

Write like a friendly, experienced colleague showing someone around. The
book's principle chapters, such as
[Single Source of Truth](../chapters/27-single-source-of-truth.md), are
the model to follow. Read one before you write.

- **Talk to the reader as "you".** Say what they'll do and what they'll
  see: "When your project runs, the playground calls your `start`
  function."
- **Use everyday language.** Write it the way you'd say it out loud to a
  colleague. Contractions such as "you'll" and "isn't" are fine, and so is
  a friendly aside.
- **Say why, not only what.** Tell the reader what a thing is for, and how
  it helps them, as well as what it is.
- **Start from something concrete.** Show a small example, often one that
  goes wrong, before you name the idea behind it. The reader then meets
  the idea as the answer to a problem they've just seen.
- **Be honest about drawbacks.** If an approach has one, such as a
  performance cost or extra code to write, say what it is, and when it
  matters. A page that only sells an idea is harder to trust.
- **Follow this voice unless you're told otherwise.** A reference table
  or a one-line JSDoc on a member can stay brief, but its sentences should
  still read naturally.

| Avoid | Prefer |
| --- | --- |
| `start` is given where the views go. | The playground calls your `start` function, and passes it a place to put your views. |
| Barrels: kept for you, imports checked. | The playground writes these barrels for you, and keeps them up to date as you add and change files. |

Some habits are easy to slip into, and each one makes a page harder to
learn from:

- **Fragments and bold noun phrases** standing in for sentences: "Key
  points:", "Benefits:", "**Why this matters:**", "No DOM. No timers."
- **A summary that lists topics** instead of saying something. "Everything
  about time: the contract, the recipes, the pitfalls" doesn't tell the
  reader anything they can use.
- **A terminology box before the first example.** Explain a term where it
  first matters instead.
- **"We", "the developer"** and the third person in general, in place of
  "you".
- **History.** "As earlier versions did" and "used to" date a page, and the
  reader doesn't need them. The git log keeps the history.
- **Marketing.** "Solves", "battle-tested", "zero changes".
- **Em-dashes.** Use a hyphen, or restructure the sentence.

## Sentences

- **Keep sentences short and simple.** Put one idea in each sentence. Say
  only what is relevant at that point.
- **Split long sentences.** A sentence joined by colons, semicolons,
  stacked commas or asides is hard to parse. Two or three short sentences
  are easier to read.
- **Write complete sentences.** Every sentence needs a subject and a verb.
  Avoid fragments, especially at the start of a section or before a colon.
  A short noun phrase is fine in a table cell, or in a one-line JSDoc on a
  member.
- **Use plain words.** Avoid compressed or clever phrasing. Prefer the
  standard technical term to a metaphor.

| Avoid | Prefer |
| --- | --- |
| The Audio80 is a virtual sound chip in the spirit of the 1980s home computers: four voices, two filters and an echo, played from views. | The Audio80 is a virtual sound chip in the spirit of the 1980s home computers. It has four voices, two filters and an echo. |
| Four voices, each playing one note at a time. A voice has: | The chip has four voices. Each voice plays one note at a time. A voice has these parts: |
| It takes the keys while a game runs. | It handles key events while a game runs. |
| `notation/`: the notation, parsed | `notation/`: parses the tracker notation |

## Phrasing

A sentence can follow every rule above and still read badly. Usually it
makes the reader do extra work to find its literal meaning: a word whose
referent is missing, a verb that describes code as if it were a person,
or grammar that is unusual for what it says. The rules below have one
aim. Each sentence should say literally what happens, in the plainest
grammar that can say it.

### Headings stand alone

A reader skimming the sidebar, the table of contents or a search result
sees a heading without the text around it. Make each heading make sense
on its own.

- **Name the subject in the heading.** Don't use a pronoun whose referent
  is outside the heading, such as "it", "this" or "they". "What It Costs"
  doesn't say anything until the reader knows what "it" is.
- **Don't point at the context.** A reader who arrived from a search can't
  tell what "this project", "this chapter" or "here" refers to. Name the
  thing: the library, the chapter, the example.
- **Prefer a noun phrase to a "What" heading.** "What Belongs in a Model"
  is clear, but "A Model's State and Rules" is shorter and starts with its
  subject. A heading that asks a real question ("Why Views Poll") is fine.
- **The closing headings are the exception.** "Common Mistakes",
  "Summary" and "Further Reading" mean the same on every page, and the
  site numbers them under their chapter.

| Avoid | Prefer |
| --- | --- |
| What It Costs | Trade-offs of Bindings |
| In This Project: Updating and Refreshing Views | Updating and Refreshing Views with the `@mvtjs` Libraries |
| When You Need It | When a View Needs Presentation State |
| Rules It Underpins | Rules Built on SSOT |

### Say it literally

- **Use the verbs that describe code.** Code calls, passes, returns,
  reads, writes, stores, checks and requires. It doesn't give, hand,
  promise, ask, want, know, trust, care or agree. Those verbs make code
  sound like a person, and they hide what really happens: a reader can't
  tell whether "the loop gives it the time" means an argument, a return
  value or a field. This includes idioms that are common in software
  writing, such as "knows about" and "is aware of": a model doesn't know
  about views, it doesn't reference them, or doesn't import them.
  People can still want and know things: the player, the reader and you.
  A function still takes parameters, since that's the standard term, but
  it doesn't "take the keys".
- **Say "guarantees" or "requires", not "promises".** Design by Contract's
  words are exact, and a "promise" in a TypeScript book reads as a
  `Promise`.
- **Qualify words with a second meaning.** "Cost", "pay", "spend" and
  "cheap" read as money. Say what is spent: the performance cost, the
  extra code, the memory. Where it isn't a cost at all, say "drawback" or
  "trade-off".
- **Name the concrete thing.** "The same game" is vague. Say what is the
  same: the state, the positions, the score, the results.

| Avoid | Prefer |
| --- | --- |
| a model must give the same game at any step | a model must produce the same results at any step size |
| the time the game loop gives it | the `deltaMs` that the ticker passes to `update` |
| It knows nothing about how it's shown. | It doesn't reference any view. |
| That's part of what `update(deltaMs)` promises. | `update(deltaMs)` guarantees it. |

### Use the plainest grammar

- **Use an ordinary verb, active or passive, for who does what.** The
  possessive form "is the device's to choose" makes the reader turn it
  back into a verb. Write "the device chooses", or "is chosen by the
  device". "The view's job is to show" is an ordinary idiom, and is fine.
- **Put a negative on the verb, not on a noun.** "No game gives", "none
  can get wrong" and "nothing stops a view from" make "no game" and
  "nothing" into the actors of the sentence. Write "games never produce",
  or "a view can still". This goes for a sentence that starts with one,
  too: write "Views never see a world that's half updated", not "No view
  sees a world that's half updated". Where the positive says the same
  thing, it's better still: "every view reads the right value".
- **Keep "that" in a relative clause whose subject is a noun.** "The time
  the ticker passes" puts two noun phrases side by side, and the reader
  first reads them as one. "The time that the ticker passes" doesn't. A
  pronoun subject can drop it: "the time it took".
- **Say it directly, not with a "what" clause.** "What the rule forbids is
  relying on it" and "that's what lets a test refresh" are slower routes
  to the same point. Write "The rule forbids relying on it", and "This is
  why a test can refresh". A "what" in the middle of a sentence is fine:
  "say what the function returns".

| Avoid | Prefer |
| --- | --- |
| the size of each step is the device's to choose | the size of each step depends on the device |
| The big step is one no game gives, and no model promises to handle. | Games never produce a step this big, and models aren't required to handle one. |
| one `phase` and one `progress`, which every view can read and none can get wrong | one `phase` and one `progress`, which every view reads the same way |
| What the rule forbids is relying on it afterwards. | The rule forbids relying on it afterwards. |

## Terms

- **Explain each unfamiliar term where it first appears.** Use a few words,
  or one short sentence. Don't save the explanations for a glossary. In
  the book, also link the term to the
  [glossary](../appendices/b-glossary.md) the first time a page uses it.
- **Don't assume the reader knows the domain.** A reader may not know what
  a note-off, a mix bus or LUFS is. Write "the call that stops a note
  (`noteOff`)", not "the note-off".
- **Keep in-house names out of packages.** A package's docs and comments
  should not use the site's internal names. Say "the game loop" or "a
  game", not "the host" or "an entry".
- **Don't coin new terms.** Use the plain words that the code and docs
  already use. If a new term really is needed, define it where it first
  appears and add it to the glossary.
- **Don't use synonyms for different things,** or different words for the
  same thing. Readers take "newest" and "latest" to mean the same, and
  "baseline" and "reference image" to mean different things. Pick one
  word, and keep to it. The book uses these:

  | Say | Meaning | Not |
  | --- | --- | --- |
  | ticker | MVT's part that keeps time and runs the loop | "game loop" or "frame loop" for MVT's own part. "Game loop" is for games in general, and comparisons |
  | tick | one turn of the ticker: the models, then the views | "every frame" in one sentence and "every tick" in the next |
  | frame | the browser's call to draw a picture, one tick in a running game | "frame" where a test, a pause or fast-forward makes ticks and frames differ |
  | fixed value | a query binding supplied as a plain value, read once | "fixed binding" for a getter that returns a constant |
  | stand-in binding | a getter or function that a test supplies in place of a model's | "mock", "fake", "fixed binding" |
  | open-ended phase | a phase that waits for something, rather than ending after a set time | "a phase that waits" in one chapter and "open-ended" in another, unexplained |
  | reference image | the accepted image that a visual test compares with | "baseline", "snapshot" |
  | a frame at 60 frames a second | about 16.7 ms (16,667 µs) | other roundings |
- **Use presentation-neutral words for MVT's own ideas.** MVT isn't tied
  to a renderer. Say "presentation" and "presentation output" for what a
  view writes, not "pixels" or "the scene graph", unless you mean Pixi's.

## Describing an API

- **Say what a function returns or does,** not who calls it. Write "Plays
  a song on the chip, in place of any song playing or queued, and returns
  its play id", not "Plays a song, for an audio view".
- **Start a factory's JSDoc with "Creates".** For example: "Creates an
  Audio80 that turns each call into a command for the synthesiser."
- **In prose, name a member by its owner,** not by a variable from a code
  sample. Write "`Audio80.play`" or "the chip's `log` property", not
  "`audio80.log`", which reads like a file name to someone who hasn't seen
  the sample. Code samples can use their own variables, since they define
  them.

## Explaining Behaviour

When something is subtle, explain it in order. Describe the situation
first, then what happens, then why. When there are several cases, a short
list with one case per item is easier to follow than one long paragraph.

## Code Samples

- **Keep each line within 80 columns,** so a sample does not wrap on a
  narrow screen. The same goes for text trees, such as a file layout.
- **Import only what the sample uses.** An unused import suggests a step
  that isn't shown.
- **Follow this repo's conventions** in every sample: factory functions
  with an options object, `undefined` rather than `null`, string-literal
  unions, 4-space indentation. A made-up sample can leave out what doesn't
  matter to its point, but it shouldn't break a convention.
- **Don't show what the book warns against,** unless the sample is there to
  show the mistake, and says so. A `refresh()` that builds a template
  string or calls `array.map()` every frame teaches the habit that the
  [Hot Paths](../chapters/24-hot-paths.md) chapter asks you to avoid. If a
  sample needs text that changes, update it only when its value changes.
- **Say which parts are MVT and which are the book's own choices.** MVT
  requires `update(deltaMs)` and a view that doesn't hold domain state.
  Factory functions, GSAP timelines and the `@mvtjs` libraries are the
  book's way of meeting those requirements. When a sample shows one of
  them, say so, briefly.

## The Book's Shape

*Building Web Games with MVT* has a preface, seven parts of numbered chapters,
a conclusion, and appendices.

| Part | Chapters |
| --- | --- |
| Preface | `index.md` |
| I. The Big Picture | 1 Games in the Browser, 2 Why MVT, 3 A First Game |
| II. The Simulation | 4 Models, 5 The Tick, 6 Time and Phases |
| III. The Presentation | 7 Views, 8 Bindings, 9 Noticing Changes, 10 Why Views Poll, 11 Presentation State, 12 Writing Views in JSX, 13 Composing Views, 14 Lists and Switches |
| IV. Testing | 15 Testing Models, 16 Testing Views, 17 Visual Tests |
| V. Advanced Presentation | 18 Growing a Complex View, 19 Lists in Motion, 20 Sound and Music, 21 Reading Layout Back, 22 Reduced Motion |
| VI. Performance | 23 Why Performance Matters, 24 Hot Paths |
| VII. Principles Behind MVT | 25 The Eight Principles, then one chapter for each principle: 26 SoC, 27 SSOT, 28 CQS, 29 DIP, 30 CRP, 31 DbC, 32 MISU, 33 DfT, and 34 Using the Principles |
| Conclusion | `chapters/conclusion.md`, which isn't numbered |
| Appendices | A MVT on One Page, B Glossary, C Measurements, D Measuring Performance, E Timelines with GSAP, F Troubleshooting, G API Cheat Sheets, H MVT Beyond the Web |

The order is set by what each chapter needs. A chapter may use only what
an earlier chapter has taught. If it must mention something taught later,
it says so ("Chapter 20 shows how to test an audio view"), and doesn't
depend on it to make its point.

### File names and numbers

Each chapter's file name starts with its number: `chapters/08-bindings.md`.
A lettered appendix's starts with its letter: `appendices/b-glossary.md`.
The principles are chapters too, such as
`chapters/27-single-source-of-truth.md`. The sidebar, in
`.vitepress/book.ts`, lists them in reading order.

**Don't type section numbers.** Write `## Query Bindings`, not
`## 8.1 Query Bindings`. The site numbers a page's headings from its file
name as it builds: the title becomes "8. Bindings", each `##` heading 8.1,
8.2 and so on, and each `###` heading 8.1.1. Deeper headings aren't
numbered. Appendices number the same way, by their letter (A.1).

Because the numbers aren't in the text, a heading's link anchor doesn't
contain one. A link to `08-bindings.md#query-bindings` keeps working when
a section is added before it, and so does every link into the page.

To insert a chapter, rename the files after it and update `book.ts`. The
redirect map in the same file keeps old addresses working.

### Citing other parts of the book

- **Chapters** by number and name: "Chapter 8, Bindings", or just "Chapter
  8" once the name is clear.
- **Sections** by number, and let the site write the number. A link whose
  text is `§`, such as `[§](08-bindings.md#query-bindings)`, is filled in
  as the page is built with the section's number and heading: "8.2 Query
  Bindings". Without a `#section`, it names the chapter ("Chapter 8") or
  the appendix ("Appendix A"). Don't type a section's
  number yourself: it goes stale when sections move, and `§` doesn't.
- **Principles** by acronym, after the first mention on a page: "Single
  Source of Truth (SSOT)", then "SSOT".
- **Rules** by name, such as V-reactive, linking to
  [Appendix A](../appendices/a-mvt-on-one-page.md).

## One Home for Each Idea

Each idea is taught in full in exactly one chapter, its home. Any other page
that needs the idea says it in a sentence, at most, and links to its home.
A copy is a second answer to the same question, and the two will drift
apart.

Some repetition helps. An overview may preview what's coming, a summary may
recap what a chapter taught, and a glossary entry may define a term and
point to its home. Each says what it is, and keeps it short.

| Idea | Its home |
| --- | --- |
| The browser's building blocks, and what engines, renderers and UI frameworks leave open | Chapter 1 |
| The frame sequence | Chapter 2 (the picture), Chapter 5 (the detail) |
| Two kinds of state | Chapter 2 |
| The `update(deltaMs)` contract, `update(0)`, domain coordinates, model trees | Chapter 4 (a view's `update(0)`: Chapter 11) |
| Actions that say what the player means, not the control, and async work in an action | Chapter 4 |
| State at module level, collections of models, the release delay | Chapter 4 |
| The tick, the delta cap, time control | Chapter 5 |
| Input between ticks, the rule that models never change while views update or refresh, why models delegate but views are walked | Chapter 5 |
| Phases and progress, steps of different sizes | Chapter 6 (a view's own phases: Chapter 11) |
| The `refresh()` contract, immediate-mode data and retained-mode output, walking the view tree (`updateView`, `refreshView`, `SKIP_DESCENDANTS`) | Chapter 7 |
| Query and relay bindings, when a relay binding fires, fixed and changeable values, the access patterns, wiring a view's bindings | Chapter 8 (where a tree's wiring sits: Chapter 13) |
| Reactions, watchers, computed values, counts | Chapter 9 |
| Continuous, discrete and static state, and when change detection is worth using | Chapter 9 |
| Presentation state, the delete-the-view test, why it's private, watching for a change in a view's update step | Chapter 11 |
| JSX, and how declarative it is | Chapter 12 |
| `<List>` and `SlotList` | Chapter 14 (the model's side: Chapter 4) |
| The principles | Chapter 25 (in brief), Chapters 26 to 33 (one each), Chapter 34 (using them) |
| Shared values, and why the JSX runtimes don't have context; why views never forward `update` and `refresh` | Chapter 13 |
| Why views poll, consumer-defined events, the drawbacks of polling and their figures | Chapter 10 (the figures from Appendix C) |
| View models, recognised gestures, the metronome, sequences | Chapter 18 |
| Testing a model, `advanceTime` | Chapter 15 |
| Testing an audio view | Chapter 20 |
| Reference images and reviewing them | Chapter 17 |
| Hot paths | Chapter 24 |
| Performance figures | Appendix C, its short version |
| GSAP timelines in a model | Appendix E |
| The rules, as one table | Appendix A |
| MVT inside an engine, Unity's `Update` and `LateUpdate`, in other languages, and outside games | Appendix H |
| Choosing between two designs that both work, and why a view has two steps | Chapter 34 |
| What MVT gives and doesn't, looking back, and where to go next | Conclusion |

When you add an idea, give it one home, and add it to this table.

**Figures** are a special case. Benchmarks change as the code does, and a
figure copied by hand goes stale without anyone noticing. Quote a measured
figure only from the short version in
[Appendix C](../appendices/c-measurements.md), and link to it. Where a
rough size will do, write that instead: "several times slower".

## A Chapter's Shape

The principles' chapters have a fixed shape, which suits a principle: the
principle, its symptoms, how it applies to MVT, its benefits and
drawbacks, common misreadings, a checklist, the MVT rules built on it,
and further reading. A chapter about doing something follows a looser
version:

```markdown
# Bindings

> Two to five sentences that say something: what the chapter teaches, and
> why it matters to the reader.

**Related:** [A page](link) · [Another page](link)

[A small, concrete start: often an example that goes wrong]

## Query and Relay Bindings

## Writing a View's Bindings

::: info In this book
How the `@mvtjs` libraries do it, where they come in.
:::

## Trade-offs of Bindings

## Common Mistakes

## Summary

## Further Reading
```

Not every chapter needs every section. Give each heading the chapter's
own subject, as above, so that it makes sense on its own. But keep the
order: a concrete start, the idea, how to apply it, its drawbacks, the
mistakes people make, then a summary.

- **The summary at the top** gives a skimming reader the chapter's point.
  Make it say something. A list of topics doesn't count.
- **Don't add Previous and Next lines.** The site writes them at the foot
  of each page, from the sidebar.
- **Related** links go on one line, separated by " · ".
- **Common Mistakes** are the mistakes readers really make. Give each one
  a `###` heading that names it as the reader would notice it ("A view
  that never updates"), then say in plain sentences why it happens and
  what the fix is. Don't use bold labels such as "**Symptom:**" or
  "**Fix:**", and don't use a table, since a table row doesn't have an
  anchor.
  Appendix F links to each heading. A mistake lives in one chapter only:
  the one that teaches the idea it gets wrong.
- **Don't put a rule under the Related line.** The page goes straight on
  to its concrete start.
- **Further Reading** names real sources, with their authors and years.
  Leave the section out when a chapter doesn't draw on any.

### "In this book" asides

The book teaches MVT, and uses the `@mvtjs` libraries for its examples.
Mark what is specific to the libraries, or to the book's own conventions,
with one kind of aside:

```markdown
::: info In this book
`setUpdate` and `setRefresh`, from `@mvtjs/pixi`, set a view's two steps
on its container.
:::
```

Keep the Arcade itself out of the book: how its page runs a game, its
sessions and its entry host, lint rule names, `npm run` commands. That
belongs in Working in This Repo, or in a README. An Arcade game makes a
good example, though. Burrow Bust and the fruit machine teach well, and a
chapter may link to their code.

### "Try it" examples

Online, a chapter can run an example beside the text that explains it. A
printed copy shows the example's still instead, so the text must read just
as well without it running:

- **An example is always an extra.** Never write "as you saw above" about
  an example, and never make it the only place a fact appears.
- **The code that the text explains stays as an ordinary listing,** which
  prints. Place the example after the listing it runs. If the example does
  more than the listing, say so.
- **Write the example for its passage.** It runs the passage's own code,
  with the same names, and shows exactly what the passage explains. A
  sentence before it says what to watch, or what to change and try.
- **Put what's worth changing first.** The constants that a reader would
  try changing, such as a speed or a duration, go in a Tunables section at the
  top of their file, each with a comment saying what it does.
- **Experiments are numbered for you.** Each example is titled with its
  number in the chapter, Experiment 4A, 4B and so on (E1, E2 in an
  appendix), and its name, from its `example.ts`.
- **Name an experiment by its number, never by where it is.** The sentence
  that introduces one, and any other that mentions it, links to it as
  `[§](#try-door-slide)`: `try-` and the example's folder. The link is
  filled in with its number, "Experiment 11A", and to another page's
  experiment it's written `[§](11-presentation-state.md#try-door-slide)`.
  Don't write "below", "here" or "the next example": a printed page may
  place the experiment elsewhere, where it fits.

The book's examples are in the playground's `book/` folder, one folder
each, laid out as the playground's own examples in `examples/` are. Either
kind can run in a chapter:

```markdown
<TryIt example="first-game" file="models/ball-model.ts" />
```

`example` is the example's folder. `file` is the file its editor opens on,
if the reader presses View code; leave it out to open `main.ts`. `height`
(as `:height="360"`) is the height in pixels of the run and its bar of
controls, 420 if you leave it out. The editor opens below the run, and
adds its own height. Until the reader presses Run it here, it shows the
example's still: the reference image of its visual test, in
`packages/sites/playground/src/examples/visual-tests/`, which every
example gets. A book example sets the moment of its still with `stillMs`,
in its `example.ts`.

## Diagrams

Use Mermaid for diagrams, and draw one only when it shows something that
prose can't, such as an order of calls or a tree. Search the book for a
diagram of the same thing before you draw a new one.

## VitePress

- **Don't use `- [ ]` task-list checkboxes.** They render as raw text.
- **Use VitePress containers** (`::: info`, `::: tip`, `::: warning`) for
  asides.
- **Check that Mermaid diagrams render** in the docs build
  (`npm run build -w @mvtjs/docs`), which also fails on a broken link.
- **Check the printed book** when you change how pages look:
  `npm run print -w @mvtjs/docs` typesets the built site as a book, in
  `dist/docs/building-web-games-with-mvt.pdf`. Its styles are its own, in
  `packages/sites/docs/scripts/print-book.css`, not the site's: each part
  and chapter starts on a right-hand page, a link to another chapter shows
  its page number, a link out of the book becomes a footnote, and each
  running example shows its still. `scripts/print-book-breaks.js` decides
  where a page may break: a heading keeps two lines of its section, a
  paragraph never leaves or carries one line alone, a table breaks only
  between rows, and a chapter's last page is never nearly empty. The
  print fails if any text would be lost off a page. Each deploy of the
  site prints the book too, and publishes the PDF beside the docs, so a
  book that no longer prints stops the deploy. Text that is only about
  the site, such as the Preface's link to the PDF, goes in a
  `<div class="online-only">`, which the print leaves out.

## Before You Finish a Page

- Does the summary at the top say something?
- Does the page start from something concrete?
- Does each heading make sense on its own, in the sidebar?
- Does each sentence about code say literally what the code does?
- Does it use anything a later chapter teaches? If so, does it say so, and
  still make sense without it?
- Does it teach anything that has a home elsewhere? Link to the home
  instead.
- Is every new term explained where it first appears, and in the glossary?
- Do the samples follow the conventions, and avoid what the book warns
  against?
- Are any figures quoted from Appendix C?
- Does the docs build pass?
- If the page changes a rule or a convention, have you updated the agent
  files that point to it?

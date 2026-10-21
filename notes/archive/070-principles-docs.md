# Proposal: The Principles Behind MVT

> MVT's rules were derived from a small set of well-known design principles,
> but the docs state only the rules. This proposal adds a Principles group to
> the Architecture section: an overview page and one page per principle, each
> with its origin, what it means in MVT, why it helps, what it costs, examples,
> a checklist and the rules it underpins. The GFS studio guide's "Guiding
> Principles in Depth" page, itself adapted from this repo, is the starting
> point, but only as inspiration: its seven were chosen for publishing reusable
> components to games, and MVT itself needs a slightly different set.

**Status:** done, archived 2026-10-21. Accepted 2026-10-06, with all six
open questions settled (section 12). The overview is reviewed (2026-10-21);
the SoC page is reviewed (2026-10-07), and its voice is the model for the
other seven; SSOT is reviewed (2026-10-07); CQS is reviewed (2026-10-15);
DIP is reviewed (2026-10-19); CRP is reviewed (2026-10-19); DbC, MISU and
DfT are reviewed (2026-10-21). The changes to existing docs are made, and
the pages were checked again against `vnext` (2026-10-21). The code is
brought in line by tasks
[071](../tasks/backlog/071-throw-on-broken-preconditions.md) (the
precondition cleanup),
[072](../tasks/backlog/072-update-and-refresh-method-names.md) and
[073](../tasks/backlog/073-models-take-their-random-source.md).

**Written:** 2026-10-06, against `tick-lite-api` at `1fe594d`, as 043.
Moved onto `main` (2026-10-19) on the `principles-pages` branch, renumbered
068, with its tasks 044, 049 and 050 renumbered 069, 070 and 071, then
renumbered again (2026-10-21) to 070, with tasks 071, 072 and 073, when it
reached `vnext`, where 068 and 069 were taken; its links
now use `main`'s paths. Compared with
`studio-docs` branch `GSE-619-mvt-designing-reusable-components` at `5c55bf5`,
page `docs/studios/game-studio-enablement/model-view-ticker/designing-reusable-components/08-principles-in-depth.md`
(called "the 08 page" below), and with this repo's
[Architecture](../../packages/sites/docs/architecture/index.md) section,
[Rules](../../packages/sites/docs/architecture/rules.md), [Heritage](../../packages/sites/docs/architecture/heritage.md)
and the [code review skill](../../packages/sites/docs/ai-agents/skill-code-review.md#2-software-engineering-principles).
Links in the new docs pages to source files use GitHub URLs on `main`, as
the other docs pages do.

**Related:**
[Architecture Rules](../../packages/sites/docs/architecture/rules.md) -
[Heritage](../../packages/sites/docs/architecture/heritage.md) -
[Why Polling](../../packages/sites/docs/building-with-mvt/reacting-to-changes/why-polling.md) -
[Presentation State](../../packages/sites/docs/building-with-mvt/adding-visual-polish/presentation-state.md) -
[Testing](../../packages/sites/docs/building-with-mvt/iterating-with-confidence/testing.md) -
[Documentation skill](../../packages/sites/docs/ai-agents/skill-documentation.md)

---

## Summary

| # | Decision | Recommendation | Section |
| --- | --- | --- | --- |
| 1 | Are the 08 page's seven "the seven"? | No. There is no canonical list of seven; they are a curated set, as SOLID is a curated five. The number is ours to choose | [2](#2-are-these-the-seven) |
| 2 | Which of the seven pull their weight here | All but one carry real weight. SRP is better framed as part of Separation of Concerns, which the 08 page lacks because its readers already have MVT: as cohesion taken to its limit, in a section on cohesion and coupling | [3](#3-do-the-seven-pull-their-weight-here) |
| 3 | What is missing | Separation of Concerns (SoC), the principle behind the model/view/ticker split itself, and Command-Query Separation (CQS), the principle behind query and relay bindings and the update-then-refresh tick | [4](#4-what-is-missing) |
| 4 | Composition over Inheritance | A well-known principle (Gang of Four, 1994). Its acronym is the Composite Reuse Principle (CRP), named by Knoernschild (2002). Use that, and reframe the page around composing trees, since this repo has no classes to inherit from | [5](#5-composition-over-inheritance) |
| 5 | Testability as TDD | Design for Testability (DfT), an established term, because the 08 page describes properties of the design, not a workflow. TDD appears on the page as the practice that exercises it. **Settled** | [6](#6-testability-tdd-or-dft) |
| 6 | The set | Eight: SoC, SSOT, CQS, DIP, CRP, DbC, MISU, DfT. **Settled** | [7](#7-the-recommended-set) |
| 7 | Where the pages live | `docs/architecture/principles/`, a sidebar group under Architecture, beside Rules and Heritage | [8](#8-placement-and-navigation) |
| 8 | Page shape | One fixed template for every principle page, 150-400 lines | [9](#9-page-template) |
| 9 | Existing docs | Rules gain a "Serves" column linking each rule to its principles; Heritage, the overview, the glossary and the review skill link in rather than repeat | [11](#11-changes-to-existing-docs) |
| 10 | Broken preconditions | Throw. A call that breaks a documented precondition is a bug in the caller; anything else widens the contract for good. Choose preconditions deliberately: where a call has a sensible game meaning, make that meaning the documented behaviour instead. **Settled** | [12](#12-settled-questions) |

---

## 1. Why

The docs say what MVT requires, in [Rules](../../packages/sites/docs/architecture/rules.md),
and which proven patterns it assembles, in
[Heritage](../../packages/sites/docs/architecture/heritage.md). They do not say why the rules
are these rules. Pieces of the reasoning are scattered: "single source of
truth" appears in [models](../../packages/sites/docs/architecture/models.md) and
[view composition](../../packages/sites/docs/building-with-mvt/presenting-the-world/view-composition.md),
determinism in half a dozen pages, and the
[code review skill](../../packages/sites/docs/ai-agents/skill-code-review.md#2-software-engineering-principles)
has its own four principles under different names.

Principles give a reader three things the rules cannot:

- **A way to decide cases no rule covers.** A new kind of view, a new
  renderer, a new library API.
- **A way to tell a rule from a convention.** A rule that serves no principle
  is a convention, and belongs in the style guide.
- **A shared vocabulary for review.** "This view keeps a copy" (SSOT) is a
  shorter, more convincing finding than a paraphrase of V-stateless.

## 2. Are these "the seven"?

No. There is no established list of seven design principles. SOLID is the
nearest thing to a canonical set (five), and only two of the seven (SRP, DIP)
come from it. The 08 page chose its seven for one purpose: a studio
publishing reusable components that games it never sees will consume. That
explains the weight it gives to contract evolution (DbC) and to inheritance,
which GFS developers would otherwise reach for.

So "the seven" is a branding choice, not a fact. It is a fine one if the set
is right, and section 7 shows how to keep the number. But the set should be
chosen for MVT first, and the count accepted second.

## 3. Do the seven pull their weight here?

| Principle (08 page) | Weight in this repo | Where it shows up |
| --- | --- | --- |
| Single Responsibility (SRP) | Real, but at the wrong level to lead with. MVT's defining move is splitting by kind of concern (state, presentation, time), which is SoC; SRP is the same idea at the scale of one model, view or function | Small models and views; the review skill's "orchestrate or detail, not both" |
| Composition over Inheritance | Composition: central. Inheritance: moot, since classes and `this` are banned by lint | M-composition, V-tree, slots, `<List>`, the Composite pattern in Heritage |
| Design by Contract (DbC) | Strong. Bindings are contracts (B-contract), query binding forms state what a view supports, and four `@mvtjs` packages are now published, so contract evolution is a live concern | B-contract, B-optional, V-reactive, Hyrum's Law in the review skill |
| Dependency Inversion (DIP) | Strong. Bindings are DIP: the view declares the interface, the wiring supplies it. Time itself is a dependency injected as `deltaMs` | M-isolation, B-contract, B-wiring, M-time; `random` options in kwazy-cactii and falling-sand |
| Single Source of Truth (SSOT) | The strongest. The case for polling over events rests on it | V-stateless, V-reactive, V-presentation, Why Polling |
| Make Illegal States Unrepresentable (MISU) | Moderate but real. Phase unions with one `progress` are the backbone of the transitions pages | M-domain, phase-based transitions, string-literal unions |
| Testability | Strong. Determinism is the headline benefit of the architecture | M-time, V-idempotent, T-control, the testing pages |

None should be dropped outright. SRP should change role (section 4), and
Composition should change emphasis (section 5).

**Settled: the 08 page's GFS-specific framing does not transfer as is.** Its
contract-evolution advice ("require strictly", "guarantee little") is written
for components shared across studio games. Here it applies to the published
`@mvtjs` packages and to reusable leaf views; for a game's own models it is
good advice, not a requirement. Each page must say which audience a point is
for. Do not reopen without new information.

## 4. What is missing

### 4.1 Recommended additions

**Separation of Concerns (SoC).** Dijkstra, 1974. The principle MVT is built
from: domain state, presentation and time are three concerns, owned by the
model, the view and the ticker. The 08 page has no need of it because its
readers already use MVT; a repo that defines MVT does. SRP becomes part of
this page, as SoC applied at the scale of one component: Martin's "one
actor" maps cleanly onto MVT, since game design changes models, art changes
views, and platform work changes the ticker. On review (2026-10-07) that
section became Cohesion and Coupling (Constantine): SRP is cohesion taken to
its limit, and splitting trades cohesion for coupling, which says when to
stop.

**Command-Query Separation (CQS).** Meyer, 1988, the same author as Design
by Contract. Every operation either answers a question or changes state, not
both. This repo already uses Meyer's word: query bindings answer, relay
bindings report and lead to commands. It explains V-readonly and V-idempotent
directly, and it reframes the tick neatly: `update` is the command phase,
`refresh` is the query phase, and T-sequence keeps them apart, so no view
sees a half-updated world.

### 4.2 Considered and folded into other pages

| Candidate | Decision |
| --- | --- |
| Inversion of Control (IoC), the Hollywood Principle | Fold into DIP: time as an injected dependency. The Hollywood Principle was dropped from the SoC page on review (2026-10-07) |
| Interface Segregation (ISP) | Fold into DIP. The 08 page's "minimal interface that the component defines" is ISP; name it there |
| Law of Demeter (LoD) | Fold into DIP. Bindings stop a view reaching through a model |
| Open/Closed (OCP) | Fold into CRP (extend by composing, not editing) and DbC (evolve without breaking) |
| Liskov Substitution (LSP) | Fold into DbC. Any model or view honouring a contract can replace another; no inheritance means no subtype hierarchy to speak of |
| YAGNI, KISS | Fold into DbC's "guarantee little" |
| DRY | Fold into SSOT, which is DRY for state |
| Hyrum's Law | Section of DbC, as on the 08 page |
| Unidirectional data flow | Falls out of SSOT plus CQS; say so on both pages |
| Determinism | Section of DfT. It has no well-known acronym of its own |
| Hot-path performance | Not a design principle. It stays a set of rules (H-cost and the rest), with its own guide section |

Do not reopen these without new information.

## 5. Composition over Inheritance

It is an established principle: the Gang of Four's "favor object composition
over class inheritance" (_Design Patterns_, 1994, p. 20). Its named,
acronymed form is the **Composite Reuse Principle (CRP)**, from Kirk
Knoernschild, _Java Design_ (2002), and Wikipedia gives "composite reuse" as
its other name. One caveat: Robert Martin's package-cohesion principles also
have a CRP, the Common Reuse Principle. That one is little known outside
package design, so the clash is a footnote, not a blocker.

Recommendation: title the page **Composite Reuse Principle (CRP)**, with
"composition over inheritance" as the first line, and the Martin clash in a
footnote. Lead with composition, which is what MVT does constantly: model
trees, view trees that need not mirror them, child views supplied through
bindings, `<List>` and `<Switch>`. Treat inheritance briefly, as what this
repo rules out (no classes, no `this`) and why: a subclass depends on its
parent's implementation, not just its contract.

## 6. Testability: TDD or DfT?

Test-Driven Development is a workflow: write a failing test, make it pass,
refactor. The 08 page's Testability section describes properties of the
design (determinism, replaceable dependencies, testing through the contract),
and those hold whether tests are written first or last. TDD agrees with every
point on the page, but it is a practice that relies on them, not the
principle itself.

**Design for Testability (DfT)** is the established name for the property.
It comes from electronics, where it is standard, and is in common use for
software. Recommendation: title the page **Design for Testability (DfT)**,
and give TDD a section as the practice that exercises it best. The 08 page's
second litmus test ("can you write the test from the interface and docs
alone?") is test-first thinking already.

Settled: DfT (section 12).

## 7. The recommended set

In reading order. Each builds on the ones before it.

| # | Principle | Origin | In one line, for MVT | Rules it underpins |
| --- | --- | --- | --- | --- |
| 1 | Separation of Concerns (SoC) | Dijkstra, 1974; coupling and cohesion, Yourdon and Constantine, 1979; SRP, Martin, 2002 | Domain state, presentation and time are separate concerns with separate owners; within each, parts are cohesive and loosely coupled | M-isolation, M-domain, V-stateless, V-output, T-minimal |
| 2 | Single Source of Truth (SSOT) | Data modelling; DRY (Hunt and Thomas, 1999) | Each piece of domain state lives in one model; everything else reads or derives it, every frame | V-stateless, V-reactive, V-presentation, M-composition |
| 3 | Command-Query Separation (CQS) | Meyer, 1988 | Reading never changes anything: the tick runs every command (`update`), then every query (`refresh`) | V-readonly, V-idempotent, T-sequence, B-contract |
| 4 | Dependency Inversion Principle (DIP) | Martin, 1996 | A component declares what it needs as a minimal interface, and is given it, time included | M-isolation, M-time, B-contract, B-wiring |
| 5 | Composite Reuse Principle (CRP) | Gang of Four, 1994; Knoernschild, 2002 | Build bigger things by combining smaller ones, never by extending them | M-composition, V-tree, B-reusable |
| 6 | Design by Contract (DbC) | Meyer, 1986 | Every component states what it requires and what it guarantees, fails loudly when either is broken, and evolves only by requiring less or guaranteeing more | B-contract, B-optional, V-reactive |
| 7 | Make Illegal States Unrepresentable (MISU) | Yaron Minsky, 2010 | Design state and types so that illegal states cannot even be written | M-domain |
| 8 | Design for Testability (DfT) | Electronics; software usage from the 1990s | Every component can be tested alone, through its contract, deterministically, with trivial fakes | M-time, M-isolation, V-idempotent, T-control |

Origins and dates are to be checked while drafting (step 2); the attribution
for MISU in particular is commonly given to Minsky's "Effective ML" talk.

**Eight, not seven.** Folding MISU into SSOT was considered, since the 08
page's own MISU example (`openingProgress` and `closingProgress`) is two
fields that can disagree. It was ruled out: MISU's type-level points would
be lost. Settled; do not reopen without new information.

**The shared goal.** The 08 page closes its introduction with one goal that
all the principles serve ("keep the blast radius of every change small").
The overview page has one too: "any part of a game can be understood and
tested alone, and changed or replaced without changing anything else." An
earlier draft added "and every frame shows one consistent world"; that was
dropped as a second goal, and is explained instead as a consequence of the
first, at CQS. Settled.

## 8. Placement and navigation

```
docs/architecture/principles/
├── index.md                              Overview: the goal, the set, how they relate, how to use them
├── separation-of-concerns.md
├── single-source-of-truth.md
├── command-query-separation.md
├── dependency-inversion.md
├── composite-reuse.md
├── design-by-contract.md
├── illegal-states-unrepresentable.md
└── design-for-testability.md
```

The Architecture section is the transferable MVT specification, and the
principles are transferable, so they belong there rather than in Building
with MVT or Reference. A sidebar sub-group, **Principles**, sits between
Rules and Heritage: Rules say what, Principles say why, Heritage says where
the patterns came from.

## 9. Page template

Every principle page follows the docs [page template](../../packages/sites/docs/ai-agents/skill-documentation.md#page-template),
with these sections in this order:

1. **Title** with the acronym: `# Separation of Concerns (SoC)`.
2. **Summary** quote: the principle in MVT, in two or three sentences.
3. **Related**, and **Previous** / **Next** through the set in reading order.
4. **The principle.** The general statement, its origin, and one sentence on
   what it means anywhere.
5. **Symptoms.** What code that ignores the principle looks like, and what
   goes wrong with it: the problem the reader already recognises, so it
   comes before the solution.
6. **Applied to MVT.** Where the principle shows up in the
   architecture, concretely. A page may split this into several sections
   (SoC: the three owners, then cohesion and coupling).
7. **Practical Benefits.** What applying it gives, specific to frame-based
   games.
8. **Practical Costs.** What it costs or forces, and the trade-offs, stated
   honestly (MISU at scale on hot paths, SSOT's per-frame re-reads, CRP's
   forwarding boilerplate).
9. **Common Misreadings.** The boundary cases readers get wrong (SSOT:
   presentation state and change-detection caches are not copies; CQS: a
   relay binding is not a command).
10. **Examples.** Woven through the sections above, examples first. A page
    may end with links to the principle at work in this repo's games and
    demos, if they are not already given.
11. **Checklist.** Questions to ask of a design or a review, as a plain list
    (VitePress renders no checkboxes).
12. **Rules it underpins.** Links to the rules in [Rules](../../packages/sites/docs/architecture/rules.md).
13. **Further reading.** The original sources.

A page-specific heading starts with the template heading, then a colon, then
the page-specific part: `## Applied to MVT: Three Concerns, Three Owners`.
So every section of every page sits under one of the template's headings.

The overview page has a one-line table of the set, a Mermaid diagram of how
the principles build on one another (the rules mapping is a table on each
page, and a column in Rules), a worked example of deciding a case no rule
covers, and a note on why the examples are TypeScript.

**Examples.** The Architecture section uses language-neutral pseudocode.
Principle pages use short TypeScript, and the overview says so up front,
with the reason: most of these principles are about what an interface
states (what it requires, what it returns, which states it allows), and
types are how code states it; pseudocode would have to invent a type
notation. Every principle page uses TypeScript, even where an example gains
little from types, so the pages are consistent. Examples follow the docs'
hot-path and style rules, and link to real code rather than copying it.
Settled.

**Voice.** As the [documentation skill](../../packages/sites/docs/ai-agents/skill-documentation.md)
sets out, for a technical, time-poor reader. On top of that, the pages
mentor: each starts from a point the reader already accepts, adds one step
at a time, and arrives at a conclusion that feels obvious by the time it is
stated. Examples come early, before the abstraction they illustrate.

## 10. Per-page notes

Points each page must make, beyond the template. Examples are candidates, to
be confirmed while drafting.

- **SoC.** Reviewed 2026-10-07. The three concerns and their owners. Cohesion
  and coupling at component scale, with SRP as cohesion taken to its limit
  and Martin's "one actor" reading; Burrow Bust's models as the example (the
  rock has one behaviour, the enemy several that share state). Functions:
  orchestration alone is a job, and steps that can only be understood
  together stay together (Ousterhout), replacing the review skill's
  "orchestrate a flow or perform one step, not both". The Hollywood
  Principle was dropped. Example: the fruit machine, one model with four
  views (Pixi, three.js, HTML, terminal).
- **SSOT.** Reviewed 2026-10-07. "What is not a copy", from the 08 page. Observing the source by
  reading, not by subscription, linking to Why Polling rather than repeating
  it. Unidirectional data flow as the consequence. Example: a view that
  caches a score at construction, and the V-reactive fix.
- **CQS.** Reviewed 2026-10-15. Queries are side-effect free; commands return nothing a caller
  must rely on. The tick as command phase then query phase. Query and relay
  bindings. Where the 08 page lets an action return a `Promise`, square it
  with CQS (it mirrors state and is never the only way to observe it).
- **DIP.** Reviewed 2026-10-19. Importing code is fine; importing state is not (from the 08 page).
  ISP and LoD named here. Time as a dependency: `deltaMs` in, no wall clock.
  Ports and adapters. Examples: `random` options in
  [kwazy-cactii](../../packages/sites/arcade/src/entries/kwazy-cactii/models/board-model.ts) and
  [falling-sand](../../packages/sites/arcade/src/entries/falling-sand/models/grain-grid/grain-grid.ts).
- **CRP.** Model trees, view trees and why they need not mirror each other.
  Slots: a child view supplied through a binding. `<List>` and `<Switch>`.
  Inheritance in one short section (dropped on review, 2026-10-19: it was
  about the repo's conventions, not the principle). Link to the Composite pattern in Heritage
  rather than re-explaining it.
- **DbC.** Requirements, then guarantees, in that order throughout: the
  order they apply in time. The evolution rule, its three
  corollaries, and Hyrum's Law, from the 08 page. Query binding forms (`T`,
  `() => T`, `ValueOrGetter<T>`) as requirement strength. Who the evolution
  advice is for (section 3). LSP and OCP named here. A broken precondition
  throws (section 12, question 5), with the fruit machine's `canSpin` and
  `assert` as the example. Every action with a precondition has a matching
  `can*` query that is exactly its precondition (Meyer's precondition
  availability rule; task 071 states the convention). **Fail loudly on both
  sides:** a part that cannot keep a guarantee throws too, rather than
  returning something that looks like success. Examples in the repo:
  `@mvtjs/pixi`'s texture registry throws when a spritesheet loads but lacks
  the named texture, rather than returning a placeholder; `SlotList.insert`
  throws when full (a requirement, with `isFull` as its query); the fruit
  machine asserts at construction that its first reel strip has no wilds,
  which its win evaluation relies on. From Neon Monsoon's
  [bullet field](../../packages/sites/arcade/src/entries/neon-monsoon/models/bullet-field.ts),
  two more: `fire()` takes positional parameters rather than an options
  object, because it runs thousands of times a second and an object per
  call would be garbage, which trades the "leave evolution paths open"
  corollary for the hot path; and `fire()` returning `false` when the field
  is full is the documented-behaviour case, not a broken precondition, since
  a dense pattern thinning out is the game's rule.
- **MISU.** Phase plus one `progress`. Literal unions over `string`. The hot
  path trade-off: not the 08 page's allocation per change of phase, which
  is too rare to matter, but per-entity state at scale. Neon Monsoon's
  bullet field stores thousands of bullets as indices into typed arrays, so
  a dead bullet's fields stay readable, documented as "only meaningful for
  an index below `count`". Link to Phase-Based Transitions. Named
  with Minsky's original word, "illegal", which is the searchable form;
  "invalid" is a common variant and means the same.
- **DfT.** Determinism and replaceable dependencies. Time control (pause,
  slow motion, single-step) as the same property seen from the ticker.
  Replays and seeded random numbers (neon-monsoon). TDD as the practice. The
  08 page's two litmus tests. Link to the testing pages rather than repeating
  them.

## 11. Changes to existing docs

| File | Change |
| --- | --- |
| [rules.md](../../packages/sites/docs/architecture/rules.md) | Each rules table gains a **Serves** column linking to the principles the rule serves. A rule that serves none is a candidate for the style guide |
| [architecture/index.md](../../packages/sites/docs/architecture/index.md) | A Principles row in Go Deeper; one sentence under The Solution pointing to SoC |
| [heritage.md](../../packages/sites/docs/architecture/heritage.md) | Related link; one sentence: patterns are what MVT assembles, principles are why |
| [config.ts](../../packages/sites/docs/.vitepress/config.ts) | The Principles sidebar sub-group |
| [glossary.md](../../packages/sites/docs/reference/glossary.md) | Contract, guarantee, requirement, and each acronym |
| [architecture-rules.md](../../packages/sites/docs/reference/architecture-rules.md) | Link to the principles |
| [skill-code-review.md](../../packages/sites/docs/ai-agents/skill-code-review.md) | Section 2's four principles link to the matching pages, keeping only their review-specific findings. Its "orchestrates an entire flow, or one step" wording gives way to the SoC page's: orchestration alone is a job, and steps that can only be understood together stay together |
| [ai-agents/index.md](../../packages/sites/docs/ai-agents/index.md), [AGENTS.md](../../AGENTS.md) | One line pointing to the principles |
| [contributing.md](../../packages/sites/docs/contributing.md) | The new diagram in the diagram inventory |
| [llms.txt](../../packages/sites/docs/public/llms.txt) | The new directory |

## 12. Settled questions

All settled 2026-10-06. Do not reopen without new information.

1. **Seven or eight?** Eight.
2. **DfT or TDD?** DfT, with TDD as a section.
3. **The shared goal.** As proposed in section 7.
4. **Example language.** TypeScript on every principle page, with the
   reason stated up front (section 9).
5. **Broken preconditions.** Throw. Any other behaviour accepts an
   implicitly wider contract that can never be narrowed again (Hyrum's Law).
   One refinement, which the DbC page makes: the work is in choosing the
   precondition. A call that has no sensible meaning in some state (`spin()`
   while spinning) gets a precondition, a `can*` query so callers can check
   it, and a throw. A call that does have a game meaning (pressing fire while
   the gun cools down is a real event, and the game's rule is that nothing
   happens) has no precondition: "does nothing while cooling" is documented
   behaviour, a deliberate guarantee rather than an accident. The fruit
   machine already does the first ([`fruit-machine-model.ts`](../../packages/sites/arcade/src/entries/fruit-machine/models/fruit-machine-model.ts),
   `canSpin` and `assert`). Several game models quietly ignore calls
   instead, such as `destabilize()` in
   [`rock-model.ts`](../../packages/sites/arcade/src/entries/burrow-bust/models/rock-model.ts)
   and `startDive()` in
   [`enemy-model.ts`](../../packages/sites/arcade/src/entries/galaxy-raiders/models/enemy-model.ts);
   task [071](../tasks/backlog/071-throw-on-broken-preconditions.md) sorts
   each into one case or the other.
6. **SRP's place.** On the SoC page. Revised on review (2026-10-07): inside
   a Cohesion and Coupling section, as cohesion taken to its limit.
7. **The word for a unit.** Settled 2026-10-19: *component*, meaning any
   separable unit of an MVT program (a model, a view, the ticker), defined
   in the glossary and in the overview's Goal section. Where it could be
   read as a Unity, ECS or JSX component, say *MVT component*, or name the
   kind (*model*, *view*). The overview, SoC and DIP drafts had used *part*;
   they now use *component*. Chosen for being the standard term in the
   sources the pages cite, and matching the game loop page's "Component
   Summary" of model, view and ticker.

## 13. Implementation steps

1. ~~Settle the open questions.~~ Done.
2. ~~Draft the overview page, with the shared goal, the set, the diagram and
   the reading order.~~ Reviewed (2026-10-21).
3. ~~Draft the principle pages in reading order.~~ All eight reviewed
   (2026-10-07 to 2026-10-21), SoC's voice the model for the rest.
4. ~~Make the changes in section 11.~~ Done (2026-10-21). T-cap, which
   no page claimed, serves DbC (added to its table); the hot-path rules
   serve performance, not a principle, and rules.md says so in place of a
   Serves column.
5. ~~Run `npm run lint` and the docs build; check every link resolves.~~
   Done (2026-10-21): both pass, with no dead links.
6. Archive this proposal.

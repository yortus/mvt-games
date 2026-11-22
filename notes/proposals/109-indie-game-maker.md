# Proposal: gamefab, an indie game maker (working title)

> A maker for small 2D web games. You describe, tweak and playtest, and
> agents write, check and grade the code. It works like a software factory
> you sit inside. The spec is the source, and held-out scenarios and a
> ladder of graders decide whether a change is done. You stay the director:
> you approve the spec and the scenarios, play the game, and have the final
> say on feel. Alongside your games, you grow genre cartridges. Each one
> holds the Maker's know-how for a game genre, such as platformers or
> incremental games. Every game you make adds to its cartridges, so the next
> game in the genre starts further on. It isn't an IDE. Most of your time goes on a live preview, a
> few editors (sprites, sound, music, maps, data), the scores and
> playtests. The Maker is a host with its own MCP server and a browser
> window. Your own coding agent (Claude Code, Codex or another) does the
> work, signed in to your own plan. T3 Code is an open source app for
> running coding agents. It's the Maker's first way to start turns and to
> show its window beside the chat, and it can be swapped out. This repo
> already holds most of the
> parts: MVT, whose rules lint and tests enforce, a sound chip, visual
> tests, an in-browser editor and agent skills. Every project is a plain
> folder of TypeScript that you own. Stage 0 is a spike that decides whether
> the rest is worth building.

**Status:** proposed, not yet built.

**Written:** 2026-11-20, on `vnext`, against the playground, `site-kit`,
`audio90` 0.8, `v-snap` and the agent skills as they are today, the Claude
Agent SDK's docs as read that day, and the type definitions of Claude Code's
mod API (build 2.1.322).

**Revised:** 2026-11-21. The agent connection moved from a Claude Code mod to
the Maker's own MCP server, so it works with whichever coding agent you use.
The Maker doesn't publish anything specific to Claude Code. T3 Code is its
first adapter, read from T3 Code's docs and source that day.

**Related:**
[the playground](../../packages/sites/playground/) (CodeMirror, a sandboxed
preview, share links, project export),
[site-kit](../../packages/sites/site-kit/src/) (the entry host, arcade
controls, input, seeded random, pixel art and pixel font scripts),
[audio90](../../packages/libraries/audio90/README.md),
[v-snap](../../packages/libraries/v-snap/README.md),
[the agent skills](../../packages/sites/docs/ai-agents/index.md),
[the eslint plugin](../../packages/internal/eslint-plugin/),
[077](./077-audio90-studio.md) (the Studio, which would become the sound and
music editors),
[083](./083-tock-mvt-for-web-apps.md) (Tock, whose app ticker suits the
Maker's own UI, and whose widget design the Maker window's widgets follow),
[057](../tasks/backlog/057-open-arcade-entries-in-the-playground.md),
[059](../tasks/backlog/059-port-a-project-to-an-arcade-entry.md),
[060](../tasks/backlog/060-architecture-rules-as-live-diagnostics.md) and
[073](../tasks/backlog/073-models-take-their-random-source.md) (each a piece
of this). Outside: [the Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
(its rule on claude.ai login), [T3 Code](https://github.com/pingdotgg/t3code)
(the first agent adapter: its `t3 thread` command, its browser panel and its
agents' preview tools), [StrongDM's software factory](https://factory.strongdm.ai/)
(where scenarios as a holdout set and satisfaction scores come from), and
[The New Stack on factory sensors](https://thenewstack.io/agentic-software-factory-sensor/)
(a factory can be as autonomous as its checks can verify, and no more).

| Decision | Recommendation | Section |
| --- | --- | --- |
| What it is | A maker for small 2D web games: preview, editors, scores and playtests first, code second | 1, 2 |
| Who it's for | Solo and hobby makers, from first-timers to coders who want to move faster. Games the size of this repo's entries | 1 |
| The factory | The spec is the source. Held-out scenarios and a ladder of graders decide when a change is done. Two speeds: **Pair** (change by change, with you) and **Run** (a queue worked through unattended, with you at the gates) | 4 |
| The big idea | **Feedback pinned to a tick.** Models are deterministic, so a playtest note carries an exact replay, and becomes a scenario once fixed | 3.5, 4.2 |
| Trusting the graders | Automate only what a grader can verify. Judge graders calibrated against your verdicts. Every problem the graders miss becomes a new scenario | 4.6 |
| Your agent and plan | **Bring your own coding agent.** The Maker's host serves an MCP server that any agent with MCP support can use, and skills in the folders agents already read. Your agent runs on your own sign-in, so it uses your plan, and the Maker never calls a model or handles your credentials | 6 |
| Starting turns | **Through an adapter you can replace.** T3 Code first: the host sends playtest notes and Run mode's queue with `t3 thread send`, and starts helper agents in threads of their own. Without an adapter, the agent picks notes up with a tool call | 6.2 |
| The window | The control room (scores, coverage, the work queue, gates), the preview, playtests and editors, in one browser window served by the host. In T3 Code's desktop app it opens in the thread's browser panel, beside the chat | 3.2, 6.3 |
| A VS Code fork? | **No.** The agent lives where you already run it (T3 Code, a terminal, VS Code), with the Maker's window beside it | 7 |
| Where truth lives | In the project's files, in formats we document. Held-out scenarios live beside the project, outside the agent's reach | 3.1, 4.2 |
| Placeholder art and sound | Made by code (pixel-art generators, `audio90` presets), so it is original by construction | 3.6 |
| Genre cartridges | **Half the work.** A cartridge holds the Maker's know-how for one game genre (incremental, scrolling platformer, first-person shooter): skills, components, a starter, a spec template, scenarios, graders, bots and briefs. You grow it alongside your game, from empty if need be. A curator proposes what to lift from the game into it. Every game becomes one of its briefs, so the next game starts further on and can't undo what the last one taught. A game can use and grow several cartridges at once | 5 |
| Ready-made UI | Two kits. A **game UI kit** for players (title, pause, settings, highscores, touch controls), in the game kit. **Window widgets** for the Maker window, shared with the Studio, and made a package once a third app uses them. Both work without Tock | 3.10 |
| Prerequisite | A publishable game kit (the entry host, controls, input, random, overlay) and lint plugin, taken out of `site-kit` and `internal/` | 8 |
| Out of scope at first | 3D genres (the cartridge format leaves room for them), online multiplayer, app stores, team editing, large content-driven games | 1, 5 |
| Go or no-go | Stage 0 measures whether a non-coder gets passing changes, whether the graders agree with people, whether a second game in the genre comes quicker from the first one's cartridge, whether a day's work fits a plan, and whether a second agent can do the same work | 10 |

---

## 1. What it is, and who it's for

You make a game by talking about it, tweaking it and playing it:

- **Describe it.** Pick the cartridges for your game's genres ("a
  scrolling platformer with an upgrade shop"), or start an empty one if
  the genre doesn't have one yet. Then write a short spec in plain words. The agents
  turn the spec into a running game, with placeholder art and sound, and a
  set of scenarios for you to approve.
- **Tweak it.** Drag sliders for the tunables (speed, gravity, spawn rate),
  paint sprites, lay out maps, shape sounds, and see each change in the
  running game at once.
- **Play it and say what's wrong.** Press a key while playing to leave a note
  ("this jump feels floaty"). The note becomes a work item, with the exact
  moment attached.
- **Watch the scores.** Each requirement in the spec shows whether it passes,
  which graders check it, and how that changed.
- **Look under the hood when you want.** The tech view shows the code, frame
  timings and the model's state. The code is ordinary TypeScript in the MVT
  shape this repo's book teaches.
- **Grow the genre.** What the agents learn making your game can be lifted
  into its cartridges: a component, a skill, a scenario, a bot. Your next
  game in that genre starts from all of it.
- **Ship it.** Build a web game, publish it to itch.io or a static host, and
  share a link.

What it does for you: the architecture, the engine (Pixi, `audio90`), the
coding, the checking and grading, placeholder art and sound, research and
advice, file organisation, building and running, packaging and publishing.

It's for one person, or a couple of friends, making small 2D games: arcade
games, puzzles, toys, game jam entries. Those are the games this repo
already makes well, so the Maker can be good at them early. 3D, networking
and large content pipelines come later, if ever.

## 2. Why this could work now

Plenty of tools let you make games without code (GDevelop, Construct), and
plenty of AI tools write apps from a prompt. The Maker's edge is the middle:
real code, written by agents, held to a standard machines can check.

- **MVT keeps AI edits safe.** Models hold all state and advance only through
  `update(deltaMs)`, views only draw, and lint enforces the rules. An agent
  that breaks a rule finds out at once. This repo is the evidence: most of
  its entries were written with an agent following the skills files.
- **MVT makes games gradable.** Models run without a screen, with time only
  from `deltaMs` and seeded random numbers. So a scenario can play a game
  headless, thousands of times, and check its state exactly. Most game
  engines can't do that, which is why factories for games are rare.
- **The parts exist.** An in-browser editor and sandbox (the playground), a
  sound chip with a tracker, visual snapshot tests, an entry host with touch
  and keyboard controls, pixel-art and font generators, and agent skills.
- **Every game makes the next one easier.** With most tools, what you
  learned on your last game stays in your head. The Maker keeps it in
  cartridges, checked by the same graders as the games. So the know-how
  grows from game to game instead of starting over.
- **You own the result.** A project is a folder. If the Maker disappears,
  the game still builds with `npm run build`.

## 3. How it works

### 3.1 Files are the truth

The project is a git repo with a documented layout: `spec.md`, `data/`,
`models/`, `views/`, `assets/` and `tests/`, and a `package.json` that
depends on the published `@mvtjs` libraries and the game kit. Every editor
works on files in formats we document:

| Editor | File |
| --- | --- |
| Sprites | PNG plus a small JSON of frames and animations, or a generator script for procedural art |
| Maps | JSON tile layers and object lists, with import from Tiled |
| Sounds and music | `audio90` modules: patches as data, songs in its tracker notation |
| Data and tunables | TypeScript constants declared with ranges (`defineTunables`), so the panel can draw a slider for each |
| Spec | Markdown with numbered requirements and targets, edited by you and the agents together |

Plain, documented formats mean the agents can change them as easily as
code, and you can use outside tools (Aseprite, Tiled) and bring the results
back. The held-out scenarios are the one exception: they live in a folder
beside the project (section 4.2).

### 3.2 The app

Three parts of the Maker's own, and an agent of yours. The Maker's parts
are built with MVT where they have a UI:

- **The Maker host** (Node), which you start with one command in the
  project folder. It runs the Vite dev server, the checks and the graders.
  It stores git checkpoints and the scenarios, and serves the window and
  the MCP server.
- **The Maker's MCP server.** MCP (the Model Context Protocol) is the
  standard way to give a coding agent extra tools, and every major coding
  agent supports it. The server holds the tools listed in section 3.3. It
  carries out each call in the host.
- **The Maker window**, in a browser. It shows the control room, with the
  scores per requirement, the coverage map, the work queue, and gates with
  Accept and Reject buttons. It also shows the preview, the playtests, the editors,
  the timeline and the tech view. The preview runs the game in a sandboxed
  frame with hot reload, as the playground's does.
- **Your coding agent**, such as Claude Code, Codex or OpenCode, signed in
  to your own plan. You chat with it wherever you already run it. The best
  fit is T3 Code's desktop app, where the Maker window opens in the
  thread's browser panel beside the chat (section 6.3).

The host starts turns through an **agent adapter**: it sends a playtest
note, or the next item in Run mode's queue, to your agent as a message. T3
Code is the first adapter, and section 6 says why it's one you can swap.

### 3.3 The agents

The agents run in your own coding agent, which brings file tools, a shell
and permissions. The Maker adds:

- **Skills and guidance**, in the project template: an `AGENTS.md` and
  skills folders, which Claude Code, Codex, OpenCode and Cursor all read.
  They hold this repo's MVT skills, generalised for any project, plus the
  skills of every cartridge the game uses.
- **Tools**, from the Maker's MCP server: run the checks and graders; take a
  screenshot of the preview; read the model's state at a tick; play a replay
  to a tick; run headless simulations; make a placeholder sprite or sound;
  edit a map through structured operations; take the next work item.
- **Agents with separate jobs** (builder, scenario writer, curator,
  reviewer, judge), so the one that writes the code never writes the
  scenarios or judges its own work (section 4.4). Each job runs in its own
  thread, started by the agent adapter with that job's brief, so each one's
  context stays apart from the others.
- **Permissions**, set in the agent's own settings by the project template:
  writes only inside the project folder and the cartridges you're
  developing with it, and shell commands only from an allowlist (the
  project's npm scripts, git). How strictly each agent applies them varies,
  so the factory doesn't rely on them alone (section 4.2).

### 3.4 Checkpoints and undo

Each agent turn is a git commit on a working branch. The UI shows them as a
timeline you can scrub back through, and undo is a checkout. Your own edits
in the editors are checkpointed the same way.

### 3.5 Playtesting with feedback pinned to a tick

While you play, the preview records the seed and the input at every tick.
Leave a note (a key, a button, or speech later) and the Maker pauses and
captures the tick number, a screenshot, the model's state and the last few
seconds of input. The note joins the work queue. In Pair mode, the agent
adapter sends it to your agent as its next turn, so you can keep playing
while the agent works on it. The builder can replay to
that tick, inspect the state, make the fix and replay again to check it.
Once you agree it's fixed, the replay becomes a scenario (section 4.2), so
the problem can't quietly come back.

### 3.6 Placeholder art and sound

Placeholders are made by code, never fetched: pixel-art generators (as the
sites' `generate-*-textures.ts` scripts do today), the pixel font, `audio90`
sound presets with randomise and mutate (077 stage 1), and short songs from
genre templates. They are original by construction, which matters because
the Maker should never help copy someone else's game. Image and audio
models can come later as an option, with their licensing made clear.

### 3.7 Genre cartridges

A cartridge holds the Maker's know-how for one game genre. Every game
uses one or more, and you grow them while you make the game. That's about
half the work of using the Maker, so cartridges have a section of their own
(section 5).

### 3.8 Research and advice

The agents can search the web, so they can answer "how do games like this
usually handle difficulty?", suggest ideas, and check names. An originality
check (title search, trademark search, the checks this repo already does by
hand for its entries) runs before publishing.

### 3.9 Publishing

`vite build` makes a static web game. The Maker publishes it to itch.io
(through their `butler` tool) or to a static host such as Cloudflare Pages,
as a page that installs offline (a PWA). An optional highscore service
reuses this repo's Worker. Desktop builds and stores come later.

### 3.10 Ready-made UI: a game UI kit and window widgets

Two kinds of UI repeat, and each gets its own kit:

- **A game UI kit, for players** (Pixi). Every game needs a title screen, a
  pause menu, settings with volume and controls, a How to play card,
  initials entry, a highscore table and touch controls. Without ready-made
  pieces, the agents would rewrite these for every game, a little
  differently each time, and the graders would check each one from scratch.
  With a kit, they come out consistent, tested, accessible and themed.
  They're cheap to grade too, since a scenario reaches "settings, volume
  down" by the same route in every game. `site-kit` already has the start of
  it in the overlay, pixel text, the initials view model, the How to play
  card and walkthrough, and the touch controls. So it joins the game kit
  (section 8).
  Cartridges add their genre's extras, such as a calendar of daily levels or
  a level select.
- **Window widgets, for the Maker window** (DOM). The editors and panels
  need sliders and number fields for the tunables, selects, tabs, split
  panes, trees and lists you select from, toolbars, menus, dialogs, tooltips
  and a colour picker. The playground and the arcade page already build
  their own dialogs, menus, dividers, lists and search, each with its own
  ARIA roles. The Studio (077) and the Maker would make three and four.
  Each widget follows 083's design. A small model holds its interaction
  state, such as which item is highlighted. An unstyled, accessible view on
  `@mvtjs/html` draws it, styled through CSS custom properties as the sites'
  themes are. Widget models are
  ordinary MVT models, so they don't need Tock's ticker. The widgets start
  as a private folder shared by the Studio and the Maker window, begun by
  pulling together the views the playground and arcade page duplicate. They
  become a package (`@mvtjs/widgets`) once a third app uses them.

Widgets that belong to one editor (a pixel canvas, a tile palette, a piano
keyboard, a tracker's pattern grid, a timeline scrubber) live with that
editor. The control room is part of the Maker window, so it uses the window
widgets too.

## 4. The factory: specs, scenarios and graders

A software factory turns specs into software with agents, and decides
what's done by grading rather than by someone reading every line. The
Maker borrows its key parts and keeps you in the loop where taste matters.

### 4.1 The spec is the source

`spec.md` holds numbered requirements in plain words ("R4: the player can
jump over a two-tile gap"), and targets where a number fits ("level 1: most
first-time players finish it within three tries"). Every work item, scenario
and score points back to a requirement. When you want something different,
you change the spec, and the factory works out what has to change.

### 4.2 Scenarios, held out

A scenario plays the game headless and checks the model's state: a scripted
input sequence, or a bot with a simple policy, run over many seeds. A
**scenario writer** drafts scenarios from the spec, in its own context, and
you approve them. They are the contract.

The builder never sees them. They live in the host's own folder, outside
the project, and only the host's grading tool runs them. When one fails,
the builder gets the requirement, what went wrong, the tick and the replay,
but not the script. That stops the builder writing code that passes the
test rather than doing what you meant.

Keeping them out of the project folder matters more than any rule in the
agent. Agents differ in how well they keep to a folder, so the Maker
doesn't count on a rule to keep the builder out of the scenarios. Instead,
the builder works in the project folder, the scenarios aren't there, and
the builder never receives their location. The project template
also denies that folder in each agent's settings, where the agent supports
it. The builder still writes its own unit tests, in the project,
as usual.

A requirement's **satisfaction** is the share of its scenario runs that
pass, across seeds and bots. It's the main score the UI shows.

### 4.3 The ladder of graders

Graders run cheapest first, and a change climbs only as far as it passes:

| # | Grader | What it checks | How |
| --- | --- | --- | --- |
| 1 | Checks | Types, the MVT rules, unit tests | `tsc`, lint, Vitest. Seconds |
| 2 | Scenarios | The spec's behaviour | Held-out scenarios on headless models. Seconds |
| 3 | Simulations | Difficulty and pacing | Bots of a few skill levels play many runs. Win rates, session lengths and idle time, against the spec's targets |
| 4 | Budgets | Speed and polish | Frame time, allocations per tick, bundle size, load time, sound loudness (LUFS), in a headless browser |
| 5 | Look | What the screen shows | `v-snap` images for regressions, and a vision model scoring screenshots against a rubric: legibility, contrast, consistent style, text that fits |
| 6 | Review | The code and the spec | A reviewer agent with the MVT code-review skill, and a judge scoring the build against each requirement |
| 7 | People | Feel and fun | Your playtests, and friends' through a shared link |

Every grader returns a score and evidence (a replay, a screenshot, a
measurement), so a failure is something you can look at, not just a red
mark.

### 4.4 The loop

1. A work item comes from the spec, a playtest note or a failed score.
2. The builder works on it on its own branch. For hard items, two or three
   attempts run side by side in git worktrees, and the best-scoring one
   wins.
3. The graders run. Failures, with their evidence, go back to the builder.
4. Steps 2 and 3 repeat until the item passes or its budget runs out.
5. At a gate, you get a playable build, the change in scores, replays of
   anything still failing and a plain summary of the change. Accept, and it
   merges.
6. The curator looks at what the change taught, and proposes anything worth
   lifting into a cartridge, for a cartridge gate (section 5.2).

The builder can't change the scenarios, the graders or the targets. A
change to any of those goes through you.

### 4.5 Two speeds: Pair and Run

The same machinery runs at two speeds, and you switch between them freely:

- **Pair:** you and the agent, change by change, in conversation. The first
  two graders run after every turn, and the rest in the background, so the
  scores stay current while you work.
- **Run:** you queue work items, and the factory works through them
  unattended (overnight, say) within a budget. The agent adapter sends each
  item as the last one finishes. You review at the gates in the morning, in
  the window. T3 Code's phone app streams the thread's browser tabs, so a
  gate can be approved from a phone. The stream doesn't carry sound, so
  playtests stay on a computer.

This is what makes it collaborative rather than a dark factory, where
people never look: you choose how much to hand over, item by item.

### 4.6 Trusting the graders

A factory can be as autonomous as its graders can verify, and no more. So:

- **A coverage map** shows which graders check each requirement. A
  requirement that only people can judge ("the jump feels good") is marked
  so, and counts as done only after a playtest.
- **Judges are calibrated.** The vision and review judges (graders 5 and 6)
  score a small set of builds you've also judged. The UI shows how often
  they agree with you, and until they agree well enough, their scores
  advise rather than decide.
- **Escapes are counted.** A problem you find in a playtest that every
  grader passed is an escape. Each escape becomes a new scenario or a new
  line in a rubric, and the escape rate is the factory's own score.

### 4.7 Grading the Maker itself

The Maker gets the same treatment. A suite of game briefs, each with
held-out scenarios and targets, runs against every version of the Maker:
its skills, its cartridges, its prompts, the models it uses. The suite
tracks satisfaction, cost and time per brief, so a change to a skill that
makes shooters worse shows up before anyone ships it. Each cartridge brings
briefs of its own, and gains one from every game made with it (section
5.3). Failures by genre say where a cartridge's skills need work. Stage 0
writes the first five briefs.

## 5. Genre cartridges: the other half of the work

A genre here means a game genre: an incremental game, a scrolling
platformer, a first-person shooter, a match-three, a tower defence, a
roguelike, a daily logic puzzle. A cartridge holds the Maker's know-how
for one genre. It's what makes your second platformer quicker and better
than your first.

Growing cartridges is about half the work of using the Maker, alongside the
games themselves, and the Maker treats both as projects you develop. A
cartridge is about the genre, not the renderer. Its views use whatever the
genre needs: Pixi for most 2D genres, and three.js for a first-person
shooter once the game kit supports it.

### 5.1 What a cartridge holds

- **Skills** that teach the agents the genre: what a good daily puzzle
  needs, how a shooter's waves are usually tuned, why platformers give a few
  frames of grace after you run off a ledge.
- **Components**: models and views ready to use, such as a grid with undo,
  a calendar of daily levels, a bullet pool, a scrolling camera.
- **A starter**: models and views that put a playable skeleton of the genre
  on screen, written to combine with other cartridges' starters (section
  5.4).
- **A spec template and docs**, so you know what to decide.
- **Scenarios, graders and bots for the genre**, such as "every level is
  solvable without guessing" for a puzzle, or bots that play a shooter at a
  few skill levels.
- **Generators** for the genre's placeholder art and sound.
- **Briefs**: games with held-out scenarios, for grading the cartridge
  itself (section 4.7).
- **Where each piece came from**: the games it was learned in, and the games
  that use it.

A cartridge is a folder with its own git history. While you develop it,
it's linked into each game that uses it, so a change shows up in the
game at once. You publish it as an npm package when you want to share it.

### 5.2 Building a game and its cartridge together

Most of the time, the genre you want doesn't have a cartridge yet, or has
only a thin one. So you start both together. A new game in a genre without a cartridge
gets an empty one beside it, linked in. From then on, every work item has a
second question: does what we just learned belong to this game, or to the
genre?

- **A curator** agent asks that question after each accepted change. It
  proposes lifts: a component made general, a line for a skill, an entry
  for the spec template, a scenario rewritten to fit any game in the genre,
  a bot.
- **You approve lifts at a cartridge gate**, as you approve changes at a
  game gate. A lift leaves the game's own names behind. The game then uses
  the cartridge's version, so there's only one copy.
- **The queue holds both kinds of work**, each item marked with its project.
  The scores show the game's satisfaction and each cartridge's side by side.

Feedback runs both ways. A playtest note on the game can lead to a fix in
the cartridge, which every game in the genre then gets. An escape in one
game becomes a scenario for the whole genre.

### 5.3 Every game makes the next one better

When a game made with a cartridge is far enough along, it becomes one of
that cartridge's briefs: its spec and its held-out scenarios, kept as a
benchmark (section 4.7). So:

- **Game 2 starts from everything game 1 taught**: the components, the
  skills, the spec template, the scenarios and the bots.
- **A change made to the cartridge for game 2 is graded against game 1's
  brief too.** Improving the cartridge for one game can't quietly break what
  it learned from another.
- **Games pin a cartridge version.** Moving a game to a newer version runs
  the game's own scenarios first, so you see what changes before you
  accept.

The risk is a cartridge fitted to its first game, with game 1's quirks
taken for the genre's rules. So each piece records the games it came from
and the games that use it. The curator marks a piece as tentative until a
second game uses it. Briefs from several games, and research into how
other games in the genre work (section 3.8), keep the cartridge honest.

### 5.4 Several cartridges at once

Games often mix genres: a roguelike deckbuilder, a platformer with
metroidvania exploration, an incremental game with puzzles. So a game can
use several cartridges, and you can develop all of them while you make it.

- **Skills from each load together**, named by cartridge. Where two
  disagree, the project's own notes decide first, then the order you've
  listed the cartridges in.
- **Components stay in their own packages**, so names can't clash. The
  top-level `GameModel` and `GameView` combine each cartridge's starter,
  and the starters are written to be combined.
- **Scenarios, graders and briefs from every cartridge run.**
- **The curator asks where each lesson belongs**: in one of the cartridges,
  in a new one, or only in the game.

Some cartridges will be narrower than a genre: daily levels, procedural
level generation, a shop with upgrades. They work the same way, and mix
with genre cartridges as genres mix with each other.

### 5.5 Where cartridges come from

The Maker ships a few seed cartridges, each grown from games this repo
already has: daily logic puzzles (from the puzzles site), maze chases and
vertical shooters. They're genres, picked because the repo has working
games in them. We grow them with the Maker itself, by remaking the repo's
games in it. That tests the loop in section 5.2 on games whose quality we
already know.

After that, most cartridges are yours, grown game by game. Sharing them
with other people, and using theirs, comes later.

## 6. Connecting your agent

You want to use your own plan (Claude Pro or Max, or ChatGPT's), not pay API
prices. You also want to keep the agent you already use, set up the way you
like it. So the Maker doesn't contain an agent. It works with yours, through
three pieces it owns:

- **The MCP server**, for the tools (section 6.1).
- **Skills and `AGENTS.md`**, for the guidance (section 3.3).
- **Agent adapters**, for starting turns (section 6.2).

Everything specific to one agent or one app sits in an adapter. The host,
its tools, the graders and the window stay the same whichever agent you use.

### 6.1 The MCP server

The host serves the Maker's tools over MCP, so any agent with MCP support
can call them. That covers Claude Code, Codex, OpenCode, Cursor and the
agents T3 Code runs. The tools are the ones in section 3.3: grading,
replaying to a tick, reading the model's state, screenshots, simulations,
placeholders, map edits and the work queue.

The project template adds the server to each supported agent's settings,
so a new project is ready for whichever agent you open it in. The same
tools are available as a command (`maker grade`, `maker replay`), for
scripts and for agents without MCP support.

### 6.2 Agent adapters

An adapter does the jobs a tool call can't, because a tool call only
happens when the agent decides to make one:

- **Send a turn**: pass a playtest note, a failed score or the next queued
  item to the agent as a message.
- **Start a helper**: open a new thread for the scenario writer, the
  curator, a reviewer or a judge, with that job's brief.
- **Report back**: tell the host when a turn ends, and whether it ended
  well, failed, or is waiting for your answer.

The adapters, in the order we'd build them:

| Adapter | How it works | What it's for |
| --- | --- | --- |
| T3 Code | The host runs T3 Code's command: `t3 thread start` for a helper, and `t3 thread send <id> "..." --wait` for a turn. A busy thread gets the message as its next turn. The exit code says whether the turn failed (1) or is waiting for your answer (2). The command works on your own computer without signing in | **The first adapter.** One adapter covers every agent T3 Code runs, and its browser panel can show the Maker window (section 6.3) |
| None | The host keeps the queue, and the agent takes the next item with a tool call whenever it looks. You start each turn yourself, with "carry on" | The fallback. It works with any agent that has MCP support, in any terminal, but it can't start a turn by itself |
| ACP | ACP (the Agent Client Protocol) is the standard way for an app to drive a coding agent. Claude Code, Codex and others have ACP versions. The host would drive the agent directly | Later, if we want to start turns without T3 Code |
| A Claude Code mod | A thin mod that sends turns with `$.prompt.submit` and shows the control room in a pane beside the chat | Later, perhaps, for people who live in Claude Code's terminal |

The Maker never calls a model itself. Every turn runs in your agent, on
your agent's own sign-in, so the Maker never handles your credentials.
That also keeps it clear of the Agent SDK's rule: an app that embeds the
SDK can't offer claude.ai sign-in without Anthropic's approval. Before giving the Maker to other people, check the terms of each plan for
being driven by another app. T3 Code documents that it drives agents with
your own sign-in, and it's widely used that way.

### 6.3 What T3 Code adds, and its limits

T3 Code is an open source (MIT) app, from Ping, for running the coding
agents you already have installed and signed in to. It has a desktop app, a
web app and a phone app, with threads, a diff view, a terminal and a
browser panel. It runs each agent with that agent's own settings, so your
MCP servers, skills and plugins carry over.

What it adds to the Maker:

- **The Maker window beside the chat.** The desktop app's browser panel is a
  real Chromium page (an Electron webview), so the preview plays with
  keyboard, mouse, WebGL and sound. It lists the ports that your terminals
  and agents opened, so the host's page is a click away. The agent can also
  open it with T3 Code's `preview_open` tool.
- **Agents that can use the live preview.** T3 Code gives agents browser
  tools of their own: snapshots, clicks and key presses, running
  JavaScript in the page, and recording. The graders still use the
  headless runner, since only that replays exactly, but a recording is a
  useful extra for a playtest note.
- **Gates from a phone.** The web and phone apps stream the browser tabs
  from your computer, so you can read the scores and approve a gate.

Its limits:

- **You can't add your own UI to T3 Code.** It doesn't have a plugin, panel
  or view API, so the Maker window is a page in its browser panel, not a
  part of T3 Code. A page there can't start a turn by itself. That's fine,
  because the page sends a note to the host, and the host sends the turn.
- **Streamed tabs are for looking, not playing.** On the web and phone apps,
  sound stays on the computer, and you take control of a tab before you
  type.
- **It's young.** It made nightly releases in July 2026, at version 0.0.28,
  and has many open issues. Its internal protocol isn't public, so the
  adapter uses only the documented `t3 thread` command.

That's why it's an adapter rather than the platform. If T3 Code changes
direction or stops, the Maker loses its smoothest setup, and the fallback
and ACP adapters still work.

### 6.4 What this costs, compared with a mod

- **The chat lives in your agent's app**, with the Maker window beside it in
  T3 Code's panel, or in a browser window next to the terminal.
- **Guidance reaches the agent only through skills and `AGENTS.md`.** A mod
  could also add to the system prompt and react to every tool call. Most
  agents load skills well, but each one loads them a little differently.
- **Results vary by agent.** So the Maker's suite of briefs (section 4.7)
  records which agent and model ran each one, and stage 0 tries two agents.
- **Run mode works within your plan's limits.** A long run stops cleanly
  when the agent reports a limit, and picks up later.

## 7. Why not a VS Code fork

A fork gets an editor, extensions and a terminal for free, but:

- **It pulls the product towards an IDE.** The Maker's main screen is a game,
  its scores and some editors. A fork's main screen is a file tree and a
  text buffer, and fighting that costs more than it saves.
- **Upkeep is heavy.** VS Code releases monthly, and every release must be
  merged into the fork.
- **Extensions are awkward.** Microsoft's marketplace terms don't cover
  forks, so a fork uses Open VSX, which lacks some extensions people expect.

Section 6 settles it anyway. Your agent runs where you already run it: in
T3 Code, a terminal or VS Code. The Maker is a browser window beside it, or
inside T3 Code's browser panel, with CodeMirror (as the playground
uses) for a quick look at code, and "Open in VS Code" for anyone who wants
the full IDE. Electron can wrap the window later, if a desktop app earns its
keep.

## 8. Requirements and dependencies

**To build before the Maker itself:**

- **A publishable game kit.** Games depend on `site-kit` today, which is
  private and tied to the sites: the entry host, arcade controls, input,
  seeded random, the overlay, pixel text and chip types. These move into a
  published package that a standalone project can use, with the game UI kit
  (section 3.10).
- **The lint plugin, published**, so a project outside this repo gets the
  MVT rules (`no-wall-clock`, `no-module-state`, `no-deep-imports` and the
  rest).
- **Models take their random source** (073), so every game replays exactly.
- **A headless runner** that plays a game's models from a seed and an input
  script or bot, for scenarios and simulations.
- **A standalone project template**, checked by building and testing a copy
  outside the workspace, as `audio90` and `v-snap` already are.
- **A cartridge format**: a package layout for skills, components,
  starters, spec templates, scenarios, graders, bots, briefs and where each
  piece came from. Games link to cartridges while you develop both, pin a
  version otherwise, and combine several (section 5).

**Runtime dependencies:** Node, a coding agent with MCP support (signed in
to the user's plan), Vite, Vitest, TypeScript, ESLint, Pixi.js 8, `audio90`,
`v-snap` (and its headless browser), git. T3 Code is optional, and
recommended.

**Integrations:** MCP, for the tools. T3 Code's `t3 thread` command and
browser panel, for the first agent adapter. ACP, and perhaps a Claude Code
mod, for later adapters. Each agent's settings and skills folders, which
the project template fills in. Also itch.io `butler`, Cloudflare Pages,
Tiled and Aseprite import, and VS Code ("Open in").

**Qualities:**

- Local-first: everything but the agents works offline.
- Every change undoable, every agent turn visible.
- The builder walled off from the scenarios, graders and targets.
- The agents confined to the project folder and an allowlist of commands.
- A project that builds without the Maker.

## 9. Risks

| Risk | What we'd do |
| --- | --- |
| Scope: it is several products in one | Stages that each ship something useful (section 10); the editors start small and import from outside tools rather than compete with them |
| Graders that pass bad games | Holdout scenarios, calibrated judges, the escape rate, and people as the last grader for feel (section 4.6) |
| Builders that game the graders | The scenarios live outside the project and the builder never receives their location, the agent's settings deny their folder where it can, and the builder can't edit graders and targets. Scenario failures report what went wrong, not the script (section 4.2) |
| Plan limits slow Run mode down | Cheaper models for reading, graders that run without the model wherever possible, runs that stop and resume cleanly |
| T3 Code changes direction, breaks the `t3 thread` command, or stops | It's one adapter. The host uses only its documented command, and the fallback and ACP adapters keep the Maker working (section 6.3) |
| Agents differ too much to support well | Skills and MCP are the common ground. The briefs suite records the agent and model, so a weak pairing shows up. Stage 0 tries two agents |
| A plan's terms change for agents driven by another app | The Maker never calls a model or handles credentials, so the agent stays the user's own. An API key in the user's agent works if a plan can't be used (section 6.2) |
| A cartridge fitted to its first game | Each piece records the games it came from; pieces stay tentative until a second game uses them; every game becomes a brief, so a change for one game is graded against the others (section 5.3) |
| Cartridges that clash in one game | Components in their own packages, skills named by cartridge with a stated order, starters written to combine (section 5.4) |
| Non-coders stuck when the agent is | Playtest notes, replays, scores with evidence and checkpoints keep them in charge; failures explained in plain words |
| Originality and IP | Placeholders made by code; the originality check before publishing; the agents' skills carry this repo's originality rules |

## 10. Stages

Each stage ends with something usable. Sizes are rough guesses for one
person working with an agent, to be revised after stage 0.

0. **Spike (4-5 weeks).** The Maker host and its MCP server, with the T3
   Code adapter, on one existing arcade game exported as a standalone
   project. It covers:
   - the scores and the preview in one window, in T3 Code's browser panel
   - checks, checkpoints, and a playtest note that starts a turn
   - the same work done with two agents, such as Claude Code and Codex
   - the first two graders, with five briefs and their held-out scenarios
   - a rough cartridge for the game's genre, filled by hand-picked lifts,
     and a second, smaller game in the same genre started from it

   **Go** if:
   - a non-coder makes ten described changes, and at least eight pass the
     graders within two tries;
   - the scenarios' verdicts agree with a person's on at least four builds
     in five;
   - the second game reaches the same satisfaction with clearly fewer
     described changes than the first;
   - a day of Pair mode fits within a Pro or Max plan's limits;
   - the second agent passes the briefs nearly as well as the first, with
     the same tools and skills.

   Otherwise, stop and write down why.
1. **Game kit, template and cartridge format (5-7 weeks).** Publish the
   game kit, with its game UI kit, and the lint plugin. Build the headless
   runner, a project template that builds and tests outside the repo, and
   the cartridge format. Every new project starts with at least one
   cartridge, empty if need be.
2. **Pair mode (4-6 weeks).** The Maker UI: preview with hot reload, the
   tunables panel, the spec with its scores and coverage map, the timeline,
   the tech view. The first window widgets, pulled together from the
   playground and the arcade page.
3. **Playtest loop (3-4 weeks).** Recording and replay, notes pinned to a
   tick, replays turned into scenarios.
4. **Cartridge loop (4-6 weeks).** The curator and cartridge gates, games
   turned into briefs, provenance and tentative pieces, pinned versions and
   upgrades, several cartridges in one game, and cartridge scores beside
   the game's.
5. **Run mode (4-6 weeks).** The work queue, attempts in worktrees, graders
   3 to 6, gates, calibration, the escape rate, and the Maker's own suite of
   briefs.
6. **Editors (6-10 weeks).** Sprites, sounds (077 stage 1), maps and data
   come first, then music (077's tracker). The window widgets grow with the
   editors, and become a package once the Studio, the Maker and a third app
   share them.
7. **Seed cartridges (4-6 weeks).** Daily logic puzzles, maze chases and
   vertical shooters, grown by remaking the repo's own games in the Maker.
8. **Ship (2-4 weeks).** Web build, itch.io, static hosting.
9. **Later.** 3D genres, sharing cartridges with other people and using
   theirs, image and audio models, a desktop app, sharing projects and
   playtests with friends.

## 11. Open questions

- **A name.** "gamefab" is the working name for now. A "fab" is a chip
  fabrication plant, which suits a software factory. Gamicom was the more
  memorable choice, but it's one letter from Nintendo's Famicom. The body
  still says "the Maker".
- **Does the preview play well in T3 Code's browser panel?** It's a real
  Chromium page, so it should. Still to check: frame rate, whether the game
  keeps keyboard focus while the chat box is open, and pointer lock. A few
  minutes with one of this repo's games from `npm run dev` would settle it.
- **Which agents does the Maker support?** Probably Claude Code and Codex
  first, since they're the most used, then whichever the briefs suite shows
  working well.
- **Should the chat ever move into the Maker's own window?** That would
  mean driving the agent through ACP behind the Maker's own chat box. It
  would make T3 Code optional, at the cost of building what T3 Code already
  does.
- **Could an MCP App carry the gates?** An MCP App is interactive HTML from
  an MCP server, shown inside the chat, and it can post a message to the
  thread once you confirm it. T3 Code shows them in Claude Code and Codex
  threads. A gate card in the chat, with Accept and Reject, might suit Pair
  mode.
- **What does a scenario look like?** TypeScript, which the scenario writer
  handles easily, or data (inputs and assertions), which the UI can show and
  edit. Probably TypeScript with a small, documented API.
- **How do starters combine?** Probably each cartridge supplies models and
  views that the top-level `GameModel` and `GameView` compose, with the
  agents writing the glue. Stage 4 has to show this works for two genres
  that share a screen, such as a platformer with a shop.
- **When does a cartridge split?** A platformer cartridge that grows a lot
  of precision-platformer know-how might fork, or gain a narrower cartridge
  on top of it.
- **How much of the grading should a beginner see?** Perhaps just
  satisfaction per requirement, with the ladder in the tech view.
- **Open source or not?** The libraries are open; the Maker could be too, or
  a closed app on open libraries.
- **How much of the Maker's UI should use Tock** (083)? Its on-demand ticker
  suits an editor that sits idle most of the time. The window widgets work
  either way (section 3.10).
- **Where does it live?** A site in this repo at first (like the Studio),
  or a repo of its own once the game kit is published.

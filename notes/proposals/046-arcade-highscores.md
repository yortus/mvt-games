# Proposal: Highscores for the Arcade

> The Arcade's games keep a score, then forget it. This proposal gives every
> game with a score one global table of the ten best, shared by everyone who
> plays, with three-letter initials entered the way an 80s cabinet asked for
> them, and drawn in the Arcade's pixel font. The site stays static on GitHub
> Pages: the tables live in a small Cloudflare Worker with one Durable Object,
> a private package in this repo, and the browser only `fetch`es. The one
> thing kept in the browser is the visitor's initials, so the second time
> they place, their initials are already there. Games change hardly at all:
> each session reports two queries, its score and whether its run is over,
> and the Arcade does the rest.

**Status:** implemented, in its own branch, not yet merged into `vnext`.
Steps 1 to 8 are done (section 11). The Worker is deployed for production
at `highscores.yortus.workers.dev`, and for the test site at
`highscores-test.yortus.workers.dev`. The site's workflows point at them,
and a workflow deploys the Worker when its package changes. The pause
menu's highscores are a tab. What is left is step 9's later decisions.

**Written:** 2026-10-08, against `vnext` at `87ed5c8`. Checked against the
entry types ([`entry-starter.ts`](../../packages/website/src/entry-types/entry-starter.ts),
[`arcade-entry.ts`](../../packages/website/src/entry-types/arcade-entry.ts)),
the entry host ([`entry-host.ts`](../../packages/website/src/runner/entry-host.ts)),
the Arcade's model, page and pause menu
([`arcade-model.ts`](../../packages/website/src/arcade/models/arcade-model.ts),
[`main.ts`](../../packages/website/src/arcade/main.ts),
[`pause-menu-view.tsx`](../../packages/website/src/arcade/views/pause-menu-view.tsx)),
the pixel font ([`pixel-font.ts`](../../packages/website/src/arcade/views/pixel-font.ts),
[`pixel-text-view.ts`](../../packages/website/src/arcade/views/pixel-text-view.ts)),
the deploy workflows, and the score and end of run of all eight games
(section 3.3). Cloudflare's plan and limits checked against its docs, and
by a deployed spike, on the same day (section 4.6).

**Related:**
[The Arcade](../../packages/website/src/arcade/README.md) -
[Adding an Entry](../../packages/website/src/entries/README.md) -
[Architecture Rules](../../packages/docs/architecture/rules.md) -
[Change Detection](../../packages/docs/building-with-mvt/reacting-to-changes/change-detection.md) -
[045](045-sound-chip.md) (also adds to what the host gives a session; the two should agree on shape) -
[034](034-neon-monsoon-bullet-hell.md) (Neon Monsoon's seeded, replayable model, the first candidate for replay checks, section 8.3)

---

## Summary

| # | Decision | Recommendation | Section |
| --- | --- | --- | --- |
| 1 | Where the tables live | A Cloudflare Worker with one Durable Object holding every game's table in its SQLite storage. No server to run; free plan | [4](#4-the-worker) |
| 2 | What the browser keeps | The visitor's last initials, in `localStorage`, to prefill the next entry. Nothing else: no offline queue, no local tables | [6.3](#63-remembered-initials) |
| 3 | Where the code lives | In the website: `src/highscores/` for the rules both sides share (the character set, the blocklist, how a table takes a score) and the page's stores, and `highscores-worker/` for the Worker, a TypeScript project of its own | [5](#5-where-the-code-lives) |
| 4 | How a game reports its score | Two queries on the session, `scoring: { score: () => number; isOver: () => boolean }`, written in each game's `load.ts`. No model changes | [3](#3-what-a-game-reports) |
| 5 | Which games | The six with an open-ended score, and Crumb Chase. Not Dojo Duel (no score) or the demos | [3.3](#33-the-games) |
| 6 | Who decides a score places | The Arcade's model, against the table it last fetched; the Worker has the final say and returns the table as it now stands | [6.1](#61-the-arcades-model) |
| 7 | Initials | Three characters from A-Z, 0-9, space and full stop (38, one new glyph), not all spaces, no blocklisted words. Entered with up and down to change a letter, as a cabinet did, or by typing | [7](#7-entering-initials) |
| 8 | Where tables are shown | After a run places (its row flashing), in the pause menu, and in the entry's info panel | [6.2](#62-the-views) |
| 9 | Cheating | Plausibility checks only: a cap per game, a rate limit, an allowed origin. Stated plainly in the About panel. Replay checks are a later, separate step | [8](#8-what-it-cannot-stop) |
| 10 | A game's rules change | Each game's table has a version in the Worker's config; bumping it starts a fresh table | [4.3](#43-the-games-config) |
| 11 | The world's best, in the game | Start options gain `bestScore: () => number`, the top of the entry's table. Neon Monsoon's HUD shows it as "HI", as a cabinet's did | [6.4](#64-the-worlds-best-in-the-game) |

---

## 1. Why, and What Done Looks Like

An arcade without a highscore table is a room of games with nothing to aim
for. Seven of the eight games here keep a score while they run, show it on
their game-over screen, then throw it away when the visitor leaves. Only
Neon Monsoon remembers a best score, and only until the page closes.

Done looks like this. A visitor finishes a run of Galaxy Raiders with a
score good enough for the table. The game stops where it is, and over it the
Arcade asks for three letters, in the pixel font, the first one blinking.
They pick `TJG` with the arrow keys and press fire; the table appears with
their row flashing in fourth place; a key returns them to the game's own
game-over screen, where restart works as before. Next week someone in
another country opens the Galaxy Raiders info panel and sees `TJG` there.
The next time the first visitor places, in any game, `TJG` is already
filled in.

And the site is still a static build on GitHub Pages.

## 2. The Choice of Backend

Settled in conversation, recorded here so it is not reopened without new
information. A global table needs some shared, writable store; the
question was how much of a backend to own. The options were:

- **Device storage only.** Not global. Kept only for remembered initials.
- **A hosted database written to from the browser** (Firebase Firestore,
  Supabase), guarded by declarative rules. No code of ours runs, but it
  brings a vendor SDK, cannot keep a table to exactly ten rows, and its
  rules cannot rate-limit. Supabase pauses idle free projects.
- **A small edge function** (a Cloudflare Worker). Code we own, but no
  server: real validation, rate limits, moderation, exact tables, a plain
  `fetch` from the browser, and room for replay checks later. **Chosen.**
- **Free services used against the grain** (Google Apps Script with a
  Sheet, JSON bins, hobby leaderboard services, the GitHub API). Ruled
  out: write keys in the browser, races between writers, or reliance on a
  service that may vanish.
- **Peer-to-peer** (Nostr relays, Gun.js). Ruled out: relays may drop data,
  anyone can flood the tables, and two visitors may see different tables.

## 3. What a Game Reports

### 3.1 Two queries on the session

The Arcade needs to know two things about a running game: its score, and
the moment its run ends. Both are already in every game's model; neither
leaves the session today, since `start/load.ts` returns only `update`,
`destroy` and `inputConfig`.

```ts
/** A running entry. */
export interface EntrySession {
    // ...as now...
    /** For a game with a highscore table: its score, and whether its run is over. */
    readonly scoring?: EntryScoring;
}

/** What a game tells the Arcade so it can keep the game's highscores. */
export interface EntryScoring {
    /** The score so far; once the run is over, the final score. */
    readonly score: () => number;
    /** Whether the run has ended, by losing or by winning, until the game starts another. */
    readonly isOver: () => boolean;
}
```

Galaxy Raiders' `load.ts` gains three lines:

```ts
scoring: {
    score: () => gameModel.score,
    isOver: () => gameModel.phase === 'game-over',
},
```

These are query bindings, read every frame, like a view's. The Arcade
watches `isOver` turn true (with `watch`, as `main.ts` already watches the
phase), and reads `score` at that moment. The models gain no events and no
counts.

### 3.2 Why a state and not a count

045 section 6.4 keeps a count where an event leaves no lasting state. A run
ending does leave one: every game sits in a terminal phase until restart,
and restart is only possible from there. So a boolean read from the phase
is enough, needs no model change, and survives both ways a game restarts:
in place (`model.reset()`, `isOver` turns false) and by the host
(`host.restart()`, a new session, a new `scoring`).

### 3.3 The games

| Game | Score | Run over when | Notes |
| --- | --- | --- | --- |
| astrovoid | `gameModel.score` | `phase === 'game-over'` | Open-ended |
| burrow-bust | `gameModel.score` | `phase === 'game-over'` | Open-ended |
| crumb-chase | `gameModel.score` | `phase` is `'game-over'` or `'won'` | **Capped at 2520** (252 crumbs at 10). Every win ties; see section 9 |
| fuel-run | `gameModel.score` | `phase === 'game-over'` | Open-ended |
| galaxy-raiders | `gameModel.score` | `phase === 'game-over'` | Open-ended |
| kwazy-cactii | `gameModel.score` | `phase === 'game-over'` | Open-ended; the board is replaced on reset, which `gameModel.score` already hides |
| neon-monsoon | `gameModel.scoring.score` | `phase` is `'game-over'` or `'all-clear'` | Finite run, six or seven digits. Keeps its own session best (`scoring.highScore`); see section 9 |
| dojo-duel | none | `'match-over'` | **Left out.** Win or lose against the AI; no number to rank. See section 9 |

The five demos (boids, boids-3d, falling-sand, fruit-machine,
reordering-lists) are left out. Fruit Machine has credits and a game-over
phase, but credits are not a score to beat.

### 3.4 The entry's metadata

The Arcade must know which entries have tables without loading their code
(the info panel shows the table; the wall may one day show the leader).
`ArcadeEntry` gains:

```ts
/** Whether the entry keeps a highscore table: a game whose session reports `scoring`. */
readonly hasHighscores?: boolean;
```

Two tests hold the pieces together. The catalogue's checks that the
entries with `hasHighscores` are exactly the games in `GAMES` (section
4.3), and all of them games. `entries/scoring.test.ts` loads and starts
each of them headless under Node, its textures stubbed as the benchmarks
stub them, runs it a second, and checks that it reports `scoring`: a whole
score, and a run not yet over.

## 4. The Worker

### 4.1 Shape

One Worker, one Durable Object class, one instance of it (named
`'arcade'`). The object owns every game's table in its SQLite storage. One
instance, not one per game, because the traffic is tiny, a single object
makes "every table" one read, and it serialises every write, so two players
placing at once can never lose a row.

```sql
CREATE TABLE scores (
    game     TEXT    NOT NULL,  -- game id and table version: 'galaxy-raiders@1'
    initials TEXT    NOT NULL,
    score    INTEGER NOT NULL,
    at       INTEGER NOT NULL,  -- when it was entered, ms since the epoch
    seq      INTEGER NOT NULL   -- order of arrival, to break ties
);
```

After each insert the object deletes all but the game's best ten. Ties go
to the earlier score, as on a cabinet: a new score must beat the tenth to
place, and an equal score ranks below the one already there.

### 4.2 The API

| Request | Response |
| --- | --- |
| `GET /v1/tables` | `{ tables: { [entryId]: Row[] } }`, every game, best first. Never cached (`no-store`), so a visitor who has just placed sees their row; Cloudflare's edge cache does not work on `workers.dev` anyway |
| `POST /v1/tables/:entryId` with `{ initials, score }` | `{ table: Row[], rank?: number }`: the table as it now stands, and where the score placed (1-10). `rank` is absent if it did not place, so the JSON needs no `null` |
| `DELETE /v1/tables/:entryId/:rank` | Removes a row. Needs the admin secret (`Authorization: Bearer`), set with `wrangler secret put`. For moderation, run by hand with `curl` |

`Row` is `{ initials: string; score: number; at: number }`. The client sends
the game id; the Worker adds the version.

A POST is refused (400, 403, 404 or 429, with a reason the browser can act
on and a message for the log: `{ refused, message }`) when:

- the game id is not in the config;
- the initials break the rules (section 7.1), checked with the same code the
  browser uses;
- the score is not a whole number from 1 to the game's cap;
- the request's `Origin` is not one of the site's (GitHub Pages, the
  Surge test site, `localhost`). Not a defence, since anything outside a
  browser can send any `Origin`, but it keeps other pages from posting;
- the address has posted too often (the rate limiting binding, keyed by
  IP: a handful a minute). No address is stored.

### 4.3 The games' config

The Worker's list, in the package's shared rules (`rules/games.ts`), and
exported with them, so the site's catalogue test can check its entries
against it:

```ts
export const GAMES: Readonly<Record<string, GameRules>> = {
    'astrovoid': { version: 1, maxScore: 9_999_990 },
    'crumb-chase': { version: 1, maxScore: 2520 },
    'neon-monsoon': { version: 1, maxScore: 99_999_990 },
    // ...
};
```

The caps are loose, set from what each game can plausibly reach, and they
catch only the laziest cheat. A game whose scoring changes enough to make
its table unfair bumps its `version`: the old rows stay in storage, unread,
and a fresh table starts.

### 4.4 Environments and deploying

The account's subdomain is `yortus.workers.dev`, and the Worker is named
`highscores`. Two environments in `wrangler.toml`: production, at
`https://highscores.yortus.workers.dev`, for GitHub Pages, and `test`, at
`https://highscores-test.yortus.workers.dev`, for the Surge test site,
with tables of their own; `test` also takes posts from `localhost` on any
port, for the site in development. By hand, `npm run
highscores:deploy:test -w @mvtjs/website` and `npm run highscores:deploy
-w @mvtjs/website`. A workflow, `deploy-highscores.yml`, runs `wrangler
deploy` when the Worker or the code it shares changes: production on a
push to `main`, and `test` on a push to `test`. It
needs the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets. The
site learns the Worker's URL at build time from `VITE_HIGHSCORES_URL`, set
in `deploy.yml` and `test-deploy.yml`.

### 4.5 Local development and tests

With no `VITE_HIGHSCORES_URL`, `npm run dev` uses an in-memory store, so the
whole flow (placing, initials, the table) can be tried with nothing
running. `wrangler dev` runs the real Worker locally for anyone who sets the
URL to it. Tests never touch the network.

### 4.6 What the spike found

Step 1, on 2026-10-08: a throwaway Worker, `spike/worker.spike.ts` (in
the commit that added this proposal; removed when step 3's Worker replaced
it), with the object written twice (a class and a factory function), a table
pruned to ten, and the rate limiter. Run with `wrangler dev`, then
deployed with Wrangler 4.148 as `highscores-spike.yortus.workers.dev` on
the free plan, measured from Perth, and deleted.

| Question | Found |
| --- | --- |
| SQLite-backed Durable Objects on the free plan? | Yes. The free plan offers only SQLite storage, which is what this wants. Its daily limits: 100,000 requests, 100,000 rows written, 5 million rows read, 5 GB stored. Rows outlived the object being unloaded |
| The rate limiting binding on the free plan? | Yes. With a limit of 5 a minute it let 6 through, then refused; it is approximate and counts per Cloudflare location, as its docs say. Enough against a flood, not an exact quota. Locally (`wrangler dev`) it refused nothing |
| Can the object be a factory function, not a class? | **Yes**, locally and deployed. The runtime calls the export with `new`, and a function that returns an object gives that object as the instance. Cloudflare documents only a class extending `DurableObject`, so this is relied on, not promised: if a later runtime refuses it, the class is a five-line change. A factory gets `fetch` only, not typed RPC, which two routes do not need |
| How long does a request take? | Warm: 140-165 ms in all, of which the Worker and the object take about 55 ms. After 4 minutes idle: about 180 ms, 90 ms inside. The first request to a newly made object: about 0.8 s, once |
| Anything else? | A new Worker answered 404 on some requests for about a minute after its first deploy, while it spread. The tables, the whole SQLite file, were 16 KB |

So the design stands as written, but for one thing found in step 3: the
edge cache works only on a custom domain, not on `workers.dev`, so reads
go to the object every time. They are quick enough without it, and a
submission's time is hidden behind the table appearing. A custom domain (`highscores.yortus.com`)
would need `yortus.com`'s DNS on Cloudflare; not needed to start, and a
switch later is one build variable.

## 5. Where the Code Lives

In the website, in two folders:

```
packages/website/
├── src/highscores/          Shared by the page and the Worker
│   ├── rules/               The character set, the blocklist, how a table takes a score, findRefusal, GAMES
│   ├── protocol/            The paths and JSON shapes the two sides exchange, and their parsers
│   └── client/              HighscoreStore, the fetch store and the in-memory store (the page's)
└── highscores-worker/       The Worker: its own TypeScript project, beside src/
    ├── request-handler.ts, sql-table-storage.ts, table-storage.ts, worker.ts, and their tests
    ├── wrangler.toml        The Worker, its Durable Object, rate limiter and origins, production and `test`
    ├── worker-configuration.d.ts   Cloudflare's runtime types (`npm run highscores:types -w @mvtjs/website`)
    └── README.md
```

The Worker runs on Cloudflare's runtime, so `highscores-worker/` has a
tsconfig of its own, with Cloudflare's types in place of the DOM's. Its
code imports `src/highscores/` as `#highscores`, an import mapping in the
website's `package.json`, beside `#shared`. Wrangler
builds the Worker from `worker.ts`, and the page never imports the
folder, so none of its code reaches the page's bundle. The page and the
Worker check initials with the same function.

This was first built as a private workspace package, `@mvtjs/highscores`.
It moved into the website on 2026-10-14, before it was merged: nothing
outside the website could reuse it, and a folder with its own tsconfig
gives the Worker the separate types it needs. Do not reopen without new
information, such as a second site wanting the tables.

The Worker's every request goes to the one Durable Object, which runs
`createRequestHandler`: the routes, CORS, the origin check, the rate limit
(by `CF-Connecting-IP`, inside the object, so it counts in one place), the
rules, and the admin route. `worker.ts` only wires it to Cloudflare's
bindings.

```ts
/** Where the Arcade's highscore tables are kept. */
export interface HighscoreStore {
    /** Every game's table, best first, by game id. A game with no scores yet is absent. */
    readonly loadAll: () => Promise<HighscoreTables>;
    /** Enters a score in its game's table. */
    readonly submit: (submission: Submission) => Promise<SubmitResult>;
}

/** What became of a score: entered (whether or not it placed), or refused. */
export type SubmitResult =
    | { readonly kind: 'entered'; readonly table: readonly HighscoreRow[]; readonly rank: number | undefined }
    | { readonly kind: 'refused'; readonly reason: RefusalReason };
```

A promise rejects only when the tables cannot be reached or answer with
something unexpected, which the Arcade shows as "offline"; a score the
tables turn down resolves as `'refused'`. One function, `findRefusal`,
decides what is turned down, for the in-memory store and the Worker alike,
and `enterRow` decides where a score goes. The parsers check the shape of
everything that crosses between the two, so a malformed answer never
reaches the Arcade's model, and a malformed request never reaches the
table.

The Worker's handler takes its storage as a small interface, `TableStorage`,
so its tests run in Node against an in-memory table. The SQLite storage
takes the object's `sql.exec` as a function, so the same tests run it on
Node's own SQLite (`node:sqlite`). The Durable Object is a thin adapter
around the handler with no logic of its own. It is a factory function, not
a class, which the runtime accepts (section 4.6).

## 6. The Arcade

### 6.1 The Arcade's model

A new model, `createHighscoresModel({ store, rememberedInitials })`
([`highscores-model.ts`](../../packages/website/src/arcade/models/highscores-model.ts)),
made by the Arcade's model and held as `model.highscores`. Like the
Arcade's own, nothing in it moves with time: the store's answers arrive
when they arrive, and each may only move the state on, and only if nothing
has happened since it was asked for (the Arcade's launch pattern, its
README, section 3). It owns:

- **The tables,** asked for as the model is made, again as a game with a
  table starts (for where its run will place, and its "HI"), and as such a
  game's info panel opens; each is one small request, about 150 ms. A
  `status` of `'loading' | 'ready' | 'unavailable'`: unavailable only if no
  tables have ever arrived, so a failed reload keeps the older ones, and
  the Arcade says "Highscores offline" rather than showing an empty table.
  A `tablesRevision` counts changes, for views to redraw on. Only the
  latest reload is taken, and none asked for before a submission's answer.
- **A score that places,** in a `placing` phase of `'none' | 'asking' |
  'sending' | 'shown'`, with its entry, score and rank, and a problem once
  shown if it was not entered (`'refused' | 'unreachable'`).
  `runEnded(entryId, score)` starts it asking when the score would place in
  the table as last seen. A run that would not, a score of 0, or tables not
  yet arrived change nothing: there is nowhere to send it, and no offline
  queue. `submitInitials(initials)`, guarded by `isValidInitials`, sends
  it; the answer shows it at the rank it took, which may be none if others
  pushed it out meanwhile. Initials the browser took and the Worker turned
  down ask again. `close()` ends the placing, whatever its phase: a score
  being sent is still entered, and its table taken, but not shown.
- **`lastInitials`,** starting from `rememberedInitials` if they are valid,
  set by each submission.

The Arcade's model takes the end of a run through `runEnded(score)`, and
passes it on only for the entry playing, if it has a table. Its new
`isEntryHeld` is true while paused or while a score places, and the page
holds the entry host with it, so the game's restart button cannot reset
the run behind the prompt. A held game takes no keys: it did, until step 6
found the Enter that closes the table restarting the game, since a game's
keyboard input stayed active while its models stood still. The Pixi
stage's keyboard input is now inactive while the entry is held, as its
touch controls already were, and releases any key still held.
The pause menu cannot open over a placing score, and one that starts as
the visitor pauses takes over from the menu. Restarting or leaving the
entry closes the placing.

The page (`main.ts`) does the plumbing, as it already does for sessions. It
watches `host.session?.scoring?.isOver()`, and when it turns true calls
`model.runEnded(scoring.score())`; a run that does not place changes
nothing, and the game's own game-over screen shows as it does now. It
starts each entry with `bestScore`, from `highscores.bestScoreFor`, and the
host keeps the start options for a restart. The store is the Worker named
by `VITE_HIGHSCORES_URL` when the build sets it, and otherwise tables in
memory, by the same rules (section 4.5).

### 6.2 The views

All in HTML JSX, so they work over an entry of any renderer:

- **`PlacingView`**, over the held entry, above the pause menu: while a
  score asks and sends, "NEW HIGHSCORE", the score, its place ("4TH
  PLACE"), and the initials prompt, three letter cells and an OK in the
  pixel font, the cursor's cell blinking, with ▲ and ▼ on each cell for
  touch; once shown, "HIGH SCORES", the table with the new row flashing, a
  line if the score did not get in, and Continue. The prompt's state (the
  letters, the cursor, the blink, a pending skip) is a view model,
  `createInitialsViewModel`, with its own tests (section 7).
- **`HighscoreTableView`**: ten places, each a rank ("1ST"), initials and a
  score in the pixel font, each place in its own colour as on a cabinet,
  places not yet taken dim, and a `highlightRank` that flashes. It says
  "Loading the highscores…" or "The highscores are offline just now." in
  the table's place. Also in the pause menu (a "Highscores" item, which
  opens like "How to play") and in the entry's info panel.
- **`PixelTextView`** drew fixed text, once. Its `text` and `label` are now
  `ValueOrGetter<string>`: changing text is redrawn when it changes, and
  fixed text still has no refresh step.
- The **About** panel says, in a line, that the tables are shared and check
  only that a score is plausible (section 8.1).

Escape belongs to the placing view while a score places: the Arcade's own
Escape (close a panel, pause, leave) stands aside.

The table is shown after a run that places, not after every run: classic,
and it keeps the game's own game-over screen in charge of what happened.
Showing the leader on each card, and cycling tables in attract mode, are
left for later (section 11, step 8).

### 6.3 Remembered initials

The page reads `localStorage` once, at start, for `rememberedInitials`
(checked with `isValidInitials`; anything else is ignored), and writes it
when `model.highscores.lastInitials` changes, the way it writes the URL from
the model. Reads and writes are in `try`/`catch`: private windows and
blocked storage just mean no prefill. Nothing else is stored in the
browser.

### 6.4 The world's best, in the game

A cabinet's HUD showed the machine's best score beside the player's. Here
the machine is the world. `PixiStartOptions` and `ElementStartOptions` now
share a `StartOptions` with an optional query:

```ts
/** What the host gives an entry of either kind as it starts. */
export interface StartOptions {
    /** The best score in the entry's highscore table: 0 while it is empty, loading or out of reach. */
    readonly bestScore?: () => number;
}
```

The host passes the highscores model's top score for the entry; headless
starts pass nothing. Neon Monsoon's HUD, which shows its own best this
session (`scoring.highScore`), shows the larger of the two: its `GameView`
takes an optional `bestScore` binding, which its `load.ts` passes on from
the start options. Its model is unchanged. Other games can adopt it as they gain a
"HI" in their HUD.

## 7. Entering Initials

### 7.1 The rules

- Exactly three characters, from 38: `A`-`Z`, `0`-`9`, space and `.`. The
  pixel font has all but the full stop, which is one new glyph.
- Not all spaces.
- Not one of a short blocklist of three-letter words, in the shared rules.
  The prompt refuses them as it refuses an invalid entry, by not
  accepting; the Worker refuses them too.
- Stored and shown in capitals; typed lowercase is raised.

### 7.2 The controls

What a key does is the view's business; the model only takes three
finished letters (the same split as the pause menu).

- **Down and up** step the current letter forward and back through the set,
  wrapping: down goes `A` to `Z`, then the digits, `.`, space, as a list
  read downward does (settled in play on 2026-10-08: up going forward felt
  backward). The cabinet's way, and the only way on a
  pad.
- **Left and right** move between the cells. **Fire** or **Enter** accepts
  the letter and moves on; on the third, submits. **Backspace** moves back.
- **Typing** a letter from the set puts it in the current cell and moves on.
- **Escape** skips, after asking once: a run that placed should not be lost
  to a stray key.
- **Touch**: up and down arrows above and below each cell, and an OK button.

It opens on the remembered initials, if any, with the cursor on the OK
button, so a returning player confirms with one press. The key handling is
a pure helper with its own tests, as `card-wall-keys.ts` is.

## 8. What It Cannot Stop

### 8.1 Plainly

Whatever the browser can send, anyone can send. The Worker can refuse
nonsense (a score over the cap, a flood from one address), but not a
plausible lie: a request saying `ACE` scored 41,230 at Astrovoid looks the
same whether it was earned or typed. The About panel should say so in a
line, so a forged score does not look like an endorsement.

### 8.2 In practice

For a hobby arcade the risk is vandalism more than fraud: a top ten of
`999999` and rude words. The caps, the blocklist, the rate limit and the
`DELETE` route cover that. If it becomes a real problem, the next step is
section 8.3, not more rules.

### 8.3 Later: replay checks

MVT makes a real check unusually reachable. A model advances only through
`update(deltaMs)`, so a run is its seed, its sequence of deltas and its
inputs; a Worker can import the model, replay the run headlessly, and
compare the score. Neon Monsoon already runs on a fixed step with seeded
random numbers (034). The others call `Math.random` directly in at least
eight model files and would need a seeded generator first. Recorded runs
also get large. Worth its own proposal; this one only keeps the door open
by making `submit` take an options object that can grow a `replay` field.

## 9. Open Questions

Settled on 2026-10-08:

1. ~~**The character set.**~~ A-Z, 0-9, space and full stop, as
   recommended (section 7.1).
2. ~~**The URL.**~~ `yortus.workers.dev` is claimed; the Worker is
   `highscores.yortus.workers.dev` (section 4.4).
3. ~~**Crumb Chase and Dojo Duel.**~~ Left for later. Crumb Chase keeps its
   table, its ties ordered by who got there first; a time bonus on winning
   would change the game. Dojo Duel stays out until it has a score (points
   difference, or a win streak), which is a model change of its own.
4. ~~**Neon Monsoon's own best.**~~ Its HUD shows the world's best (section
   6.4).

Still open, with a recommendation each:

5. **Show the table after every run, or only one that places?** Only one
   that places (section 6.2).
6. **Keep a log of every submission** (not just the top ten), for
   moderation after the fact? Not for now: more to store, nothing to use it
   for yet.

## 10. Ruled Out

- **Any backend but a Worker.** Section 2. Do not reopen without new
  information.
- **Offline queueing in `localStorage`.** A score that could not be sent is
  lost. Kept out to keep the browser's storage to the initials alone.
- **One Durable Object per game.** Reading every table would mean asking
  each one; one object is simpler at this traffic.
- **Games submitting their own scores** (a store in the start options,
  called from the model). It puts I/O in models and makes each game handle
  failure; reporting two queries keeps games ignorant of tables.
- **Storing addresses, or any account.** Rate limiting needs no stored
  address, and three letters are the whole identity.

## 11. Implementation Steps

1. ~~**Spike.** Deploy a hello-world Durable Object Worker on the free plan.
   Confirm SQLite storage and the rate limiting binding there, and time a
   cold request. Report before going on.~~ Done 2026-10-08: everything
   needed is on the free plan, and the object can be a factory function
   (section 4.6).
2. ~~**The package's rules and stores.** `@mvtjs/highscores` with the
   character set, the blocklist, `isValidInitials`, how a table takes a
   score, `HighscoreStore`, the fetch store and the in-memory store. Tests
   in Node, with expected values derived from the rules' constants.~~ Done
   2026-10-08, with the protocol's shapes and parsers beside them (section
   5); 33 tests.
3. ~~**The Worker.** The handler, the Durable Object, `GAMES`, CORS, the rate
   limit, the admin route. Handler tests against in-memory storage.
   Deployed to `test` by hand.~~ Done 2026-10-08: 54 tests in all, the
   SQLite storage among them on `node:sqlite`; checked under `wrangler dev`,
   then deployed to `highscores-test.yortus.workers.dev` and checked there.
   The spike is gone. No admin token is set yet (`wrangler secret put
   ADMIN_TOKEN --env test`); until one is, nothing can be removed.
4. ~~**The session contract.** `scoring` on `EntrySession`, `hasHighscores`
   on `ArcadeEntry`, `bestScore` in the start options, the seven games'
   `load.ts` (Neon Monsoon's HUD showing the world's best), and the
   catalogue test (section 3.4).~~ Done 2026-10-08. `GAMES` moved into the
   shared rules for the catalogue test, and a second test starts each game
   headless (section 3.4). The host does not pass `bestScore` yet: that
   waits for the highscores model, in step 5.
5. ~~**The Arcade's model.** `createHighscoresModel`, held by the Arcade's
   model; pausing while pending; the page's plumbing and remembered
   initials. Tests with the in-memory store.~~ Done 2026-10-08 (section
   6.1). The site builds, its home page's first load at 37.6 KB of a 40 KB
   budget. Nothing shows a placing score yet: that is step 6.
6. ~~**The views.** `PixelTextView` with changing text, the full stop glyph,
   `InitialsEntryView` and its keys helper, `HighscoreTableView`, the pause
   menu's item, the info panel's table, the About panel's line.~~ Done
   2026-10-08 (section 6.2), as `PlacingView` and `createInitialsViewModel`.
   Played through in Playwright's headless shell against the dev server's
   in-memory tables: a Galaxy Raiders run placed, `TJG` typed and sent, the
   table shown, Continue back to the game's own game-over screen, the pause
   menu's and the info panel's tables. That found the restart bug fixed in
   the keyboard input (section 6.1). The home page's first load is now 39.9
   KB, which left its 40 KB budget nothing to spare; the budget was raised
   to 50 KB (`packages/checks/scripts/home-page-budget.ts`), which a
   renderer would still be far over.
7. ~~**Deploying.** `deploy-highscores.yml`, the secrets, `VITE_HIGHSCORES_URL`
   in both site workflows; production. Docs: the package's README, a
   section in the Arcade's README, and "reporting a score" in Adding an
   Entry.~~ Done 2026-10-14, after merging `vnext` (sound, v-snap, the
   pause menu's tabs) into the branch. Production deployed by hand and
   checked without writing to it. Docs: the package's README, section 8 of
   the Arcade's README, "Keeping Highscores" in Adding an Entry, and the
   package lists in `AGENTS.md` and the project structure page. The home
   page's first load is 46.6 KB of its 50 KB budget, with the sound
   controls and the highscores together.
8. ~~**When 045's pause menu lands.** The sound chip's work gives the pause
   menu tabs, not yet on `vnext`. Once it is, the table becomes a
   "Highscores" tab there, in place of the collapsed item this proposal
   added (asked for on 2026-10-08, when the item proved easy to miss).~~
   Done 2026-10-14, in the merge: a "Highscores" tab between the menu and
   "How to play", shown only for a game with a table.
9. **Later, each its own decision.** The leader on each card; tables in
   attract mode; Crumb Chase's ties and a score for Dojo Duel (question 3);
   replay checks (section 8.3).

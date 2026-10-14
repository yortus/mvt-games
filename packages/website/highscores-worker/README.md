# The Highscores Worker

> The Arcade's highscore tables. Each game with a score has one table of the
> ten best, shared by everyone who plays. A Cloudflare Worker keeps the
> tables, so the site itself stays static. This folder holds the Worker. The
> rules it shares with the page, and the stores the page uses to reach it,
> are in `src/highscores/`.

**Related:** [The Arcade](../src/arcade/README.md) ·
[Adding an Entry](../src/entries/README.md#keeping-highscores)

---

## The Parts

The highscores' code is in two folders of the website.

| Folder | What it holds | Where it runs |
| --- | --- | --- |
| `src/highscores/rules/` | The rules for initials, how a table takes a score, which submissions are refused, and the games with tables (`GAMES`) | Both |
| `src/highscores/protocol/` | The paths and JSON shapes that the page and the Worker send each other, and functions that check them | Both |
| `src/highscores/client/` | `HighscoreStore`, and two stores: one that reaches the Worker with `fetch`, and one that keeps tables in memory | The page |
| `highscores-worker/` | The request handler, the table storage, and `worker.ts`, which Cloudflare runs | Cloudflare |

The Worker runs on Cloudflare's runtime, not in a browser. So this folder is
a TypeScript project of its own, beside `src/`, with Cloudflare's types in
place of the browser's. Wrangler, Cloudflare's command-line tool, builds the
Worker from `worker.ts`. The Worker imports the shared code as
`#highscores`, an import mapping in the website's `package.json`. The page
imports only `src/highscores/`, so none of the Worker's code reaches the
page's bundle. But the page and the Worker still check initials with the
same function.

## The Rules

Initials are exactly three characters. Each is a capital letter, a digit, a
full stop or a space. They may not be all spaces, and they may not spell a
word on a short blocklist. A digit that looks like a letter counts as that
letter, so `A55` is blocked like `ASS`.

A table keeps ten rows, best first. A new score must beat a score to rank
above it. So when two scores are equal, the earlier one ranks higher, as on
an arcade cabinet.

A score is refused when its game has no table, its initials break the rules,
or it is not a whole number from 1 to the game's cap. Each game's cap is in
`GAMES`, in `src/highscores/rules/games.ts`. The caps are loose. They only stop a score
that no one could reach.

## The Worker

Every request goes to one Durable Object, which is a small stateful
server that Cloudflare runs for the Worker. The object keeps every table in
its own SQLite database. Because there is only one object, it handles one
request at a time, so two players placing at once can never lose a row.

The object is a factory function rather than a class. Cloudflare documents
only a class, but its runtime calls the export with `new`, and a function
that returns an object gives that object as the instance.

| Request | Response |
| --- | --- |
| `GET /v1/tables` | Every game's table, best first: `{ tables: { [game]: rows } }`. Any page may read it. It is never cached, so a player who has just placed sees their row |
| `POST /v1/tables/:game` with `{ initials, score }` | The game's table as it now stands, and where the score placed: `{ table, rank }`. `rank` is left out if the score did not place |
| `DELETE /v1/tables/:game/:rank` | Removes a row. It needs the admin token, and returns 403 without it |
| `OPTIONS` | The browser's preflight check before a post |

A post is refused with a reason the browser can act on, and a message for a
person: `{ refused, message }`. It is refused if it comes from a page that
is not allowed (403), if its address has posted too often (429), if its
game has no table (404), or if its body or its score breaks the rules (400).

The rate limit allows a few posts a minute from one address. Cloudflare
counts it approximately, so it stops a flood but is not an exact quota. No
address is stored.

### What it cannot stop

Anything a browser can send, anyone can send. The Worker refuses scores that
are impossible, and floods from one address. It cannot tell an earned score
from a plausible one that someone typed.

## Environments

There are two environments, each with tables of its own. Both are set in
[`wrangler.toml`](./wrangler.toml).

| Environment | Address | Pages allowed to post |
| --- | --- | --- |
| Production | `https://highscores.yortus.workers.dev` | The site on GitHub Pages, and `yortus.com` |
| `test` | `https://highscores-test.yortus.workers.dev` | The test site on Surge, and `localhost` on any port |

The site finds its Worker from `VITE_HIGHSCORES_URL` when it is built. The
site's workflows set it. Without it, as in `npm run dev`, the site keeps its
tables in memory, by the same rules, and forgets them when the page closes.

## Working on It

| Command | What it does |
| --- | --- |
| `npx vitest run -p unit packages/website/highscores-worker packages/website/src/highscores` | Runs the tests of the Worker and the code it shares, in Node. The SQLite storage runs on Node's own SQLite (`node:sqlite`) |
| `npm run highscores:dev -w @mvtjs/website` | Runs the Worker on this machine, on Cloudflare's runtime, as the `test` environment. Set `VITE_HIGHSCORES_URL` to its address to try it from the site |
| `npm run highscores:deploy:test -w @mvtjs/website` | Deploys the `test` environment. It needs a Wrangler login (`npx wrangler login`) |
| `npm run highscores:deploy -w @mvtjs/website` | Deploys production |
| `npm run highscores:types -w @mvtjs/website` | Writes Cloudflare's runtime types to `worker-configuration.d.ts`, after a Wrangler upgrade or a change to the compatibility date |

The workflow
[`deploy-highscores.yml`](../../../.github/workflows/deploy-highscores.yml)
deploys the Worker when it, or the code it shares, changes. A push to `main` deploys
production, and a push to `test` deploys the `test` environment. It needs
two repository secrets, `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

A newly deployed Worker can answer 404 for a minute or so, while the
deployment reaches every Cloudflare location.

## Looking After the Tables

**To remove a row,** such as a rude one, first set an admin token. Choose a
long random string, and keep it somewhere safe:

```sh
npx -w @mvtjs/website wrangler secret put ADMIN_TOKEN -c highscores-worker/wrangler.toml
```

Add `--env test` to set the test environment's token. Then remove the row by
its rank:

```sh
curl -X DELETE -H "Authorization: Bearer <token>" \
    https://highscores.yortus.workers.dev/v1/tables/galaxy-raiders/3
```

**To start a game's table afresh,** as when its scoring changes and old
scores would be unfair, raise its `version` in `GAMES`. The old rows stay in
the database, unread.

**To give a game a table,** add it to `GAMES` with a cap, and deploy. The
game itself reports its score to the Arcade, as
[Adding an Entry](../src/entries/README.md#keeping-highscores)
describes. A test checks that the games with tables and the games in
`GAMES` are the same.

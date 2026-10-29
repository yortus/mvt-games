# Open an Arcade Entry in the Playground, From GitHub

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-10-17 |
| Updated  | 2026-10-17 |

## Description

Let a visitor open an Arcade entry in the playground, read it, change it and
run it. The entry's files are read from the repo on GitHub as the visitor
opens it. No copy of them is kept anywhere, in the site's build or the
playground's package.

This was 052's step 12, and its idea 10.5 ("Remix an Arcade entry"). A
preliminary investigation was done on 2026-10-17, and its findings are
below. Nothing was built. The next step is to answer the open questions,
then write a proposal, since it touches the Arcade's build and adds a mode
to the playground.

### The short answer

It's practical for about half of the entries. The cheapest route is not to
rewrite an entry into a playground project. Instead, the playground opens
the entry's own files at their repo paths, along with the two Arcade
folders they import (`entry-types/` and `shared/`), also fetched as they
are. A small adapter, written in the playground, plays the part the Arcade
plays, so the entry's code runs unchanged.

### Reading the files

| Source | CORS | Limits | Lists folders? |
| --- | --- | --- | --- |
| `raw.githubusercontent.com` | open to any page | none in practice, cached for 5 minutes | no |
| GitHub's API, for a folder listing | open | 60 requests an hour for each visitor, without a token | yes |
| jsDelivr (`cdn.jsdelivr.net/gh/yortus/mvt-games@<ref>/...`) | open | none for each visitor; cached for 12 hours for a branch, and for good for a commit | yes, one call lists the whole repo, with sizes |
| The deployed Arcade (`yortus.com/mvt-games/assets/...`) | open | none | no (built files only) |

The recommendation is that the playground's build records the commit it was
built from, and reads the files from jsDelivr at that commit. Then the code
is exactly what the deployed Arcade runs, and the cache never expires. A
list of each entry's file paths, made at build time without their contents,
would save even the listing call, and doesn't copy the source.

On 2026-10-17, `main` still had the entries under `packages/sites/website/`,
and `vnext` under `packages/sites/arcade/`. Reading at the deployed commit
avoids that kind of mismatch.

### How the entries measured up (all 19, on 2026-10-17)

Each entry was measured against what the playground can run: at most 40
files (a share link's limit), imports only from the playground's library
list, no assets, and no Arcade services (input, highscores, saved games,
resizing, performance metrics).

| Group | Entries | What they need |
| --- | --- | --- |
| 1. Run with only the adapter | double-pendulum, fireworks, reordering-lists | Pixi starters with no input, no `#shared` and no assets, 8 to 10 files each |
| 2. Need small stand-ins | boids, deep-dive, garden-snake, astrovoid, dojo-duel, boids-3d, fractalscope | `#shared` (fetched as it is), keyboard input, and performance metrics (boids). boids-3d also imports the 2D boids entry's model. boids-3d and fractalscope use the other kind of starter, which mounts into an element |
| 3. Need their textures | crumb-chase, galaxy-raiders, burrow-bust, kwazy-cactii, fuel-run, neon-monsoon, fenceline | Textures packed at build time, which only the deployed site has. They load from `${import.meta.env.BASE_URL}assets/...`, so the sandbox would set `BASE_URL` to the site's address, which serves them with CORS open. fuel-run (41 files), neon-monsoon (49) and fenceline (40) are also over the share link's file limit |
| 4. Can't run | falling-sand, fruit-machine | falling-sand uses `solid-js` and `pixi-solid`, which aren't on the playground's library list. fruit-machine imports a `three/addons` module, and has 67 files |

Highscores and saved games would be left out: the adapter wouldn't provide
`bestScore`, and would never call `saveGame`. Sound already works, since
the sandbox provides the sound chip. Since the investigation, the sandbox
also measures performance itself, so boids' performance metrics may be
easier to provide.

### What makes it cheap

- `shared/` and `entry-types/` import only the libraries (Pixi,
  `@mvtjs/pixi`, `@mvtjs/utils`, `@mvtjs/chiptune`). So they can be fetched as
  they are, and nothing needs rewriting.
- If the playground lays the files out at their repo paths, every
  `../../../entry-types` import still resolves. Only `#shared` needs
  mapping to its folder, with one alias in the playground's import
  rewriting.
- The texture loader, `createTextureRegistry`, comes from `@mvtjs/pixi`,
  which the playground already provides.
- A game's `inputConfig` is a handful of callbacks for a d-pad and two
  buttons. The adapter could feed them from the keyboard, or reuse
  `shared/`'s own keyboard view, fetched as it is.

### Approaches for the start code

1. **An adapter (recommended).** The playground generates a short
   `main.ts` that imports the entry's `load()`, calls `fitTo` once at the
   entry's design size, and starts it, with the session's `update` as what
   to tick. Only the adapter is playground code.
2. **Rewrite `load.ts` into a `main.ts`.** This is 052's idea 10.2 in
   reverse. It's fragile, because the entries' `load.ts` files vary a lot
   (boids alone has 200 lines of layout code), and the result would no
   longer be the entry's own code.
3. **Port each entry by hand.** That would be a copy, which is ruled out.

### Offering only the entries that work

- **A check in the repo:** a test, perhaps in `packages/internal/checks/`,
  sorts every entry by the measures above, and writes the list of entries
  that open for the playground's build. A new entry's fit then shows up in
  CI, and the playground's menu never offers one that would fail.
- **A check in the browser, as an entry is chosen:** scan the fetched
  files' imports and assets, and refuse with a reason. This needs nothing
  from the build, but the menu can't tell which entries work until each
  is opened.

The recommendation is the repo check for the menu, and the browser check as
a safety net.

### Open questions for the owner

1. **Editing.** An opened entry is read-only until it's changed, then it
   becomes the visitor's own project. Should a large entry be allowed to
   become a project, past the 40-file limit? The limit only matters for
   share links, and an unchanged entry can be shared as a link to the entry
   and the commit instead.
2. **Where it's offered.** In the Projects dialog, as "Open an Arcade
   entry...", which leaves the Arcade untouched, or on the Arcade's cards
   too?
3. **How much for a first version.** Groups 1 and 2 cover 10 entries, and
   need the fetching, the path layout, the `#shared` alias, the adapter and
   keyboard input. Group 3 adds 7 more, for the `BASE_URL` change and a
   higher file limit.

## Acceptance Criteria

- [ ] The owner has answered the open questions.
- [ ] A proposal designs it, building on the findings above.
- [ ] (Then, as the proposal's steps decide.)

## Progress Log

### 2026-10-17

Created from 052's step 12, when 052 was archived. The investigation's
findings are above; nothing was built.

# MVT Games

Classic arcade games tend to tangle state, rendering, and timing into code that
is hard to test, debug, or extend. This project rebuilds them with
**MVT (Model-View-Ticker)** - an architecture that separates state from
presentation, giving you deterministic models, stateless views, and
frame-consistent rendering.

## The Sites

There are three sites: the **Arcade**, for arcade games, the **Demos**, and
the **Puzzles**. Each shows its entries as cards, to search by name, tag or
description, and to play in the page. They share one page app, built with
MVT too, in HTML.

| Game           | Description                                      |
| -------------- | ------------------------------------------------ |
| Astrovoid      | Blast space rocks in a vector-art void           |
| Burrow Bust    | Dig tunnels, pump up moles and salamanders       |
| Crumb Chase    | Gather crumbs in a hedge maze, dodge the cats    |
| Dojo Duel      | Karate duel, first to three points               |
| Fenceline      | Fence off a meadow, pen sheep, dodge dust devils |
| Fuel Run       | Side-scrolling shooter; bomb fuel to keep flying |
| Galaxy Raiders | Shoot down waves of diving drones                |
| Kwazy Cactii   | Match three or more cactii                       |
| Neon Monsoon   | 1990s-style vertical bullet hell                 |

| Demo             | Description                                                       |
| ---------------- | ----------------------------------------------------------------- |
| Boids            | A flock from three simple rules, every parameter on a slider      |
| Boids in 3D      | The same flock model, drawn with three.js, with an HTML panel     |
| Falling Sand     | Sand and water in a tank: a stress test of the game loop          |
| Fruit Machine    | One model, four views: Pixi, three.js, an HTML panel, a terminal  |
| Reordering Lists | Rows of cards sliding into place as a script reorders them        |

The Puzzles has Sudoku, a puzzle a day, so far.

Each game, demo and puzzle is an **entry**: a self-contained module under
`packages/sites/<site>/src/entries/<id>/` with its own data, models, and views,
and a `start/` directory that tells its site how to list it and load it.

## Tech Stack

| Layer      | Technology                 |
| ---------- | -------------------------- |
| Language   | TypeScript (strict mode)   |
| Rendering  | Pixi.js, Three.js, HTML    |
| Animation  | GSAP                       |
| Build      | Vite                       |
| Linting    | ESLint + TypeScript ESLint |
| Formatting | ESLint Stylistic           |

## Quickstart

```bash
npm install
npm run dev
```

## Scripts

| Command                | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `npm run dev`          | Start the three sites' dev servers, with hot reload: open `http://localhost:5173/arcade/`, where the docs are at `/docs/` and the playground at `/playground/`. Ctrl+C stops all three |
| `npm run dev:https`    | The same, with the Arcade over HTTPS, with a self-signed certificate, so a phone on the network gets sound |
| `npm run build`        | Type-check with `tsc`, then build the Arcade, the playground and the docs for production |
| `npm run build:playground` | Build the playground alone                   |
| `npm run preview`      | Preview the production build locally             |
| `npm run lint`         | Check lint and formatting rules                  |
| `npm run lint:fix`     | Apply ESLint and ESLint Stylistic auto-fixes     |

## Documentation

Learn the architecture, conventions, and patterns:
**[Read the docs](packages/sites/docs/index.md)**

**AI agents:** see [AGENTS.md](AGENTS.md) for compressed orientation.

## Project Structure

An npm workspace: the libraries, published under the `@mvtjs` npm scope,
the sound chips `audio90`, the visual testing package `v-snap`, and private
packages for everything else.

```
packages/     Every package: the libraries (@mvtjs/utils, @mvtjs/pixi,
              @mvtjs/three, @mvtjs/html, audio90), and the private
              ones: the Arcade, the playground, the docs, the benchmarks,
              the checks and the lint rules
notes/        Proposals, tasks, and the archive of finished work
```

```
packages/
├── libraries/
│   ├── utils/           Renderer-agnostic helpers (the view tick API, watch, SlotList, tweens, metronome); JSX base at ./jsx
│   ├── pixi/            The view tick API for Pixi containers, performance metrics, and Pixi's JSX runtime
│   ├── three/           The view tick API for three.js objects, pointer picker, and its JSX runtime
│   ├── html/            The view tick API for DOM elements, and its JSX runtime
│   └── audio90/         The Audio80 and Audio90 sound chips, their tracker notation and sequencer
│   └── v-snap/          Visual snapshot tests for canvas and HTML views, as Vitest projects
├── sites/
│   ├── arcade/          The Arcade's site: its games (private)
│   ├── demos/           The Demos' site (private)
│   ├── puzzles/         The Puzzles' site (private)
│   ├── site-kit/        What the three share: the page, the entry host, shared views, the build (private)
│   ├── playground/      An editor in the browser that runs small MVT projects (private)
│   └── docs/            The documentation (VitePress, private)
└── internal/
    ├── eslint-plugin/   This repo's lint rules (private)
    ├── benchmarks/      Performance benchmarks (private; npm run bench)
    └── checks/          Tests that the packages still fit together as decided (private)

packages/sites/<site>/src/
├── site.ts              The site: its name, and the entries it lists
└── entries/             Its entries, one directory each, and the catalogue
    └── <id>/            Self-contained entry (start/, data/, models/, views/)

packages/sites/site-kit/src/
├── arcade/              The page each site runs (HTML JSX)
├── entry-types/         What an entry is, and how it starts
├── runner/              The entry host, which runs one entry of any renderer, and the page's sound
└── shared/              The shared views (overlay, input, pixel text)
```

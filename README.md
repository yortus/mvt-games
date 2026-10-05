# MVT Games

Classic arcade games tend to tangle state, rendering, and timing into code that
is hard to test, debug, or extend. This project rebuilds them with
**MVT (Model-View-Ticker)** - an architecture that separates state from
presentation, giving you deterministic models, stateless views, and
frame-consistent rendering.

## Games

| Game           | Description                                      |
| -------------- | ------------------------------------------------ |
| Astrovoid      | Blast space rocks in a vector-art void           |
| Burrow Bust    | Dig tunnels, pump up moles and salamanders       |
| Crumb Chase    | Gather crumbs in a hedge maze, dodge the cats    |
| Dojo Duel      | Karate duel, first to three points               |
| Fuel Run       | Side-scrolling shooter; bomb fuel to keep flying |
| Galaxy Raiders | Shoot down waves of diving drones                |
| Kwazy Cactii   | Match three or more cactii                       |
| Neon Monsoon   | 1990s-style vertical bullet hell                 |

Each game is a self-contained module under `packages/website/src/entries/<name>/` with its own
data, models, and views. A **Cabinet** manages game selection and delegates to
the active game session.

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
| `npm run dev`          | Start the Vite dev server with hot reload        |
| `npm run build`        | Type-check with `tsc` then bundle for production |
| `npm run preview`      | Preview the production build locally             |
| `npm run lint`         | Check lint and formatting rules                  |
| `npm run lint:fix`     | Apply ESLint and ESLint Stylistic auto-fixes     |

## Documentation

Learn the architecture, conventions, and patterns:
**[Read the docs](packages/docs/index.md)**

**AI agents:** see [AGENTS.md](AGENTS.md) for compressed orientation.

## Project Structure

An npm workspace: the libraries, published under the `@mvtjs` npm scope,
and private packages for everything else.

```
packages/     Every package: the libraries (@mvtjs/utils, @mvtjs/pixi,
              @mvtjs/three, @mvtjs/html), and the private ones: the website,
              the docs, the benchmarks, the checks and the lint rules
notes/        Proposals, tasks, and the archive of finished work
```

```
packages/
├── utils/               Renderer-agnostic helpers (the tick API, watch, SlotList, tweens); JSX base at ./jsx
├── pixi/                The tick API for Pixi containers, performance metrics, and Pixi's JSX runtime
├── three/               The tick API for three.js objects, pointer picker, and its JSX runtime
├── html/                The tick API for DOM elements, and its JSX runtime
├── eslint-plugin/       This repo's lint rules (private for now)
├── benchmarks/          Performance benchmarks (private; npm run bench)
├── checks/              Tests that the packages still fit together as decided (private)
├── docs/                The documentation (VitePress, private)
└── website/             The games, demos and playground (private)

packages/website/src/
├── main.ts              Bootstrap: init Pixi app, create cabinet, start ticker
├── cabinet/             Cabinet model & view (game selection)
├── games/               Game registry + per-game modules
│   └── <name>/          Self-contained game (data/, models/, views/)
├── demos/               Demo registry + per-demo modules
├── playground/          In-browser editor and sandbox
└── shared/              The site's shared views (overlay, input, pause menu, perfmon)
```

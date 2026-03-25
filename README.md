# MVT Games

Classic arcade games tend to tangle state, rendering, and timing into code that
is hard to test, debug, or extend. This project rebuilds them with
**MVT (Model-View-Ticker)** - an architecture that separates state from
presentation, giving you deterministic models, stateless views, and
frame-consistent rendering.

## Games

| Game      | Description                          |
| --------- | ------------------------------------ |
| Asteroids | Blast asteroids in a vector-art void |
| Dig Dug   | Dig tunnels, defeat enemies          |
| Galaga    | Shoot waves of alien invaders        |
| IK        | Karate fighting game                 |
| Pac-Man   | Navigate mazes, eat dots             |
| Scramble  | Side-scrolling shooter               |

Each game is a self-contained module under `src/games/<name>/` with its own
data, models, and views. A **Cabinet** manages game selection and delegates to
the active game session.

## Tech Stack

| Layer      | Technology                 |
| ---------- | -------------------------- |
| Language   | TypeScript (strict mode)   |
| Rendering  | Pixi.js                    |
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
**[Read the docs](docs/index.md)**

**AI agents:** see [AGENTS.md](AGENTS.md) for compressed orientation.

## Project Structure

```
src/
├── main.ts              Bootstrap: init Pixi app, create cabinet, start ticker
├── cabinet/             Cabinet model & view (game selection)
├── games/               Game registry + per-game modules
│   └── <name>/          Self-contained game (data/, models/, views/)
└── common/              Shared helpers, views, and models
```

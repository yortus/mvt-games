# MVT Games

A collection of classic arcade games built with modern web technologies,
demonstrating the **MVT (Model-View-Ticker)** architecture for clean separation
of concerns, testability, and buttery-smooth animation.

## Games

| Game    | Description                |
| ------- | -------------------------- |
| Pac-Man | Navigate mazes, eat dots   |
| Dig Dug | Dig tunnels, defeat enemies |

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
| Formatting | Prettier                   |

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
| `npm run lint`         | Lint `src/` with ESLint                          |
| `npm run format`       | Format all files with Prettier                   |
| `npm run format:check` | Check formatting without writing changes         |

## Architecture

The project follows the **MVT (Model-View-Ticker)** pattern — an architectural
approach designed for visual/interactive applications with frame-based animation:

- **Models** own all state and domain logic, advancing only through explicit
  `update(deltaMs)` calls.
- **Views** are stateless renderers that read model state through a `bindings`
  interface and refresh every frame.
- **Ticker** drives the loop: update models → refresh views → render frame.
- **Cabinet** manages game selection; each game is a self-contained module
  that exposes a `GameEntry` descriptor and produces a `GameSession` when started.

See the [MVT Architecture Guide](docs/mvt-guide.md) for full details.

## Documentation

| Document                                      | Description                                                   |
| --------------------------------------------- | ------------------------------------------------------------- |
| [Documentation Hub](docs/README.md)           | Start here — index of all guides with glossary                |
| [MVT Architecture Guide](docs/mvt-guide.md)   | Full MVT pattern reference with diagrams                      |
| [TypeScript Style Guide](docs/style-guide.md) | Coding conventions, naming, project structure                 |
| [AGENTS.md](AGENTS.md)                        | AI agent orientation — architecture & conventions at a glance |

## Project Structure

```
src/
├── main.ts              Bootstrap: init Pixi app, create cabinet, start ticker
├── cabinet/             Cabinet model & view (game selection)
├── games/               Game registry + per-game modules
│   ├── game-entry.ts    GameEntry & GameSession interfaces
│   └── <name>/          Self-contained game (data/, models/, views/)
└── utils/               Shared helpers (e.g. change-detection watches)
```

Each directory is a module with a barrel file (`index.ts`) defining its public API.

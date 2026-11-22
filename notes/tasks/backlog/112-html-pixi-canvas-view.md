# An HTML `PixiCanvasView`

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-11-22 |
| Updated  | 2026-11-22 |

## Description

This task builds the last bridge in
[107](../../archive/107-complete-pixi-3d-jsx.md) section 3.6.
`PixiCanvasView` is an HTML view that holds a Pixi canvas, so an HTML view
can show Pixi, and through Pixi, PixiJS 3D. `Scene3DView` already puts 3D
in a 2D tree, and `ScreenView` puts 2D in a 3D scene. `PixiCanvasView`
belongs in `@mvtjs/pixi`, since it holds a Pixi application and doesn't use
PixiJS 3D.

The view owns a Pixi application. It handles the application's
asynchronous start-up and its size, and renders after its stage refreshes.
It destroys the application without freeing resources that other
renderers share. Fruit Machine sets up most of this by hand today, and
would use the view instead.

## Acceptance criteria

- [ ] `PixiCanvasView` in `@mvtjs/pixi`, usable as an HTML JSX tag, with
      bindings for its size and its stage's content.
- [ ] It's destroyed with its HTML element, and can be listed in `owns`.
- [ ] Fruit Machine uses it, and its images are unchanged.
- [ ] It has a visual test, and a line in `@mvtjs/pixi`'s README.

## Progress log

- 2026-11-22: Created, as 107 finished.

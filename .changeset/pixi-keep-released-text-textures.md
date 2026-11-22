---
'@mvtjs/pixi': minor
---

`keepReleasedTextTextures`, new in `@mvtjs/pixi`, keeps a renderer's text textures for a while after their texts have gone. A view that is destroyed and built again then finds its texts' textures still there, rather than drawing and uploading each one again. Call it once, after the renderer starts, with a budget in pixels. When the kept textures would go over it, those released longest ago go first. Its `releaseAll` releases every kept texture, such as when a game ends, and destroying the renderer releases them too. Only texts that share a style can find their textures again, which JSX texts passed the same `style` object do.

---
'@mvtjs/pixi': patch
---

`createTextureRegistry` now samples its spritesheet nearest-neighbour, as it always meant to. It passed that option in a form that Pixi 8's spritesheet loader ignores. So a sheet took whatever `TextureSource.defaultOptions.scaleMode` was when it loaded, and could look smooth or pixelated depending on what had run before.
